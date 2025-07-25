// test-settlement-logic.js - 測試結算邏輯問題
import db from './db/config.js';

// 複製improved-settlement-system.js中的checkWin函數來測試
function checkWin(bet, winResult) {
    console.log(`🔍 測試checkWin: bet=${JSON.stringify(bet)}, winResult=${JSON.stringify(winResult)}`);
    
    if (!winResult || !winResult.positions) {
        console.log('❌ winResult無效或缺少positions');
        return false;
    }
    
    switch (bet.bet_type) {
        case 'number':
            // 號碼投注：檢查對應位置的號碼
            const result = winResult.positions[bet.position - 1] === parseInt(bet.bet_value);
            console.log(`   位置${bet.position}的號碼: ${winResult.positions[bet.position - 1]}, 投注號碼: ${bet.bet_value}, 結果: ${result}`);
            return result;
            
        default:
            console.log(`   未知投注類型: ${bet.bet_type}`);
            return false;
    }
}

async function testSettlementLogic() {
    console.log('🧪 測試期號219結算邏輯問題...\n');
    
    try {
        // 1. 獲取開獎結果
        const dbResult = await db.one(`
            SELECT period, result
            FROM result_history
            WHERE period = 20250714219
        `);
        
        console.log('📊 數據庫開獎結果：');
        console.log(`期號: ${dbResult.period}`);
        console.log(`原始結果: ${dbResult.result}`);
        console.log(`數據類型: ${typeof dbResult.result}`);
        
        // 2. 模擬backend.js的數據處理
        let newResult = [];
        if (Array.isArray(dbResult.result)) {
            newResult = dbResult.result;
        } else if (typeof dbResult.result === 'string') {
            newResult = dbResult.result.split(',').map(n => parseInt(n.trim()));
        } else {
            newResult = dbResult.result;
        }
        
        console.log(`\n🔄 Backend.js處理後的newResult: [${newResult.join(',')}]`);
        console.log(`第7名號碼: ${newResult[6]}`);
        
        // 3. 模擬修復前的調用 (可能導致錯誤)
        console.log('\n❌ 修復前的調用 - settleBets(period, newResult):');
        const oldFormatWinResult = newResult;  // 直接傳數組
        console.log(`傳遞給checkWin的winResult: ${JSON.stringify(oldFormatWinResult)}`);
        console.log(`winResult.positions: ${oldFormatWinResult.positions} (undefined!)`);
        
        // 4. 模擬修復後的調用
        console.log('\n✅ 修復後的調用 - settleBets(period, { positions: newResult }):');
        const newFormatWinResult = { positions: newResult };
        console.log(`傳遞給checkWin的winResult: ${JSON.stringify(newFormatWinResult)}`);
        console.log(`winResult.positions[6]: ${newFormatWinResult.positions[6]}`);
        
        // 5. 測試實際的投注記錄
        const problematicBets = await db.any(`
            SELECT id, username, bet_type, bet_value, position, amount, odds, win, win_amount
            FROM bet_history
            WHERE id IN (1652, 1654)
            ORDER BY id
        `);
        
        console.log('\n🎯 測試問題投注的結算邏輯：');
        
        problematicBets.forEach(bet => {
            console.log(`\n投注ID ${bet.id} (${bet.username}, 第${bet.position}名=${bet.bet_value}號):`);
            console.log(`當前結果: ${bet.win ? '中獎' : '未中獎'} $${bet.win_amount || 0}`);
            
            // 使用修復前的格式測試 (錯誤格式)
            console.log('\n  使用錯誤格式測試 (array as winResult):');
            try {
                const wrongResult = checkWin(bet, oldFormatWinResult);
                console.log(`  錯誤格式結果: ${wrongResult ? '中獎' : '未中獎'}`);
            } catch (e) {
                console.log(`  錯誤格式異常: ${e.message}`);
            }
            
            // 使用修復後的格式測試 (正確格式)
            console.log('\n  使用正確格式測試 ({ positions: array }):');
            const correctResult = checkWin(bet, newFormatWinResult);
            console.log(`  正確格式結果: ${correctResult ? '中獎' : '未中獎'}`);
            
            console.log(`  應該結果: ${newResult[bet.position - 1] == bet.bet_value ? '中獎' : '未中獎'}`);
        });
        
        // 6. 檢查可能的舊結算函數調用
        console.log('\n🔍 檢查可能的問題源頭：');
        
        // 檢查backend.js是否還有舊的結算調用
        console.log('1. 檢查是否同時調用了新舊結算函數');
        console.log('2. 檢查數據格式轉換時機');
        console.log('3. 檢查是否有並發結算問題');
        
        // 7. 檢查settlement_logs看實際結算使用的數據
        try {
            const settlementLog = await db.oneOrNone(`
                SELECT settlement_details
                FROM settlement_logs
                WHERE period = 20250714219
                ORDER BY created_at DESC
                LIMIT 1
            `);
            
            if (settlementLog && settlementLog.settlement_details) {
                console.log('\n📋 實際結算記錄：');
                const details = JSON.parse(settlementLog.settlement_details);
                const relevantBets = details.filter(d => d.betId === 1652 || d.betId === 1654);
                
                relevantBets.forEach(detail => {
                    console.log(`ID ${detail.betId}: ${detail.isWin ? '判為中獎' : '判為未中獎'}, 金額: $${detail.winAmount || 0}`);
                });
            }
        } catch (e) {
            console.log('settlement_logs檢查失敗:', e.message);
        }
        
        // 8. 分析可能的混淆來源
        console.log('\n⚠️ 可能的問題來源：');
        console.log('1. 如果使用舊格式 (直接傳數組)：');
        console.log('   - winResult.positions = undefined');
        console.log('   - checkWin會return false (所有投注都未中獎)');
        console.log('   - 但某些投注卻被判為中獎 → 可能有其他結算邏輯');
        
        console.log('\n2. 如果有多個結算系統同時運行：');
        console.log('   - 新系統使用正確格式');
        console.log('   - 舊系統使用錯誤邏輯');
        console.log('   - 結果被覆寫導致混亂');
        
        console.log('\n3. 如果有數據競爭條件：');
        console.log('   - 結算時讀取了錯誤的開獎結果');
        console.log('   - 或者使用了緩存的舊結果');
        
        console.log('\n🔧 建議的修復措施：');
        console.log('1. 確保只有一個結算系統在運行');
        console.log('2. 添加詳細的日誌記錄結算過程');
        console.log('3. 驗證數據格式轉換的正確性');
        console.log('4. 實施結算前的數據驗證');
        
    } catch (error) {
        console.error('測試過程中發生錯誤:', error);
    } finally {
        await db.$pool.end();
    }
}

// 執行測試
testSettlementLogic();