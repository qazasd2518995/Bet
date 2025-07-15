import { enhancedSettlement } from './enhanced-settlement-system.js';
import db from './db/config.js';

async function processMissingRebates() {
    try {
        // 需要處理的期號
        const periods = ['20250715042', '20250715041', '20250715040', '20250715039', '20250715037'];
        
        for (const period of periods) {
            console.log(`\n=== 處理期號 ${period} ===`);
            
            // 檢查是否已有退水
            const existingRebate = await db.oneOrNone(`
                SELECT COUNT(*) as count 
                FROM transaction_records
                WHERE transaction_type = 'rebate' 
                AND (period = $1 OR period LIKE $2)
            `, [period, `%${period}%`]);
            
            if (existingRebate && parseInt(existingRebate.count) > 0) {
                console.log(`期號 ${period} 已有退水記錄，跳過`);
                continue;
            }
            
            // 獲取開獎結果
            const drawResult = await db.oneOrNone(`
                SELECT * FROM result_history 
                WHERE period = $1
            `, [period]);
            
            if (!drawResult) {
                console.log(`期號 ${period} 找不到開獎結果，跳過`);
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
            
            // 調用結算系統處理退水
            const result = await enhancedSettlement(period, winResult);
            console.log(`結算結果:`, result);
            
            // 等待一下避免太快
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // 檢查最終餘額
        console.log('\n=== 最終代理餘額 ===');
        const agents = await db.any(`
            SELECT username, balance FROM agents
            WHERE username IN ('justin2025A', 'ti2025A')
        `);
        
        agents.forEach(a => {
            console.log(`${a.username}: ${a.balance}`);
        });
        
    } catch (error) {
        console.error('處理時發生錯誤:', error);
    } finally {
        process.exit(0);
    }
}

processMissingRebates();