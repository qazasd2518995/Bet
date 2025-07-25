import db from './db/config.js';

async function monitorBettingAndRebate() {
    try {
        console.log('=== 开始监控下注和退水机制 ===\n');
        console.log('请使用 justin111 / aaaa00 进行下注测试\n');
        console.log('监控中... (按 Ctrl+C 结束)\n');
        
        let lastBetId = 0;
        let lastRebateId = 0;
        
        // 获取最新的ID
        const latestBet = await db.oneOrNone(`
            SELECT MAX(id) as max_id FROM bet_history
        `);
        if (latestBet && latestBet.max_id) {
            lastBetId = latestBet.max_id;
        }
        
        const latestRebate = await db.oneOrNone(`
            SELECT MAX(id) as max_id FROM transaction_records
            WHERE transaction_type = 'rebate'
        `);
        if (latestRebate && latestRebate.max_id) {
            lastRebateId = latestRebate.max_id;
        }
        
        // 每3秒检查一次
        setInterval(async () => {
            try {
                // 检查新的下注
                const newBets = await db.any(`
                    SELECT * FROM bet_history
                    WHERE id > $1
                    ORDER BY id ASC
                `, [lastBetId]);
                
                if (newBets.length > 0) {
                    console.log(`\n🎲 发现 ${newBets.length} 笔新下注：`);
                    newBets.forEach(bet => {
                        console.log(`  - [${new Date(bet.created_at).toLocaleTimeString()}] ${bet.username} 下注 ${bet.amount}元 于 ${bet.bet_type}/${bet.bet_value} (期号: ${bet.period})`);
                        lastBetId = bet.id;
                    });
                }
                
                // 检查新的退水
                const newRebates = await db.any(`
                    SELECT 
                        tr.*,
                        a.username as agent_name
                    FROM transaction_records tr
                    JOIN agents a ON tr.user_id = a.id
                    WHERE tr.id > $1
                    AND tr.transaction_type = 'rebate'
                    ORDER BY tr.id ASC
                `, [lastRebateId]);
                
                if (newRebates.length > 0) {
                    console.log(`\n💰 发现 ${newRebates.length} 笔新退水：`);
                    newRebates.forEach(rebate => {
                        console.log(`  - [${new Date(rebate.created_at).toLocaleTimeString()}] ${rebate.agent_name} 获得 ${rebate.amount}元 退水 (期号: ${rebate.period}, 会员: ${rebate.member_username})`);
                        lastRebateId = rebate.id;
                    });
                }
                
                // 检查最新的结算状态
                const recentSettled = await db.any(`
                    SELECT 
                        period,
                        COUNT(*) as count,
                        SUM(amount) as total_amount
                    FROM bet_history
                    WHERE settled = true
                    AND settled_at > NOW() - INTERVAL '1 minute'
                    GROUP BY period
                    ORDER BY period DESC
                    LIMIT 3
                `);
                
                if (recentSettled.length > 0) {
                    console.log(`\n📊 最近1分钟结算的期号：`);
                    recentSettled.forEach(s => {
                        console.log(`  - 期号 ${s.period}: ${s.count}笔, 总金额 ${s.total_amount}元`);
                    });
                }
                
            } catch (error) {
                console.error('监控错误:', error);
            }
        }, 3000);
        
        // 显示初始状态
        console.log('📊 初始状态：');
        const agentBalances = await db.any(`
            SELECT username, balance
            FROM agents
            WHERE username IN ('justin2025A', 'ti2025A')
            ORDER BY username
        `);
        
        agentBalances.forEach(a => {
            console.log(`  - ${a.username}: ${a.balance}元`);
        });
        
        // 保持程序运行
        process.stdin.resume();
        
    } catch (error) {
        console.error('启动监控错误:', error);
        process.exit(1);
    }
}

// 优雅退出
process.on('SIGINT', () => {
    console.log('\n\n监控结束');
    process.exit(0);
});

monitorBettingAndRebate();