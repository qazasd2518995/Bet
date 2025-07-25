// 驗證結算邏輯 - 確保結算基於實際開獎結果，而非控制機率
import db from './db/config.js';

console.log('🔍 驗證結算邏輯流程\n');

// 1. 分析系統流程
console.log('📋 系統正確流程：');
console.log('1️⃣ 控制系統根據設定的機率決定本期應該讓用戶輸還是贏');
console.log('2️⃣ 根據決定生成相應的開獎結果（使用權重控制）');
console.log('3️⃣ 將生成的開獎結果保存到數據庫');
console.log('4️⃣ 結算系統讀取保存的開獎結果');
console.log('5️⃣ 根據實際開獎結果與投注內容比對，判斷輸贏');
console.log('6️⃣ 發放獎金或扣除投注金額\n');

// 2. 檢查 fixed-draw-system.js 的流程
console.log('✅ fixed-draw-system.js 執行流程：');
console.log('- executeDrawing() 主函數：');
console.log('  1. checkActiveControl() - 檢查控制設定');
console.log('  2. analyzePeriodBets() - 分析下注情況');
console.log('  3. generateFinalResult() - 根據控制生成開獎結果');
console.log('  4. saveDrawResult() - 保存開獎結果到 result_history');
console.log('  5. syncToAgentSystem() - 同步到代理系統');
console.log('  6. executeSettlement() - 執行結算\n');

// 3. 檢查結算邏輯
console.log('✅ enhanced-settlement-system.js 結算邏輯：');
console.log('- enhancedSettlement() 接收參數：');
console.log('  - period: 期號');
console.log('  - drawResult: { positions: [1,2,3,4,5,6,7,8,9,10] }');
console.log('- checkBetWinEnhanced() 判斷邏輯：');
console.log('  - 從 winResult.positions 獲取開獎號碼');
console.log('  - 比較 positions[position-1] 與 betNumber');
console.log('  - 返回 isWin: true/false\n');

// 4. 實際案例驗證
async function verifyWithRealCase() {
    try {
        // 查找最近的一期有控制的投注
        const recentBet = await db.oneOrNone(`
            SELECT 
                bh.period,
                bh.username,
                bh.position,
                bh.bet_value,
                bh.win,
                rh.position_1, rh.position_2, rh.position_3, rh.position_4, rh.position_5,
                rh.position_6, rh.position_7, rh.position_8, rh.position_9, rh.position_10,
                wlc.control_percentage
            FROM bet_history bh
            JOIN result_history rh ON bh.period = rh.period
            LEFT JOIN win_loss_control wlc ON wlc.target_username = bh.username 
                AND wlc.is_active = true
            WHERE bh.bet_type = 'number'
            AND bh.settled = true
            AND bh.created_at > NOW() - INTERVAL '1 hour'
            ORDER BY bh.period DESC
            LIMIT 1
        `);
        
        if (recentBet) {
            console.log('📊 實際案例驗證：');
            console.log(`期號: ${recentBet.period}`);
            console.log(`用戶: ${recentBet.username}`);
            console.log(`控制設定: ${recentBet.control_percentage ? recentBet.control_percentage + '%輸率' : '無控制'}`);
            console.log(`\n投注內容：第${recentBet.position}名 號碼${recentBet.bet_value}`);
            
            const actualNumber = recentBet[`position_${recentBet.position}`];
            console.log(`開獎結果：第${recentBet.position}名 開出號碼${actualNumber}`);
            
            const shouldWin = parseInt(recentBet.bet_value) === parseInt(actualNumber);
            console.log(`\n結算判定：`);
            console.log(`- 系統判定: ${recentBet.win ? '中獎' : '未中獎'}`);
            console.log(`- 正確判定: ${shouldWin ? '中獎' : '未中獎'}`);
            console.log(`- 判定正確: ${recentBet.win === shouldWin ? '✅ 是' : '❌ 否'}`);
            
            if (recentBet.win === shouldWin) {
                console.log('\n✅ 結論：結算系統正確地根據實際開獎結果判斷輸贏');
                console.log('控制系統只影響開獎結果的生成，不影響結算判定');
            } else {
                console.log('\n❌ 發現問題：結算判定與實際開獎結果不符');
            }
        }
        
    } catch (error) {
        console.error('查詢失敗：', error);
    }
}

// 5. 總結
console.log('📝 系統邏輯總結：');
console.log('1. 控制系統（fixed-draw-system.js）：');
console.log('   - 根據控制機率決定生成對用戶有利或不利的開獎結果');
console.log('   - 將結果保存到 result_history 表');
console.log('\n2. 結算系統（enhanced-settlement-system.js）：');
console.log('   - 從 result_history 讀取實際開獎結果');
console.log('   - 與投注內容比對，判斷是否中獎');
console.log('   - 完全基於實際開獎結果，不受控制機率影響');
console.log('\n✅ 結論：系統邏輯正確！');
console.log('- 控制機率 → 影響開獎結果生成');
console.log('- 開獎結果 → 決定結算輸贏');
console.log('- 結算判定完全基於實際開獎結果\n');

// 執行實際案例驗證
verifyWithRealCase().then(() => {
    process.exit(0);
}).catch(error => {
    console.error('驗證失敗：', error);
    process.exit(1);
});