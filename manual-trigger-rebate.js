import { enhancedSettlement } from './enhanced-settlement-system.js';
import db from './db/config.js';

async function manualTriggerRebate() {
    try {
        const period = '20250715004';
        console.log(`手動觸發期號 ${period} 的退水處理...`);
        
        // 獲取開獎結果
        const drawResult = await db.oneOrNone(`
            SELECT * FROM result_history 
            WHERE period = $1
        `, [period]);
        
        if (!drawResult) {
            console.error('找不到開獎結果');
            return;
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
        
        console.log('開獎結果:', winResult);
        
        // 調用結算系統（會自動檢查並處理退水）
        const result = await enhancedSettlement(period, winResult);
        
        console.log('\n結算結果:', result);
        
        // 檢查退水記錄
        const rebates = await db.any(`
            SELECT * FROM transaction_records
            WHERE transaction_type = 'rebate'
            AND description LIKE $1
            ORDER BY created_at DESC
        `, [`%${period}%`]);
        
        if (rebates.length > 0) {
            console.log(`\n找到 ${rebates.length} 筆退水記錄:`);
            rebates.forEach(r => {
                console.log(`- 用戶ID: ${r.user_id}, 金額: ${r.amount}, 描述: ${r.description}`);
            });
        } else {
            console.log('\n沒有找到退水記錄');
        }
        
    } catch (error) {
        console.error('處理時發生錯誤:', error);
    } finally {
        process.exit(0);
    }
}

manualTriggerRebate();