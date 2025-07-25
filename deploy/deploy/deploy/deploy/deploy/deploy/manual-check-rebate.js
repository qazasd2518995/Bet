import db from './db/config.js';
import fetch from 'node-fetch';

const AGENT_API_URL = 'https://bet-agent.onrender.com';

async function manuallyProcessRebate() {
    try {
        const period = '20250715004';
        console.log(`手動處理期號 ${period} 的退水...`);
        
        // 獲取該期已結算的注單
        const settledBets = await db.manyOrNone(`
            SELECT DISTINCT username, SUM(amount) as total_amount
            FROM bet_history
            WHERE period = $1 AND settled = true
            GROUP BY username
        `, [period]);
        
        console.log(`找到 ${settledBets.length} 位會員需要處理退水`);
        
        for (const record of settledBets) {
            console.log(`\n處理會員 ${record.username} 的退水，下注金額: ${record.total_amount}`);
            
            // 獲取代理鏈
            const response = await fetch(`${AGENT_API_URL}/api/agent/member-agent-chain?username=${record.username}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            console.log(`API響應狀態: ${response.status}`);
            
            if (!response.ok) {
                console.error(`獲取代理鏈失敗: ${response.status}`);
                const errorText = await response.text();
                console.error(`錯誤詳情: ${errorText}`);
                continue;
            }
            
            const data = await response.json();
            if (data.success && data.agentChain) {
                console.log(`代理鏈: ${data.agentChain.map(a => a.username).join(' -> ')}`);
                
                // 手動分配退水
                const directAgent = data.agentChain[0];
                const maxRebatePercentage = directAgent.market_type === 'A' ? 0.011 : 0.041;
                const totalRebatePool = parseFloat(record.total_amount) * maxRebatePercentage;
                
                console.log(`退水池: ${totalRebatePool.toFixed(2)}元 (${(maxRebatePercentage*100).toFixed(1)}%)`);
                
                // 顯示計算結果
                let remainingRebate = totalRebatePool;
                let distributedPercentage = 0;
                
                for (const agent of data.agentChain) {
                    const rebatePercentage = parseFloat(agent.rebate_percentage);
                    const actualRebatePercentage = Math.max(0, rebatePercentage - distributedPercentage);
                    
                    if (actualRebatePercentage > 0 && remainingRebate > 0.01) {
                        let agentRebateAmount = parseFloat(record.total_amount) * actualRebatePercentage;
                        agentRebateAmount = Math.min(agentRebateAmount, remainingRebate);
                        agentRebateAmount = Math.round(agentRebateAmount * 100) / 100;
                        
                        console.log(`  - ${agent.username}: ${agentRebateAmount.toFixed(2)}元 (${(actualRebatePercentage*100).toFixed(1)}%)`);
                        
                        remainingRebate -= agentRebateAmount;
                        distributedPercentage += actualRebatePercentage;
                    }
                }
                
                if (remainingRebate > 0.01) {
                    console.log(`  - 平台保留: ${remainingRebate.toFixed(2)}元`);
                }
            } else {
                console.error('獲取代理鏈失敗:', data.message);
            }
        }
        
    } catch (error) {
        console.error('處理時發生錯誤:', error);
    } finally {
        process.exit(0);
    }
}

manuallyProcessRebate();