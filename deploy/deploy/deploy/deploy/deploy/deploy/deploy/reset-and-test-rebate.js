import db from './db/config.js';
import { enhancedSettlement } from './enhanced-settlement-system.js';

async function resetAndTestRebate() {
    try {
        console.log('=== 重置並測試退水分配 ===\n');

        // 選擇一個最近的已開獎期號
        const testPeriod = '20250714546';
        
        // 1. 先將該期的注單重置為未結算
        console.log(`1. 重置期號 ${testPeriod} 的注單為未結算狀態...`);
        const updateResult = await db.result(`
            UPDATE bet_history 
            SET settled = false, win = null, win_amount = null, settled_at = null
            WHERE period = $1
        `, [testPeriod]);
        
        console.log(`已重置 ${updateResult.rowCount} 筆注單\n`);

        // 2. 獲取該期的開獎結果
        const drawResult = await db.oneOrNone(`
            SELECT * FROM result_history 
            WHERE period = $1
        `, [testPeriod]);

        if (!drawResult) {
            console.log(`期號 ${testPeriod} 沒有開獎結果`);
            return;
        }

        console.log(`2. 開獎結果: ${drawResult.result}\n`);

        // 3. 檢查注單狀態
        const bets = await db.any(`
            SELECT * FROM bet_history 
            WHERE period = $1
        `, [testPeriod]);
        
        console.log(`3. 該期共有 ${bets.length} 筆注單`);
        for (const bet of bets) {
            console.log(`   - ID ${bet.id}: ${bet.username}, 金額 ${bet.amount}, 已結算: ${bet.settled}`);
        }

        // 4. 調用增強結算系統
        console.log('\n4. 開始結算並處理退水...\n');
        const result = await enhancedSettlement(testPeriod, {
            period: testPeriod,
            result: drawResult.result,
            drawnAt: new Date()
        });

        console.log('\n結算結果:', result);

        // 5. 檢查退水記錄
        console.log('\n\n5. 檢查退水記錄...');
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
                AND tr.created_at >= NOW() - INTERVAL '1 minute'
            ORDER BY tr.created_at DESC
        `, [testPeriod]);

        if (rebateRecords.length > 0) {
            console.log(`找到 ${rebateRecords.length} 筆新的退水記錄：`);
            for (const record of rebateRecords) {
                console.log(`\n代理: ${record.username}`);
                console.log(`金額: ${record.amount}`);
                console.log(`餘額變化: ${record.balance_before} -> ${record.balance_after}`);
                console.log(`描述: ${record.description}`);
                console.log(`時間: ${record.created_at}`);
            }
        } else {
            console.log('沒有找到新的退水記錄');
        }

        // 6. 檢查代理餘額變化
        console.log('\n\n6. 檢查代理餘額...');
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
        console.error('錯誤詳情:', error.stack);
    } finally {
        process.exit(0);
    }
}

resetAndTestRebate();