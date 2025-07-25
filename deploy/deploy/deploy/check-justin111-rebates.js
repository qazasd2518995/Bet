import db from './db/config.js';

async function checkJustin111Rebates() {
    try {
        console.log('=== 檢查 justin111 最近的 1000 投注和退水分配 ===\n');

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
            console.log('找不到 justin111 的 1000 投注記錄');
            return;
        }

        console.log(`\n找到 ${recentBets.length} 筆 1000 投注記錄：`);
        for (const bet of recentBets) {
            console.log(`\n投注ID: ${bet.id}`);
            console.log(`期號: ${bet.period}`);
            console.log(`金額: ${bet.amount}`);
            console.log(`投注內容: ${bet.bet_numbers} (${bet.bet_type})`);
            console.log(`投注時間: ${bet.created_at}`);
            console.log(`是否已結算: ${bet.is_settled ? '是' : '否'}`);
            console.log(`是否中獎: ${bet.win ? '是' : '否'}`);
            console.log(`中獎金額: ${bet.win_amount || 0}`);
            console.log(`結算時間: ${bet.settlement_time || 'N/A'}`);
            console.log(`代理: ${bet.agent_username}`);
            console.log(`會員餘額: ${bet.member_balance}`);
        }

        // 取最近的一筆
        const latestBet = recentBets[0];
        console.log(`\n\n=== 詳細檢查最近的投注 (ID: ${latestBet.id}, 期號: ${latestBet.period}) ===`);

        // 2. 檢查該期的開獎結果
        console.log('\n2. 檢查該期的開獎結果...');
        const result = await db.oneOrNone(`
            SELECT * FROM result_history 
            WHERE period = $1
        `, [latestBet.period]);

        if (result) {
            console.log(`開獎結果: ${result.result}`);
            console.log(`開獎時間: ${result.created_at}`);
        } else {
            console.log('該期尚未開獎');
        }

        // 3. 檢查該期所有的交易記錄（包括退水）
        console.log('\n3. 檢查該期的所有交易記錄...');
        const allTransactions = await db.any(`
            SELECT 
                tr.*,
                a.username as agent_username,
                m.username as member_username
            FROM transaction_records tr
            LEFT JOIN agents a ON tr.agent_id = a.id
            LEFT JOIN members m ON tr.member_id = m.id
            WHERE tr.period = $1::text
            ORDER BY tr.created_at
        `, [latestBet.period.toString()]);

        if (allTransactions.length > 0) {
            console.log(`\n找到 ${allTransactions.length} 筆交易記錄：`);
            for (const tx of allTransactions) {
                console.log(`\n交易ID: ${tx.id}`);
                console.log(`類型: ${tx.type}`);
                console.log(`代理: ${tx.agent_username || 'N/A'}`);
                console.log(`會員: ${tx.member_username || 'N/A'}`);
                console.log(`金額: ${tx.amount}`);
                console.log(`描述: ${tx.description}`);
                console.log(`創建時間: ${tx.created_at}`);
            }
            
            // 特別顯示退水相關的交易
            const rebateTransactions = allTransactions.filter(tx => 
                tx.type === 'rebate' || tx.type === 'parent_rebate'
            );
            
            if (rebateTransactions.length > 0) {
                console.log(`\n其中退水相關交易 ${rebateTransactions.length} 筆`);
            } else {
                console.log('\n⚠️ 沒有找到退水相關的交易記錄！');
            }
        } else {
            console.log('該期沒有任何交易記錄');
        }

        // 4. 檢查代理的當前餘額和退水設定
        console.log('\n4. 檢查相關代理的餘額和退水設定...');
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

        console.log('\n代理資訊：');
        for (const agent of agents) {
            console.log(`\n代理: ${agent.username}`);
            console.log(`餘額: ${agent.balance}`);
            console.log(`退水率: ${agent.rebate_percentage}%`);
            console.log(`上級: ${agent.parent_username || '無'} (退水率: ${agent.parent_rebate || 0}%)`);
        }

        // 5. 檢查最近幾期的退水情況
        console.log('\n5. 檢查最近幾期的退水情況...');
        const recentPeriodRebates = await db.any(`
            SELECT 
                period,
                type,
                COUNT(*) as count,
                SUM(amount) as total_amount
            FROM transaction_records
            WHERE type IN ('rebate', 'parent_rebate')
                AND created_at >= NOW() - INTERVAL '7 days'
            GROUP BY period, type
            ORDER BY period DESC
            LIMIT 10
        `);

        if (recentPeriodRebates.length > 0) {
            console.log('\n最近幾期的退水情況：');
            for (const pr of recentPeriodRebates) {
                console.log(`期號 ${pr.period}: ${pr.type} - ${pr.count} 筆, 總額 ${pr.total_amount}`);
            }
        } else {
            console.log('\n最近7天沒有任何退水記錄');
        }

        // 6. 檢查退水計算邏輯
        console.log('\n6. 計算預期的退水金額...');
        if (latestBet.is_settled) {
            // 找出所有相關代理的階層
            const memberAgent = agents.find(a => a.id === latestBet.agent_id);
            console.log(`\n投注會員的直屬代理: ${memberAgent?.username || 'Unknown'}`);
            
            // 計算各級應得退水
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
            
            console.log('\n預期的退水分配：');
            for (const expected of expectedRebates) {
                console.log(`${expected.agent}: ${expected.rebateDiff}% = ${expected.amount}`);
            }
            
            // 計算總退水金額
            const totalExpectedRebate = expectedRebates.reduce((sum, r) => sum + r.amount, 0);
            console.log(`\n總預期退水金額: ${totalExpectedRebate}`);
        } else {
            console.log('\n該投注尚未結算，無法計算退水');
        }

    } catch (error) {
        console.error('錯誤:', error);
    } finally {
        process.exit(0);
    }
}

checkJustin111Rebates();