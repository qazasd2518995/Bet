import db from './db/config.js';
import fetch from 'node-fetch';

const AGENT_API_URL = 'https://bet-game-agent.onrender.com';

async function debugRebateIssue() {
    try {
        console.log('=== 調試退水問題 ===\n');

        // 1. 選擇最近的期號來測試
        const testPeriod = '20250714546';
        console.log(`測試期號: ${testPeriod}\n`);

        // 2. 檢查該期的所有投注
        const periodBets = await db.any(`
            SELECT 
                bh.*,
                m.username as member_username,
                m.agent_id,
                a.username as agent_username
            FROM bet_history bh
            JOIN members m ON bh.username = m.username
            JOIN agents a ON m.agent_id = a.id
            WHERE bh.period = $1
            ORDER BY bh.username
        `, [testPeriod]);

        console.log(`該期共有 ${periodBets.length} 筆投注\n`);

        // 3. 按用戶匯總投注金額
        const userBetSummary = {};
        for (const bet of periodBets) {
            if (!userBetSummary[bet.username]) {
                userBetSummary[bet.username] = {
                    totalAmount: 0,
                    betCount: 0,
                    agentId: bet.agent_id,
                    agentUsername: bet.agent_username
                };
            }
            userBetSummary[bet.username].totalAmount += parseFloat(bet.amount);
            userBetSummary[bet.username].betCount++;
        }

        console.log('按用戶匯總的投注：');
        for (const [username, data] of Object.entries(userBetSummary)) {
            console.log(`${username}: ${data.betCount} 筆, 總額 ${data.totalAmount}, 代理: ${data.agentUsername}`);
        }

        // 4. 手動測試 justin111 的退水分配
        if (userBetSummary['justin111']) {
            console.log('\n\n=== 手動測試 justin111 的退水分配 ===');
            const testUsername = 'justin111';
            const testBetAmount = userBetSummary[testUsername].totalAmount;
            
            // 獲取代理鏈
            console.log('\n1. 獲取代理鏈...');
            const agentChainResponse = await fetch(`${AGENT_API_URL}/api/agent/member-agent-chain?username=${testUsername}`);
            const agentChainData = await agentChainResponse.json();
            
            if (agentChainData.success) {
                console.log('代理鏈:', JSON.stringify(agentChainData.data, null, 2));
                
                // 計算預期退水
                const agentChain = agentChainData.data;
                const directAgent = agentChain[0];
                const maxRebatePercentage = directAgent.market_type === 'A' ? 0.011 : 0.041;
                const totalRebatePool = testBetAmount * maxRebatePercentage;
                
                console.log(`\n2. 退水計算:`);
                console.log(`總投注額: ${testBetAmount}`);
                console.log(`盤口類型: ${directAgent.market_type}`);
                console.log(`最大退水率: ${(maxRebatePercentage * 100).toFixed(1)}%`);
                console.log(`總退水池: ${totalRebatePool.toFixed(2)}`);
                
                // 嘗試手動調用退水分配
                console.log('\n3. 測試退水分配 API...');
                
                // justin2025A 應得退水
                const justin2025ARebate = testBetAmount * 0.00005; // 0.005%
                console.log(`\n測試分配給 justin2025A: ${justin2025ARebate.toFixed(2)}`);
                
                const rebateResponse1 = await fetch(`${AGENT_API_URL}/api/agent/allocate-rebate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        agentId: agentChain[0].id,
                        agentUsername: 'justin2025A',
                        rebateAmount: justin2025ARebate,
                        memberUsername: testUsername,
                        betAmount: testBetAmount,
                        reason: testPeriod
                    })
                });
                
                const rebateResult1 = await rebateResponse1.json();
                console.log('API 響應:', rebateResult1);
                
                // ti2025A 應得退水
                const ti2025ARebate = testBetAmount * 0.01095; // 1.095%
                console.log(`\n測試分配給 ti2025A: ${ti2025ARebate.toFixed(2)}`);
                
                const rebateResponse2 = await fetch(`${AGENT_API_URL}/api/agent/allocate-rebate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        agentId: agentChain[1].id,
                        agentUsername: 'ti2025A',
                        rebateAmount: ti2025ARebate,
                        memberUsername: testUsername,
                        betAmount: testBetAmount,
                        reason: testPeriod
                    })
                });
                
                const rebateResult2 = await rebateResponse2.json();
                console.log('API 響應:', rebateResult2);
                
            } else {
                console.log('獲取代理鏈失敗:', agentChainData.message);
            }
        }

        // 5. 檢查退水記錄
        console.log('\n\n=== 檢查退水記錄 ===');
        const rebateRecords = await db.any(`
            SELECT 
                tr.*,
                CASE 
                    WHEN tr.user_type = 'agent' THEN a.username
                END as username
            FROM transaction_records tr
            LEFT JOIN agents a ON tr.user_type = 'agent' AND tr.user_id = a.id
            WHERE tr.period = $1::text
                AND tr.transaction_type = 'rebate'
            ORDER BY tr.created_at DESC
        `, [testPeriod]);

        if (rebateRecords.length > 0) {
            console.log(`找到 ${rebateRecords.length} 筆退水記錄：`);
            for (const record of rebateRecords) {
                console.log(`${record.username}: ${record.amount} (${record.created_at})`);
            }
        } else {
            console.log('沒有找到退水記錄');
        }

    } catch (error) {
        console.error('錯誤:', error);
    } finally {
        process.exit(0);
    }
}

debugRebateIssue();