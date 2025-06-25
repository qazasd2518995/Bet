import pkg from 'pg';
const { Pool } = pkg;

// 數據庫配置
const dbConfig = {
    host: 'localhost',
    port: 5432,
    database: 'bet_game',
    user: 'justin',
    max: 30,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    query_timeout: 10000
};

const db = new Pool(dbConfig);

async function createTestBetData() {
    try {
        console.log('開始創建測試投注數據...');
        
        // 確保測試用戶存在
        const testUsername = 'testuser';
        
        // 檢查用戶是否存在
        const userCheck = await db.query('SELECT id FROM members WHERE username = $1', [testUsername]);
        
        if (userCheck.rows.length === 0) {
            // 創建測試用戶
            await db.query(`
                INSERT INTO members (username, password, balance, created_at, is_admin)
                VALUES ($1, $2, $3, NOW(), false)
            `, [testUsername, 'password123', 10000]);
            console.log('✅ 測試用戶已創建');
        }
        
        // 獲取用戶ID
        const userResult = await db.query('SELECT id FROM members WHERE username = $1', [testUsername]);
        const userId = userResult.rows[0].id;
        
        // 生成最近一週的測試數據
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        for (let i = 0; i < 7; i++) {
            const testDate = new Date(today);
            testDate.setDate(today.getDate() - i);
            
            // 每天生成3-8筆隨機投注
            const betCount = Math.floor(Math.random() * 6) + 3;
            
            for (let j = 0; j < betCount; j++) {
                const period = `2025062${(530 - i * 10 - j).toString().padStart(3, '0')}`;
                const betTypes = ['champion', 'sumValue', 'sumOddEven'];
                const betType = betTypes[Math.floor(Math.random() * betTypes.length)];
                
                let betValue, position = null;
                if (betType === 'champion') {
                    betValue = Math.floor(Math.random() * 10) + 1;
                    position = 1;
                } else if (betType === 'sumValue') {
                    betValue = Math.random() > 0.5 ? 'big' : 'small';
                } else {
                    betValue = Math.random() > 0.5 ? 'odd' : 'even';
                }
                
                const amount = [100, 200, 500, 1000][Math.floor(Math.random() * 4)];
                const odds = Math.random() * 2 + 1.5; // 1.5 到 3.5
                const win = Math.random() > 0.6; // 40% 獲勝率
                const winAmount = win ? amount * odds : 0;
                
                // 隨機時間（該日內）
                const betTime = new Date(testDate);
                betTime.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
                
                await db.query(`
                    INSERT INTO bet_history (
                        username, period, bet_type, bet_value, position,
                        amount, odds, win, win_amount, settled, created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10)
                `, [testUsername, period, betType, betValue, position, amount, odds, win, winAmount, betTime]);
            }
            
            console.log(`✅ 日期 ${testDate.toISOString().split('T')[0]} 已生成 ${betCount} 筆投注記錄`);
        }
        
        console.log('🎉 測試投注數據創建完成！');
        
        // 顯示統計
        const stats = await db.query(`
            SELECT 
                COUNT(*) as total_bets,
                SUM(amount) as total_bet_amount,
                SUM(win_amount) as total_win_amount,
                SUM(win_amount) - SUM(amount) as profit
            FROM bet_history 
            WHERE username = $1 AND settled = true
        `, [testUsername]);
        
        console.log('📊 測試數據統計:');
        console.log(`- 總投注數: ${stats.rows[0].total_bets}`);
        console.log(`- 總投注金額: $${stats.rows[0].total_bet_amount}`);
        console.log(`- 總獲勝金額: $${stats.rows[0].total_win_amount}`);
        console.log(`- 總盈虧: ${stats.rows[0].profit > 0 ? '+' : ''}$${stats.rows[0].profit}`);
        
    } catch (error) {
        console.error('❌ 創建測試數據失敗:', error);
    } finally {
        await db.end();
    }
}

createTestBetData(); 