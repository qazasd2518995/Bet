import { enhancedSettlement } from './enhanced-settlement-system.js';
import db from './db/config.js';

async function processLatestRebates() {
    try {
        // 檢查最新需要處理退水的期號
        const needRebates = await db.any(`
            SELECT DISTINCT bh.period, SUM(bh.amount) as total_amount
            FROM bet_history bh
            LEFT JOIN (
                SELECT DISTINCT period 
                FROM transaction_records 
                WHERE transaction_type = 'rebate'
                AND period IS NOT NULL
            ) tr ON bh.period = tr.period
            WHERE bh.username = 'justin111'
            AND bh.settled = true
            AND bh.created_at > NOW() - INTERVAL '30 minutes'
            AND tr.period IS NULL
            GROUP BY bh.period
            ORDER BY bh.period DESC
        `);
        
        console.log(`=== 找到 ${needRebates.length} 個期號需要處理退水 ===`);
        
        for (const item of needRebates) {
            console.log(`\n處理期號 ${item.period}, 下注金額: ${item.total_amount}`);
            
            // 獲取開獎結果
            const drawResult = await db.oneOrNone(`
                SELECT * FROM result_history 
                WHERE period = $1
            `, [item.period]);
            
            if (!drawResult) {
                console.log(`❌ 期號 ${item.period} 找不到開獎結果`);
                continue;
            }
            
            // 構建結果物件
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
            
            console.log('開獎結果:', winResult.positions);
            
            // 調用結算系統處理退水
            const result = await enhancedSettlement(item.period, winResult);
            console.log(`結算結果:`, result);
            
            // 等待一下
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // 檢查退水記錄
        console.log('\n=== 檢查退水結果 ===');
        const newRebates = await db.any(`
            SELECT 
                tr.*,
                a.username as agent_name
            FROM transaction_records tr
            JOIN agents a ON tr.user_id = a.id
            WHERE tr.transaction_type = 'rebate'
            AND tr.member_username = 'justin111'
            AND tr.created_at > NOW() - INTERVAL '5 minutes'
            ORDER BY tr.created_at DESC
        `);
        
        console.log(`找到 ${newRebates.length} 筆新的退水記錄`);
        newRebates.forEach(r => {
            console.log(`${r.agent_name}: ${r.amount} 元, 期號: ${r.period}`);
        });
        
        // 顯示最終餘額
        const agents = await db.any(`
            SELECT username, balance FROM agents
            WHERE username IN ('justin2025A', 'ti2025A')
        `);
        
        console.log('\n=== 代理最終餘額 ===');
        agents.forEach(a => {
            console.log(`${a.username}: ${a.balance}`);
        });
        
    } catch (error) {
        console.error('處理時發生錯誤:', error);
    } finally {
        process.exit(0);
    }
}

processLatestRebates();