import db from './db/config.js';
import { enhancedSettlement } from './enhanced-settlement-system.js';

async function manualTestRebate() {
    try {
        console.log('=== 手動測試退水分配 ===\n');

        // 選擇一個最近的已開獎期號
        const testPeriod = '20250714546';
        
        // 獲取該期的開獎結果
        const drawResult = await db.oneOrNone(`
            SELECT * FROM result_history 
            WHERE period = $1
        `, [testPeriod]);

        if (!drawResult) {
            console.log(`期號 ${testPeriod} 沒有開獎結果`);
            return;
        }

        console.log(`測試期號: ${testPeriod}`);
        console.log(`開獎結果: ${drawResult.result}\n`);

        // 先檢查該期是否有未結算的注單
        const unsettledBets = await db.any(`
            SELECT * FROM bet_history 
            WHERE period = $1 AND settled = false
        `, [testPeriod]);

        if (unsettledBets.length > 0) {
            console.log(`發現 ${unsettledBets.length} 筆未結算注單，將進行結算...`);
            
            // 將注單標記為未結算以便測試
            await db.none(`
                UPDATE bet_history 
                SET settled = false, win = null, win_amount = null, settled_at = null
                WHERE period = $1
            `, [testPeriod]);
            
            console.log('已將注單重置為未結算狀態\n');
        }

        // 調用增強結算系統
        console.log('開始結算並處理退水...\n');
        const result = await enhancedSettlement(testPeriod, {
            period: testPeriod,
            result: drawResult.result,
            drawnAt: new Date()
        });

        console.log('\n結算結果:', result);

        // 檢查退水記錄
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
                console.log(`\n代理: ${record.username}`);
                console.log(`金額: ${record.amount}`);
                console.log(`餘額變化: ${record.balance_before} -> ${record.balance_after}`);
                console.log(`描述: ${record.description}`);
                console.log(`時間: ${record.created_at}`);
            }
        } else {
            console.log('沒有找到退水記錄');
        }

        // 檢查代理餘額
        console.log('\n\n=== 檢查代理餘額 ===');
        const agents = await db.any(`
            SELECT username, balance, rebate_percentage
            FROM agents
            WHERE username IN ('justin2025A', 'ti2025A')
        `);

        for (const agent of agents) {
            console.log(`${agent.username}: 餘額 ${agent.balance}, 退水率 ${agent.rebate_percentage}%`);
        }

    } catch (error) {
        console.error('錯誤:', error);
    } finally {
        process.exit(0);
    }
}

manualTestRebate();