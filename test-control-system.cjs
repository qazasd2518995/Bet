const axios = require('axios');
const db = require('pg-promise')()({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'bet_game',
    user: process.env.DB_USER || 'justin',  // 修正為正確的用戶名
    password: process.env.DB_PASSWORD || 'justin520',
    ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
    } : false
});

const GAME_URL = 'http://localhost:3000';
const AGENT_URL = 'http://localhost:3003';

async function testControlSystem() {
    console.log('🔧 控制輸贏系統完整測試\n');
    
    try {
        // 1. 檢查當前控制設定
        console.log('=== 1. 檢查當前控制設定 ===');
        const activeControl = await db.oneOrNone(`
            SELECT * FROM win_loss_control 
            WHERE is_active = true 
            ORDER BY id DESC 
            LIMIT 1
        `);
        
        if (activeControl) {
            console.log('✅ 找到活躍控制設定:');
            console.log(`   ID: ${activeControl.id}`);
            console.log(`   模式: ${activeControl.control_mode}`);
            console.log(`   目標: ${activeControl.target_username}`);
            console.log(`   機率: ${activeControl.control_percentage}%`);
            console.log(`   贏控制: ${activeControl.win_control}`);
            console.log(`   開始期數: ${activeControl.start_period}`);
            
            // 修正期數格式問題
            if (activeControl.start_period && activeControl.start_period.length > 11) {
                console.log('\n⚠️  檢測到期數格式問題，正在修復...');
                const fixedPeriod = activeControl.start_period.substring(0, 11);
                await db.none(`
                    UPDATE win_loss_control 
                    SET start_period = $1 
                    WHERE id = $2
                `, [fixedPeriod, activeControl.id]);
                console.log(`✅ 期數已修正: ${activeControl.start_period} → ${fixedPeriod}`);
            }
        } else {
            console.log('❌ 沒有活躍的控制設定');
        }
        
        // 2. 檢查當前遊戲狀態
        console.log('\n=== 2. 檢查當前遊戲狀態 ===');
        const gameResponse = await axios.get(`${GAME_URL}/api/game-data`);
        const gameData = gameResponse.data.gameData;
        console.log(`當前期數: ${gameData.currentPeriod}`);
        console.log(`狀態: ${gameData.status}`);
        console.log(`倒計時: ${gameData.countdownSeconds}秒`);
        
        // 3. 測試內部API
        console.log('\n=== 3. 測試內部控制API ===');
        try {
            const controlResponse = await axios.get(`${AGENT_URL}/api/agent/internal/win-loss-control/active`);
            console.log('✅ 內部API正常:');
            console.log(JSON.stringify(controlResponse.data, null, 2));
        } catch (error) {
            console.log('❌ 內部API錯誤:', error.message);
        }
        
        // 4. 測試下注影響
        if (activeControl && activeControl.control_mode === 'single_member') {
            console.log('\n=== 4. 測試下注影響 ===');
            const targetBets = await db.any(`
                SELECT * FROM bet_history 
                WHERE username = $1 
                AND period = $2 
                AND settled = false
            `, [activeControl.target_username, gameData.currentPeriod]);
            
            console.log(`目標會員 ${activeControl.target_username} 在當期的下注:`, targetBets.length, '筆');
            
            if (targetBets.length > 0) {
                console.log('下注詳情:');
                targetBets.forEach(bet => {
                    console.log(`  - ${bet.bet_type} ${bet.bet_value} ${bet.position ? `位置${bet.position}` : ''} 金額:${bet.amount}`);
                });
            }
        }
        
        // 5. 建議操作
        console.log('\n=== 5. 建議操作 ===');
        console.log('1. 確保代理系統(3003端口)正在運行');
        console.log('2. 設定合理的開始期數（當前期數或下一期）');
        console.log('3. 讓目標會員下注後等待開獎驗證');
        console.log('4. 查看遊戲後端日誌確認控制是否生效');
        
    } catch (error) {
        console.error('測試失敗:', error.message);
    } finally {
        await db.$pool.end();
    }
}

// 執行測試
testControlSystem(); 