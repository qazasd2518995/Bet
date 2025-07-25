// clear-unsettled-bets.js - 清除未结算的注单
import db from './db/config.js';

async function clearUnsettledBets() {
    try {
        console.log('🔍 检查未结算的注单...\n');
        
        // 1. 检查未结算的注单数量
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
            console.log('✅ 没有未结算的注单');
            await db.$pool.end();
            return;
        }
        
        console.log(`找到 ${unsettledStats.length} 个期号有未结算的注单:\n`);
        
        let totalUnsettled = 0;
        let totalAmount = 0;
        
        unsettledStats.forEach(stat => {
            totalUnsettled += parseInt(stat.count);
            totalAmount += parseFloat(stat.total_amount);
            console.log(`期号 ${stat.period}: ${stat.count} 笔，总金额 $${stat.total_amount}`);
            console.log(`  时间范围: ${new Date(stat.earliest).toLocaleString('zh-TW')} - ${new Date(stat.latest).toLocaleString('zh-TW')}`);
        });
        
        console.log(`\n总计: ${totalUnsettled} 笔未结算注单，总金额 $${totalAmount}`);
        
        // 2. 询问用户确认
        console.log('\n⚠️ 注意: 删除未结算的注单将无法恢复！');
        console.log('如果这些是正常的未开奖注单，请等待开奖后自动结算。');
        console.log('\n开始删除未结算的注单...');
        
        // 3. 在事务中删除未结算的注单
        await db.tx(async t => {
            // 先记录要删除的注单
            const deletedBets = await t.manyOrNone(`
                SELECT id, username, period, amount, bet_type, bet_value
                FROM bet_history 
                WHERE settled = false
            `);
            
            // 退还金额给用户
            const userRefunds = {};
            deletedBets.forEach(bet => {
                if (!userRefunds[bet.username]) {
                    userRefunds[bet.username] = 0;
                }
                userRefunds[bet.username] += parseFloat(bet.amount);
            });
            
            // 更新用户余额
            for (const [username, refundAmount] of Object.entries(userRefunds)) {
                const member = await t.one('SELECT id, balance FROM members WHERE username = $1', [username]);
                const newBalance = parseFloat(member.balance) + refundAmount;
                
                await t.none('UPDATE members SET balance = $1 WHERE id = $2', [newBalance, member.id]);
                
                // 记录退款交易
                await t.none(`
                    INSERT INTO transaction_records
                    (user_type, user_id, transaction_type, amount, balance_before, balance_after, description, created_at)
                    VALUES ('member', $1, 'refund', $2, $3, $4, $5, NOW())
                `, [
                    member.id,
                    refundAmount,
                    parseFloat(member.balance),
                    newBalance,
                    '清除未结算注单退款'
                ]);
                
                console.log(`\n✅ 退还 ${username} $${refundAmount}`);
                console.log(`   余额: $${member.balance} → $${newBalance}`);
            }
            
            // 删除未结算的注单
            const deleteResult = await t.result('DELETE FROM bet_history WHERE settled = false');
            console.log(`\n✅ 已删除 ${deleteResult.rowCount} 笔未结算注单`);
        });
        
        console.log('\n🎉 清除未结算注单完成！');
        
        await db.$pool.end();
    } catch (error) {
        console.error('清除过程中发生错误:', error);
        await db.$pool.end();
    }
}

clearUnsettledBets();