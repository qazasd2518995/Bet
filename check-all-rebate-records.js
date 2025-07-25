import db from './db/config.js';

async function checkAllRebateRecords() {
    try {
        console.log('=== 检查所有退水记录 ===\n');

        const testPeriod = '20250714546';

        // 1. 检查所有该期的交易记录
        console.log(`1. 检查期号 ${testPeriod} 的所有交易记录...`);
        const allTransactions = await db.any(`
            SELECT 
                tr.*,
                CASE 
                    WHEN tr.user_type = 'agent' THEN a.username
                    WHEN tr.user_type = 'member' THEN m.username
                END as username
            FROM transaction_records tr
            LEFT JOIN agents a ON tr.user_type = 'agent' AND tr.user_id = a.id
            LEFT JOIN members m ON tr.user_type = 'member' AND tr.user_id = m.id
            WHERE tr.period = $1
            ORDER BY tr.created_at DESC
        `, [testPeriod]);

        console.log(`找到 ${allTransactions.length} 笔交易记录`);
        for (const tx of allTransactions) {
            console.log(`\nID: ${tx.id}`);
            console.log(`用户类型: ${tx.user_type}`);
            console.log(`用户: ${tx.username}`);
            console.log(`交易类型: ${tx.transaction_type}`);
            console.log(`金额: ${tx.amount}`);
            console.log(`余额: ${tx.balance_before} -> ${tx.balance_after}`);
            console.log(`描述: ${tx.description}`);
            console.log(`时间: ${tx.created_at}`);
        }

        // 2. 检查最近的退水交易
        console.log('\n\n2. 检查最近的退水交易...');
        const recentRebates = await db.any(`
            SELECT 
                tr.*,
                CASE 
                    WHEN tr.user_type = 'agent' THEN a.username
                END as username
            FROM transaction_records tr
            LEFT JOIN agents a ON tr.user_type = 'agent' AND tr.user_id = a.id
            WHERE tr.transaction_type = 'rebate'
                AND tr.created_at >= NOW() - INTERVAL '10 minutes'
            ORDER BY tr.created_at DESC
            LIMIT 10
        `);

        console.log(`最近10分钟的退水交易 (${recentRebates.length} 笔)：`);
        for (const tx of recentRebates) {
            console.log(`\n代理: ${tx.username}`);
            console.log(`期号: ${tx.period}`);
            console.log(`金额: ${tx.amount}`);
            console.log(`会员: ${tx.member_username}`);
            console.log(`时间: ${tx.created_at}`);
        }

        // 3. 检查代理最近的交易
        console.log('\n\n3. 检查特定代理的最近交易...');
        const agentTransactions = await db.any(`
            SELECT 
                tr.*,
                a.username
            FROM transaction_records tr
            JOIN agents a ON tr.user_type = 'agent' AND tr.user_id = a.id
            WHERE a.username IN ('justin2025A', 'ti2025A')
                AND tr.created_at >= NOW() - INTERVAL '1 hour'
            ORDER BY tr.created_at DESC
            LIMIT 20
        `);

        console.log(`justin2025A 和 ti2025A 最近1小时的交易 (${agentTransactions.length} 笔)：`);
        for (const tx of agentTransactions) {
            console.log(`\n${tx.username}: ${tx.transaction_type} ${tx.amount} (期号: ${tx.period})`);
            console.log(`余额: ${tx.balance_before} -> ${tx.balance_after}`);
            console.log(`时间: ${tx.created_at}`);
        }

    } catch (error) {
        console.error('错误:', error);
    } finally {
        process.exit(0);
    }
}

checkAllRebateRecords();