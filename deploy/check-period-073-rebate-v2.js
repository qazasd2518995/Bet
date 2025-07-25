import db from './db/config.js';

async function checkPeriod073Rebate() {
    try {
        console.log('=== 检查期号 20250715073 的退水情况 ===\n');
        
        // 1. 检查这期的下注记录
        const bets = await db.any(`
            SELECT 
                id,
                username,
                amount,
                bet_type,
                bet_value,
                settled,
                result,
                payout,
                created_at
            FROM bet_history
            WHERE period = '20250715073'
            ORDER BY created_at DESC
        `);
        
        console.log(`期号 20250715073 共有 ${bets.length} 笔下注：`);
        bets.forEach(bet => {
            const winLoss = bet.payout > 0 ? bet.payout - bet.amount : -bet.amount;
            console.log(`- ${bet.username}: ${bet.amount}元, ${bet.bet_type}/${bet.bet_value}, ${bet.settled ? '已结算' : '未结算'}, 结果: ${bet.result || '待定'}, 输赢: ${winLoss}`);
        });
        
        // 2. 检查退水记录
        console.log('\n检查退水记录：');
        const rebates = await db.any(`
            SELECT 
                tr.*,
                a.username as agent_name
            FROM transaction_records tr
            JOIN agents a ON tr.user_id = a.id
            WHERE tr.transaction_type = 'rebate'
            AND (tr.period = '20250715073' OR tr.period LIKE '%20250715073%')
            ORDER BY tr.created_at DESC
        `);
        
        if (rebates.length > 0) {
            console.log(`找到 ${rebates.length} 笔退水记录：`);
            rebates.forEach(r => {
                console.log(`- ${r.agent_name}: ${r.amount}元, period: "${r.period}", 会员: ${r.member_username}`);
            });
        } else {
            console.log('❌ 没有找到任何退水记录');
        }
        
        // 3. 检查是否有其他格式的退水记录
        console.log('\n检查其他可能的退水记录格式：');
        const recentRebates = await db.any(`
            SELECT 
                tr.period,
                COUNT(*) as count,
                SUM(tr.amount) as total
            FROM transaction_records tr
            WHERE tr.transaction_type = 'rebate'
            AND tr.created_at > NOW() - INTERVAL '1 hour'
            GROUP BY tr.period
            ORDER BY tr.period DESC
            LIMIT 10
        `);
        
        console.log('最近1小时的退水记录：');
        recentRebates.forEach(r => {
            console.log(`- period: "${r.period}", ${r.count}笔, 总额: ${r.total}`);
        });
        
        // 4. 手动触发这期的退水
        console.log('\n尝试手动触发退水...');
        const drawResult = await db.oneOrNone(`
            SELECT * FROM result_history
            WHERE period = '20250715073'
        `);
        
        if (drawResult) {
            console.log('✅ 找到开奖结果');
            
            // 检查是否需要处理退水
            const needRebate = await db.oneOrNone(`
                SELECT COUNT(*) as count
                FROM bet_history
                WHERE period = '20250715073'
                AND settled = true
                AND NOT EXISTS (
                    SELECT 1 FROM transaction_records
                    WHERE transaction_type = 'rebate'
                    AND period = '20250715073'
                )
            `);
            
            if (needRebate && needRebate.count > 0) {
                console.log(`需要处理 ${needRebate.count} 笔下注的退水`);
                
                // 导入并执行结算
                const { enhancedSettlement } = await import('./enhanced-settlement-system.js');
                const winResult = {
                    positions: [
                        drawResult.position_1,
                        drawResult.position_2,
                        drawResult.position_3,
                        drawResult.position_4,
                        drawResult.position_5,
                        drawResult.position_6,
                        drawResult.position_7,
                        drawResult.position_8,
                        drawResult.position_9,
                        drawResult.position_10
                    ]
                };
                
                console.log('调用结算系统...');
                const result = await enhancedSettlement('20250715073', winResult);
                console.log('结算结果:', result);
                
                // 再次检查退水
                const newRebates = await db.any(`
                    SELECT 
                        tr.*,
                        a.username as agent_name
                    FROM transaction_records tr
                    JOIN agents a ON tr.user_id = a.id
                    WHERE tr.transaction_type = 'rebate'
                    AND tr.period = '20250715073'
                    ORDER BY tr.created_at DESC
                `);
                
                if (newRebates.length > 0) {
                    console.log(`\n✅ 成功产生 ${newRebates.length} 笔退水：`);
                    newRebates.forEach(r => {
                        console.log(`- ${r.agent_name}: ${r.amount}元`);
                    });
                }
            }
        } else {
            console.log('❌ 没有找到开奖结果');
        }
        
        // 5. 检查代理余额变化
        console.log('\n检查代理余额：');
        const agents = await db.any(`
            SELECT username, balance
            FROM agents
            WHERE username IN ('justin2025A', 'ti2025A')
            ORDER BY username
        `);
        
        agents.forEach(a => {
            console.log(`${a.username}: ${a.balance}元`);
        });
        
    } catch (error) {
        console.error('检查错误:', error);
    } finally {
        process.exit(0);
    }
}

checkPeriod073Rebate();