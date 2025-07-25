// clear-unsettled-bets.js - 清除未結算的注單
import db from './db/config.js';

async function clearUnsettledBets() {
    try {
        console.log('🔍 檢查未結算的注單...\n');
        
        // 1. 檢查未結算的注單數量
        const unsettledStats = await db.any(`
            SELECT 
                period,
                COUNT(*) as count,
                SUM(amount) as total_amount,
                MIN(created_at) as earliest,
                MAX(created_at) as latest
            FROM bet_history 
            WHERE settled = false
            GROUP BY period
            ORDER BY period DESC
        `);
        
        if (unsettledStats.length === 0) {
            console.log('✅ 沒有未結算的注單');
            await db.$pool.end();
            return;
        }
        
        console.log(`找到 ${unsettledStats.length} 個期號有未結算的注單:\n`);
        
        let totalUnsettled = 0;
        let totalAmount = 0;
        
        unsettledStats.forEach(stat => {
            totalUnsettled += parseInt(stat.count);
            totalAmount += parseFloat(stat.total_amount);
            console.log(`期號 ${stat.period}: ${stat.count} 筆，總金額 $${stat.total_amount}`);
            console.log(`  時間範圍: ${new Date(stat.earliest).toLocaleString('zh-TW')} - ${new Date(stat.latest).toLocaleString('zh-TW')}`);
        });
        
        console.log(`\n總計: ${totalUnsettled} 筆未結算注單，總金額 $${totalAmount}`);
        
        // 2. 詢問用戶確認
        console.log('\n⚠️ 注意: 刪除未結算的注單將無法恢復！');
        console.log('如果這些是正常的未開獎注單，請等待開獎後自動結算。');
        console.log('\n開始刪除未結算的注單...');
        
        // 3. 在事務中刪除未結算的注單
        await db.tx(async t => {
            // 先記錄要刪除的注單
            const deletedBets = await t.manyOrNone(`
                SELECT id, username, period, amount, bet_type, bet_value
                FROM bet_history 
                WHERE settled = false
            `);
            
            // 退還金額給用戶
            const userRefunds = {};
            deletedBets.forEach(bet => {
                if (!userRefunds[bet.username]) {
                    userRefunds[bet.username] = 0;
                }
                userRefunds[bet.username] += parseFloat(bet.amount);
            });
            
            // 更新用戶餘額
            for (const [username, refundAmount] of Object.entries(userRefunds)) {
                const member = await t.one('SELECT id, balance FROM members WHERE username = $1', [username]);
                const newBalance = parseFloat(member.balance) + refundAmount;
                
                await t.none('UPDATE members SET balance = $1 WHERE id = $2', [newBalance, member.id]);
                
                // 記錄退款交易
                await t.none(`
                    INSERT INTO transaction_records
                    (user_type, user_id, transaction_type, amount, balance_before, balance_after, description, created_at)
                    VALUES ('member', $1, 'refund', $2, $3, $4, $5, NOW())
                `, [
                    member.id,
                    refundAmount,
                    parseFloat(member.balance),
                    newBalance,
                    '清除未結算注單退款'
                ]);
                
                console.log(`\n✅ 退還 ${username} $${refundAmount}`);
                console.log(`   餘額: $${member.balance} → $${newBalance}`);
            }
            
            // 刪除未結算的注單
            const deleteResult = await t.result('DELETE FROM bet_history WHERE settled = false');
            console.log(`\n✅ 已刪除 ${deleteResult.rowCount} 筆未結算注單`);
        });
        
        console.log('\n🎉 清除未結算注單完成！');
        
        await db.$pool.end();
    } catch (error) {
        console.error('清除過程中發生錯誤:', error);
        await db.$pool.end();
    }
}

clearUnsettledBets();