import { enhancedSettlement } from './enhanced-settlement-system.js';
import db from './db/config.js';

async function testRebateSystem() {
    try {
        const period = '20250715043';
        console.log(`測試期號 ${period} 的退水系統...`);
        
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
        
        console.log('\n=== 調用結算系統 ===');
        const result = await enhancedSettlement(period, winResult);
        console.log('結算結果:', result);
        
        // 檢查退水記錄
        await new Promise(resolve => setTimeout(resolve, 2000)); // 等待2秒
        
        const rebates = await db.any(`
            SELECT * FROM transaction_records
            WHERE transaction_type = 'rebate'
            AND period = $1
            ORDER BY created_at DESC
        `, [period]);
        
        console.log(`\n=== 退水記錄 ===`);
        if (rebates.length > 0) {
            console.log(`找到 ${rebates.length} 筆退水記錄`);
            rebates.forEach(r => {
                console.log(`- 用戶ID: ${r.user_id}, 金額: ${r.amount}, 時間: ${new Date(r.created_at).toLocaleString()}`);
            });
        } else {
            console.log('❌ 沒有找到退水記錄');
            
            // 檢查日誌輸出
            console.log('\n檢查可能的錯誤：');
            console.log('1. 檢查 enhanced-settlement-system.js 的日誌輸出');
            console.log('2. 檢查代理系統 API 是否正常運行');
            console.log('3. 檢查網路連接是否正常');
        }
        
    } catch (error) {
        console.error('測試時發生錯誤:', error);
    } finally {
        process.exit(0);
    }
}

testRebateSystem();