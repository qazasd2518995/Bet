import db from './db/config.js';

async function checkJustin111Rebates() {
    try {
        console.log('=== 检查 justin111 最近的 1000 投注和退水分配 ===\n');

        // 1. 查找 justin111 最近的 1000 投注
        console.log('1. 查找 justin111 最近的 1000 投注...');
        const recentBets = await db.any(`
            SELECT 
                bh.id,
                bh.period,
                bh.amount,
                bh.bet_value as bet_numbers,
                bh.bet_type,
                bh.created_at,
                bh.settled as is_settled,
                bh.win,
                bh.win_amount,
                bh.settled_at as settlement_time,
                bh.username,
                m.balance as member_balance,
                m.agent_id,
                a.username as agent_username
            FROM bet_history bh
            JOIN members m ON bh.username = m.username
            JOIN agents a ON m.agent_id = a.id
            WHERE bh.username = 'justin111'
                AND bh.amount = 1000
            ORDER BY bh.created_at DESC
            LIMIT 10
        `);

        if (recentBets.length === 0) {
            console.log('找不到 justin111 的 1000 投注记录');
            return;
        }

        console.log(`\n找到 ${recentBets.length} 笔 1000 投注记录：`);
        for (const bet of recentBets) {
            console.log(`\n投注ID: ${bet.id}`);
            console.log(`期号: ${bet.period}`);
            console.log(`金额: ${bet.amount}`);
            console.log(`投注内容: ${bet.bet_numbers} (${bet.bet_type})`);
            console.log(`投注时间: ${bet.created_at}`);
            console.log(`是否已结算: ${bet.is_settled ? '是' : '否'}`);
            console.log(`是否中奖: ${bet.win ? '是' : '否'}`);
            console.log(`中奖金额: ${bet.win_amount || 0}`);
            console.log(`结算时间: ${bet.settlement_time || 'N/A'}`);
            console.log(`代理: ${bet.agent_username}`);
            console.log(`会员余额: ${bet.member_balance}`);
        }

        // 取最近的一笔
        const latestBet = recentBets[0];
        console.log(`\n\n=== 详细检查最近的投注 (ID: ${latestBet.id}, 期号: ${latestBet.period}) ===`);

        // 2. 检查该期的开奖结果
        console.log('\n2. 检查该期的开奖结果...');
        const result = await db.oneOrNone(`
            SELECT * FROM result_history 
            WHERE period = $1
        `, [latestBet.period]);

        if (result) {
            console.log(`开奖结果: ${result.result}`);
            console.log(`开奖时间: ${result.created_at}`);
        } else {
            console.log('该期尚未开奖');
        }

        // 3. 检查该期所有的交易记录（包括退水）
        console.log('\n3. 检查该期的所有交易记录...');
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
            WHERE tr.period = $1::text
            ORDER BY tr.created_at
        `, [latestBet.period.toString()]);

        if (allTransactions.length > 0) {
            console.log(`\n找到 ${allTransactions.length} 笔交易记录：`);
            for (const tx of allTransactions) {
                console.log(`\n交易ID: ${tx.id}`);
                console.log(`用户类型: ${tx.user_type}`);
                console.log(`用户: ${tx.username || tx.member_username || 'N/A'}`);
                console.log(`交易类型: ${tx.transaction_type}`);
                console.log(`金额: ${tx.amount}`);
                console.log(`前余额: ${tx.balance_before}`);
                console.log(`后余额: ${tx.balance_after}`);
                console.log(`描述: ${tx.description}`);
                console.log(`创建时间: ${tx.created_at}`);
            }
            
            // 特别显示退水相关的交易
            const rebateTransactions = allTransactions.filter(tx => 
                tx.transaction_type === 'rebate' || tx.transaction_type === 'parent_rebate'
            );
            
            if (rebateTransactions.length > 0) {
                console.log(`\n\n⭐ 其中退水相关交易 ${rebateTransactions.length} 笔`);
                for (const tx of rebateTransactions) {
                    console.log(`\n退水交易 - ${tx.username}: ${tx.transaction_type} = ${tx.amount}`);
                }
            } else {
                console.log('\n\n⚠️ 没有找到退水相关的交易记录！');
            }
        } else {
            console.log('该期没有任何交易记录');
        }

        // 4. 检查代理的当前余额和退水设定
        console.log('\n\n4. 检查相关代理的余额和退水设定...');
        const agents = await db.any(`
            SELECT 
                a.id,
                a.username,
                a.balance,
                a.rebate_percentage,
                a.parent_id,
                pa.username as parent_username,
                pa.rebate_percentage as parent_rebate
            FROM agents a
            LEFT JOIN agents pa ON a.parent_id = pa.id
            WHERE a.username IN ('justin2025A', 'ti2025A')
                OR a.id = (SELECT agent_id FROM members WHERE username = 'justin111')
            ORDER BY a.created_at
        `);

        console.log('\n代理资讯：');
        for (const agent of agents) {
            console.log(`\n代理: ${agent.username}`);
            console.log(`余额: ${agent.balance}`);
            console.log(`退水率: ${agent.rebate_percentage}%`);
            console.log(`上级: ${agent.parent_username || '无'} (退水率: ${agent.parent_rebate || 0}%)`);
        }

        // 5. 检查最近几期的退水情况
        console.log('\n\n5. 检查最近几期的退水情况...');
        const recentPeriodRebates = await db.any(`
            SELECT 
                period,
                transaction_type,
                COUNT(*) as count,
                SUM(amount) as total_amount
            FROM transaction_records
            WHERE transaction_type IN ('rebate', 'parent_rebate')
                AND created_at >= NOW() - INTERVAL '7 days'
            GROUP BY period, transaction_type
            ORDER BY period DESC
            LIMIT 10
        `);

        if (recentPeriodRebates.length > 0) {
            console.log('\n最近几期的退水情况：');
            for (const pr of recentPeriodRebates) {
                console.log(`期号 ${pr.period}: ${pr.transaction_type} - ${pr.count} 笔, 总额 ${pr.total_amount}`);
            }
        } else {
            console.log('\n最近7天没有任何退水记录');
        }

        // 6. 计算预期的退水金额
        console.log('\n\n6. 计算预期的退水金额...');
        if (latestBet.is_settled) {
            // 找出所有相关代理的阶层
            const memberAgent = agents.find(a => a.id === latestBet.agent_id);
            console.log(`\n投注会员的直属代理: ${memberAgent?.username || 'Unknown'}`);
            
            // 计算各级应得退水
            let currentAgent = memberAgent;
            let previousRebate = 0;
            const expectedRebates = [];
            
            while (currentAgent) {
                const rebateDiff = (currentAgent.rebate_percentage || 0) - previousRebate;
                if (rebateDiff > 0) {
                    const rebateAmount = (latestBet.amount * rebateDiff / 100).toFixed(2);
                    expectedRebates.push({
                        agent: currentAgent.username,
                        rebatePercentage: currentAgent.rebate_percentage,
                        rebateDiff: rebateDiff,
                        amount: parseFloat(rebateAmount)
                    });
                }
                previousRebate = currentAgent.rebate_percentage || 0;
                currentAgent = agents.find(a => a.id === currentAgent.parent_id);
            }
            
            console.log('\n预期的退水分配：');
            for (const expected of expectedRebates) {
                console.log(`${expected.agent}: ${expected.rebateDiff}% = ${expected.amount}`);
            }
            
            // 计算总退水金额
            const totalExpectedRebate = expectedRebates.reduce((sum, r) => sum + r.amount, 0);
            console.log(`\n总预期退水金额: ${totalExpectedRebate}`);
        } else {
            console.log('\n该投注尚未结算，无法计算退水');
        }

        // 7. 检查后端日志中的错误
        console.log('\n\n7. 检查是否有退水处理相关的错误...');
        // 这部分需要手动检查日志文件

    } catch (error) {
        console.error('错误:', error);
    } finally {
        process.exit(0);
    }
}

checkJustin111Rebates();