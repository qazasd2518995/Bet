const { Pool } = require('pg');

// Database config
const dbConfig = {
  host: 'dpg-d0e2imc9c44c73che3kg-a.oregon-postgres.render.com',
  port: 5432,
  database: 'bet_game',
  user: 'bet_game_user',
  password: 'Vm4J5g1gymwPfBNcgYfGCe4GEZqCjoIy',
  ssl: {
    rejectUnauthorized: false
  }
};

const pool = new Pool(dbConfig);

async function fixPeriod385() {
    const client = await pool.connect();
    
    try {
        console.log('=== 修復期號 20250714385 的結算問題 ===\n');
        
        // 開始事務
        await client.query('BEGIN');
        
        // 1. 獲取該期的開獎結果
        const resultQuery = `
            SELECT * FROM result_history 
            WHERE period = $1
        `;
        const resultData = await client.query(resultQuery, ['20250714385']);
        
        if (resultData.rows.length === 0) {
            console.log('找不到期號 20250714385 的開獎結果');
            await client.query('ROLLBACK');
            return;
        }
        
        const result = resultData.rows[0];
        const positions = result.result; // [7, 6, 2, 5, 3, 9, 10, 1, 8, 4]
        console.log('開獎結果:', positions);
        console.log('位置10的結果:', positions[9], '(應該是4)');
        
        // 2. 檢查需要修正的投注
        const wrongBetsQuery = `
            SELECT 
                bh.*,
                m.id as member_id,
                m.balance as current_balance
            FROM bet_history bh
            JOIN members m ON bh.username = m.username
            WHERE bh.period = $1 
            AND bh.bet_type = 'number' 
            AND bh.position = 10 
            AND bh.bet_value = '4'
            AND bh.win = false
        `;
        const wrongBets = await client.query(wrongBetsQuery, ['20250714385']);
        
        console.log(`\n找到 ${wrongBets.rows.length} 筆需要修正的投注`);
        
        if (wrongBets.rows.length === 0) {
            console.log('沒有需要修正的投注');
            await client.query('ROLLBACK');
            return;
        }
        
        // 3. 修正每筆錯誤的投注
        let totalWinAmount = 0;
        const updates = [];
        
        for (const bet of wrongBets.rows) {
            const winAmount = parseFloat(bet.amount) * parseFloat(bet.odds || 9.85);
            totalWinAmount += winAmount;
            
            updates.push({
                betId: bet.id,
                username: bet.username,
                memberId: bet.member_id,
                currentBalance: parseFloat(bet.current_balance),
                winAmount: winAmount,
                betAmount: bet.amount
            });
            
            console.log(`\n投注 ID ${bet.id}:`);
            console.log(`  用戶: ${bet.username}`);
            console.log(`  投注金額: ${bet.amount}`);
            console.log(`  賠率: ${bet.odds || 9.85}`);
            console.log(`  應得獎金: ${winAmount}`);
        }
        
        // 4. 詢問確認
        console.log(`\n總計需要修正 ${updates.length} 筆投注，總派彩金額: ${totalWinAmount}`);
        console.log('\n請確認是否執行修正? (這將會修改資料庫)');
        console.log('如果要執行修正，請取消註解下面的程式碼');
        
        // 取消下面的註解以執行修正
        /*
        // 5. 更新投注狀態
        for (const update of updates) {
            // 更新投注為中獎
            await client.query(`
                UPDATE bet_history 
                SET win = true, 
                    win_amount = $1,
                    settled_at = NOW()
                WHERE id = $2
            `, [update.winAmount, update.betId]);
            
            // 更新用戶餘額
            const newBalance = update.currentBalance + update.winAmount;
            await client.query(`
                UPDATE members 
                SET balance = $1,
                    total_win = total_win + $2
                WHERE id = $3
            `, [newBalance, update.winAmount, update.memberId]);
            
            // 記錄交易
            await client.query(`
                INSERT INTO transaction_records 
                (user_type, user_id, transaction_type, amount, balance_before, balance_after, description, created_at)
                VALUES ('member', $1, 'win', $2, $3, $4, $5, NOW())
            `, [
                update.memberId,
                update.winAmount,
                update.currentBalance,
                newBalance,
                `期號 20250714385 中獎補發`
            ]);
            
            console.log(`✓ 已修正投注 ${update.betId}，用戶 ${update.username} 獲得 ${update.winAmount}`);
        }
        
        // 提交事務
        await client.query('COMMIT');
        console.log('\n✅ 修正完成！');
        */
        
        // 如果不執行修正，回滾事務
        await client.query('ROLLBACK');
        console.log('\n已回滾，未做任何修改');
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('修正過程發生錯誤:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

fixPeriod385();