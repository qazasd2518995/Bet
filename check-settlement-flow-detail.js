// 檢查結算流程細節
import db from './db/config.js';

async function checkSettlementFlowDetail() {
    console.log('🔍 檢查結算流程細節\n');

    try {
        // 1. 查找最近有號碼投注錯誤的期號
        console.log('📌 步驟1：查找最近可能有結算錯誤的期號...');
        const errorCases = await db.manyOrNone(`
            SELECT DISTINCT
                bh.period,
                bh.position,
                bh.bet_value,
                bh.win,
                bh.win_amount,
                CASE 
                    WHEN bh.position = '1' THEN rh.position_1
                    WHEN bh.position = '2' THEN rh.position_2
                    WHEN bh.position = '3' THEN rh.position_3
                    WHEN bh.position = '4' THEN rh.position_4
                    WHEN bh.position = '5' THEN rh.position_5
                    WHEN bh.position = '6' THEN rh.position_6
                    WHEN bh.position = '7' THEN rh.position_7
                    WHEN bh.position = '8' THEN rh.position_8
                    WHEN bh.position = '9' THEN rh.position_9
                    WHEN bh.position = '10' THEN rh.position_10
                END as actual_number
            FROM bet_history bh
            JOIN result_history rh ON bh.period = rh.period
            WHERE bh.bet_type = 'number'
            AND bh.settled = true
            AND bh.created_at > NOW() - INTERVAL '1 day'
            ORDER BY bh.period DESC
            LIMIT 20
        `);

        console.log(`\n檢查最近20筆號碼投注：`);
        let errorCount = 0;
        
        errorCases.forEach(bet => {
            const shouldWin = parseInt(bet.bet_value) === parseInt(bet.actual_number);
            const isCorrect = bet.win === shouldWin;
            
            if (!isCorrect) {
                errorCount++;
                console.log(`\n❌ 錯誤案例：`);
                console.log(`- 期號：${bet.period}`);
                console.log(`- 位置：第${bet.position}名`);
                console.log(`- 投注號碼：${bet.bet_value}`);
                console.log(`- 開獎號碼：${bet.actual_number}`);
                console.log(`- 系統判定：${bet.win ? '中獎' : '未中獎'}`);
                console.log(`- 應該判定：${shouldWin ? '中獎' : '未中獎'}`);
                console.log(`- 錯誤獎金：${bet.win_amount}`);
            }
        });
        
        console.log(`\n總共發現 ${errorCount} 個結算錯誤`);

        // 2. 檢查結算函數的調用順序
        console.log('\n📌 步驟2：檢查結算函數在 backend.js 中的實際使用...');
        
        // 這裡模擬結算邏輯的問題
        console.log('\n可能的問題原因：');
        console.log('1. 資料庫中 result_history 的 position_X 欄位可能在某些情況下被錯誤更新');
        console.log('2. 結算時可能存在並發問題，導致讀取到錯誤的開獎結果');
        console.log('3. 可能有多個結算函數同時運行，導致數據混亂');

        // 3. 建議修復方案
        console.log('\n📌 步驟3：建議的修復方案...');
        console.log('\n在 enhanced-settlement-system.js 中添加更嚴格的驗證：');
        console.log(`
// 在 checkBetWinEnhanced 函數的號碼投注部分添加
if (betType === 'number' && bet.position) {
    const position = parseInt(bet.position);
    const betNumber = parseInt(betValue);
    
    // 添加詳細日誌
    const actualPositions = winResult.positions;
    settlementLog.info(\`號碼投注驗證: 投注ID=\${bet.id}, 位置=\${position}, 投注號碼=\${betNumber}\`);
    settlementLog.info(\`開獎結果陣列: \${JSON.stringify(actualPositions)}\`);
    
    if (position < 1 || position > 10 || isNaN(betNumber)) {
        settlementLog.warn(\`無效投注: position=\${position}, betNumber=\${betNumber}\`);
        return { isWin: false, reason: '無效的位置或號碼' };
    }
    
    const winningNumber = actualPositions[position - 1];
    const isWin = parseInt(winningNumber) === betNumber;
    
    // 添加結果驗證日誌
    settlementLog.info(\`結算結果: 位置\${position}開出\${winningNumber}, 投注\${betNumber}, 判定=\${isWin ? '中獎' : '未中獎'}\`);
    
    // 額外驗證：確保開獎號碼在有效範圍內
    if (winningNumber < 1 || winningNumber > 10) {
        settlementLog.error(\`異常開獎號碼: position=\${position}, number=\${winningNumber}\`);
        throw new Error(\`異常開獎號碼: 第\${position}名開出\${winningNumber}\`);
    }
    
    return {
        isWin: isWin,
        reason: \`位置\${position}開出\${winningNumber}，投注\${betNumber}\${isWin ? '中獎' : '未中'}\`,
        odds: bet.odds || 9.85
    };
}
`);

        // 4. 檢查是否有重複結算
        console.log('\n📌 步驟4：檢查是否有重複結算的情況...');
        const duplicateSettlements = await db.manyOrNone(`
            SELECT 
                period,
                username,
                COUNT(*) as settlement_count,
                SUM(CASE WHEN transaction_type = 'win' THEN amount ELSE 0 END) as total_win
            FROM transaction_records
            WHERE transaction_type = 'win'
            AND created_at > NOW() - INTERVAL '1 day'
            GROUP BY period, username
            HAVING COUNT(*) > 1
            ORDER BY period DESC
            LIMIT 10
        `);

        if (duplicateSettlements.length > 0) {
            console.log('\n⚠️ 發現重複結算：');
            duplicateSettlements.forEach(dup => {
                console.log(`- 期號 ${dup.period}, 用戶 ${dup.username}: ${dup.settlement_count} 次結算, 總獎金 ${dup.total_win}`);
            });
        } else {
            console.log('\n✅ 沒有發現重複結算');
        }

    } catch (error) {
        console.error('檢查失敗：', error);
    }
}

// 執行檢查
checkSettlementFlowDetail().then(() => {
    console.log('\n✅ 檢查完成');
    process.exit(0);
}).catch(error => {
    console.error('❌ 錯誤：', error);
    process.exit(1);
});