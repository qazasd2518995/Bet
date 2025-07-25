import db from './db/config.js';

async function monitorBettingAndRebate() {
    try {
        console.log('=== 開始監控下注和退水機制 ===\n');
        console.log('請使用 justin111 / aaaa00 進行下注測試\n');
        console.log('監控中... (按 Ctrl+C 結束)\n');
        
        let lastBetId = 0;
        let lastRebateId = 0;
        
        // 獲取最新的ID
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
        
        // 每3秒檢查一次
        setInterval(async () => {
            try {
                // 檢查新的下注
                const newBets = await db.any(`
                    SELECT * FROM bet_history
                    WHERE id > $1
                    ORDER BY id ASC
                `, [lastBetId]);
                
                if (newBets.length > 0) {
                    console.log(`\n🎲 發現 ${newBets.length} 筆新下注：`);
                    newBets.forEach(bet => {
                        console.log(`  - [${new Date(bet.created_at).toLocaleTimeString()}] ${bet.username} 下注 ${bet.amount}元 於 ${bet.bet_type}/${bet.bet_value} (期號: ${bet.period})`);
                        lastBetId = bet.id;
                    });
                }
                
                // 檢查新的退水
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
                    console.log(`\n💰 發現 ${newRebates.length} 筆新退水：`);
                    newRebates.forEach(rebate => {
                        console.log(`  - [${new Date(rebate.created_at).toLocaleTimeString()}] ${rebate.agent_name} 獲得 ${rebate.amount}元 退水 (期號: ${rebate.period}, 會員: ${rebate.member_username})`);
                        lastRebateId = rebate.id;
                    });
                }
                
                // 檢查最新的結算狀態
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
                    console.log(`\n📊 最近1分鐘結算的期號：`);
                    recentSettled.forEach(s => {
                        console.log(`  - 期號 ${s.period}: ${s.count}筆, 總金額 ${s.total_amount}元`);
                    });
                }
                
            } catch (error) {
                console.error('監控錯誤:', error);
            }
        }, 3000);
        
        // 顯示初始狀態
        console.log('📊 初始狀態：');
        const agentBalances = await db.any(`
            SELECT username, balance
            FROM agents
            WHERE username IN ('justin2025A', 'ti2025A')
            ORDER BY username
        `);
        
        agentBalances.forEach(a => {
            console.log(`  - ${a.username}: ${a.balance}元`);
        });
        
        // 保持程序運行
        process.stdin.resume();
        
    } catch (error) {
        console.error('啟動監控錯誤:', error);
        process.exit(1);
    }
}

// 優雅退出
process.on('SIGINT', () => {
    console.log('\n\n監控結束');
    process.exit(0);
});

monitorBettingAndRebate();