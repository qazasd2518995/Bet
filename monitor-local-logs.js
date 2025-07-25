import db from './db/config.js';

async function monitorLocalLogs() {
    console.log('=== 监控本地后端日志 ===\n');
    console.log('请在另一个终端执行下注，然后观察这里的输出\n');
    
    let lastBetId = 0;
    let lastTransactionId = 0;
    
    // 获取最新ID
    const latestBet = await db.oneOrNone(`SELECT MAX(id) as max_id FROM bet_history`);
    if (latestBet?.max_id) lastBetId = latestBet.max_id;
    
    const latestTransaction = await db.oneOrNone(`
        SELECT MAX(id) as max_id FROM transaction_records 
        WHERE transaction_type = 'rebate'
    `);
    if (latestTransaction?.max_id) lastTransactionId = latestTransaction.max_id;
    
    console.log(`开始监控... (初始: 下注ID=${lastBetId}, 退水ID=${lastTransactionId})\n`);
    
    // 每2秒检查一次
    setInterval(async () => {
        try {
            // 检查新下注
            const newBets = await db.any(`
                SELECT * FROM bet_history 
                WHERE id > $1 
                ORDER BY id ASC
            `, [lastBetId]);
            
            if (newBets.length > 0) {
                console.log(`\n[${new Date().toLocaleTimeString()}] 🎲 发现新下注：`);
                newBets.forEach(bet => {
                    console.log(`  ID=${bet.id}, 用户=${bet.username}, 期号=${bet.period}, 金额=${bet.amount}, 已结算=${bet.settled}`);
                    lastBetId = bet.id;
                });
            }
            
            // 检查结算状态变化
            const recentSettled = await db.any(`
                SELECT id, period, username, settled, settled_at 
                FROM bet_history 
                WHERE settled = true 
                AND settled_at > NOW() - INTERVAL '10 seconds'
                ORDER BY settled_at DESC
                LIMIT 5
            `);
            
            if (recentSettled.length > 0) {
                console.log(`\n[${new Date().toLocaleTimeString()}] ✅ 最近结算：`);
                recentSettled.forEach(bet => {
                    console.log(`  期号=${bet.period}, 用户=${bet.username}, 结算时间=${new Date(bet.settled_at).toLocaleTimeString()}`);
                });
            }
            
            // 检查新退水
            const newRebates = await db.any(`
                SELECT tr.*, a.username as agent_name
                FROM transaction_records tr
                JOIN agents a ON tr.user_id = a.id
                WHERE tr.id > $1 
                AND tr.transaction_type = 'rebate'
                ORDER BY tr.id ASC
            `, [lastTransactionId]);
            
            if (newRebates.length > 0) {
                console.log(`\n[${new Date().toLocaleTimeString()}] 💰 发现新退水：`);
                newRebates.forEach(rebate => {
                    console.log(`  ID=${rebate.id}, 代理=${rebate.agent_name}, 金额=${rebate.amount}, 期号=${rebate.period}`);
                    lastTransactionId = rebate.id;
                });
            }
            
        } catch (error) {
            console.error('监控错误:', error.message);
        }
    }, 2000);
}

// 优雅退出
process.on('SIGINT', () => {
    console.log('\n\n监控结束');
    process.exit(0);
});

monitorLocalLogs();