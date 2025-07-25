import { enhancedSettlement } from './enhanced-settlement-system.js';
import db from './db/config.js';

async function processRecentMissingRebates() {
    try {
        console.log('=== 尋找最近30分鐘內需要處理退水的期號 ===\n');
        
        // 找出最近30分鐘內已結算但沒有退水的下注
        const missingRebates = await db.any(`
            SELECT DISTINCT 
                bh.period,
                COUNT(DISTINCT bh.id) as bet_count,
                SUM(bh.amount) as total_amount,
                MAX(bh.created_at) as latest_bet_time
            FROM bet_history bh
            WHERE bh.settled = true
            AND bh.created_at > NOW() - INTERVAL '30 minutes'
            AND NOT EXISTS (
                SELECT 1 
                FROM transaction_records tr 
                WHERE tr.transaction_type = 'rebate' 
                AND tr.period = bh.period::text
            )
            GROUP BY bh.period
            ORDER BY bh.period DESC
        `);
        
        console.log(`找到 ${missingRebates.length} 個期號需要處理退水`);
        
        for (const item of missingRebates) {
            console.log(`\n=== 處理期號 ${item.period} ===`);
            console.log(`下注數: ${item.bet_count}, 總金額: ${item.total_amount}`);
            console.log(`最後下注時間: ${item.latest_bet_time}`);
            
            // 獲取開獎結果
            const drawResult = await db.oneOrNone(`
                SELECT * FROM result_history 
                WHERE period = $1
            `, [item.period]);
            
            if (!drawResult) {
                console.log(`❌ 期號 ${item.period} 找不到開獎結果，跳過`);
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
            
            console.log('開獎結果:', winResult.positions.join(', '));
            
            // 調用結算系統處理退水
            console.log('呼叫結算系統...');
            const result = await enhancedSettlement(item.period, winResult);
            console.log('結算結果:', result);
            
            // 檢查退水是否成功
            const newRebates = await db.any(`
                SELECT 
                    tr.amount,
                    a.username as agent_name,
                    tr.rebate_percentage
                FROM transaction_records tr
                JOIN agents a ON tr.user_id = a.id
                WHERE tr.transaction_type = 'rebate'
                AND tr.period = $1
                ORDER BY tr.created_at DESC
            `, [item.period]);
            
            if (newRebates.length > 0) {
                console.log(`✅ 成功新增 ${newRebates.length} 筆退水記錄:`);
                newRebates.forEach(r => {
                    console.log(`   ${r.agent_name}: ${r.amount} 元 (${(r.rebate_percentage * 100).toFixed(1)}%)`);
                });
            } else {
                console.log('❌ 沒有新增退水記錄');
            }
            
            // 等待一下避免太快
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // 顯示摘要
        console.log('\n=== 處理摘要 ===');
        const summary = await db.any(`
            SELECT 
                a.username,
                COUNT(tr.id) as rebate_count,
                SUM(tr.amount) as total_rebate
            FROM agents a
            LEFT JOIN transaction_records tr ON 
                tr.user_id = a.id 
                AND tr.transaction_type = 'rebate'
                AND tr.created_at > NOW() - INTERVAL '5 minutes'
            WHERE a.username IN ('justin2025A', 'ti2025A')
            GROUP BY a.username
        `);
        
        summary.forEach(s => {
            console.log(`${s.username}: ${s.rebate_count || 0} 筆新退水, 總額 ${s.total_rebate || 0} 元`);
        });
        
        // 顯示最終餘額
        console.log('\n=== 代理最終餘額 ===');
        const agents = await db.any(`
            SELECT username, balance FROM agents
            WHERE username IN ('justin2025A', 'ti2025A')
            ORDER BY username
        `);
        
        agents.forEach(a => {
            console.log(`${a.username}: ${a.balance} 元`);
        });
        
    } catch (error) {
        console.error('處理時發生錯誤:', error);
    } finally {
        process.exit(0);
    }
}

processRecentMissingRebates();