// execute-period-385-fix.cjs - 執行期號385的修正
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

async function executeFix() {
    const client = await pool.connect();
    
    try {
        console.log('=== 執行期號 20250714385 的結算修正 ===\n');
        
        // 開始事務
        await client.query('BEGIN');
        
        // 1. 獲取需要修正的投注
        const wrongBetQuery = `
            SELECT 
                bh.*,
                m.id as member_id,
                m.balance as current_balance
            FROM bet_history bh
            JOIN members m ON bh.username = m.username
            WHERE bh.id = 2390
        `;
        const wrongBetResult = await client.query(wrongBetQuery);
        
        if (wrongBetResult.rows.length === 0) {
            console.log('找不到投注 ID 2390');
            await client.query('ROLLBACK');
            return;
        }
        
        const bet = wrongBetResult.rows[0];
        const winAmount = parseFloat(bet.amount) * parseFloat(bet.odds || 9.89);
        const newBalance = parseFloat(bet.current_balance) + winAmount;
        
        console.log('投注資訊:');
        console.log(`  ID: ${bet.id}`);
        console.log(`  用戶: ${bet.username}`);
        console.log(`  投注: 位置${bet.position} 號碼${bet.bet_value}`);
        console.log(`  金額: ${bet.amount}`);
        console.log(`  賠率: ${bet.odds || 9.89}`);
        console.log(`  應得獎金: ${winAmount}`);
        console.log(`  當前餘額: ${bet.current_balance}`);
        console.log(`  新餘額: ${newBalance}`);
        
        // 2. 更新投注狀態
        await client.query(`
            UPDATE bet_history 
            SET win = true, 
                win_amount = $1,
                settled_at = NOW()
            WHERE id = $2
        `, [winAmount, bet.id]);
        console.log('\n✓ 已更新投注狀態為中獎');
        
        // 3. 更新用戶餘額
        await client.query(`
            UPDATE members 
            SET balance = $1,
                total_win = total_win + $2
            WHERE id = $3
        `, [newBalance, winAmount, bet.member_id]);
        console.log('✓ 已更新用戶餘額');
        
        // 4. 記錄交易
        await client.query(`
            INSERT INTO transaction_records 
            (user_type, user_id, transaction_type, amount, balance_before, balance_after, description, created_at)
            VALUES ('member', $1, 'win', $2, $3, $4, $5, NOW())
        `, [
            bet.member_id,
            winAmount,
            bet.current_balance,
            newBalance,
            `期號 20250714385 中獎補發 (位置10號碼4)`
        ]);
        console.log('✓ 已記錄交易');
        
        // 5. 提交事務
        await client.query('COMMIT');
        console.log('\n✅ 修正完成！');
        console.log(`用戶 ${bet.username} 獲得 ${winAmount} 元獎金`);
        console.log(`餘額: ${bet.current_balance} → ${newBalance}`);
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('修正過程發生錯誤:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

// 詢問確認
const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('⚠️  警告：此操作將修改資料庫');
console.log('將修正期號 20250714385 投注 ID 2390 的結算錯誤');
console.log('用戶 justin111 將獲得 989 元獎金\n');

rl.question('確定要執行嗎？(yes/no): ', (answer) => {
    if (answer.toLowerCase() === 'yes') {
        executeFix();
    } else {
        console.log('已取消操作');
        process.exit(0);
    }
    rl.close();
});