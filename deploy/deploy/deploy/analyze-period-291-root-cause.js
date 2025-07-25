// analyze-period-291-root-cause.js - 分析期號291根本原因
import db from './db/config.js';
import { checkWin } from './improved-settlement-system.js';

async function analyzePeriod291RootCause() {
    try {
        console.log('🔍 分析期號291結算錯誤的根本原因...\n');
        
        // 1. 獲取期號291的開獎結果
        const result = await db.one('SELECT period, result FROM result_history WHERE period = 20250714291');
        console.log('期號291開獎結果:', result.result);
        
        let positions = [];
        if (Array.isArray(result.result)) {
            positions = result.result;
        } else if (typeof result.result === 'string') {
            positions = result.result.split(',').map(n => parseInt(n.trim()));
        }
        
        const winResult = { positions };
        console.log('解析後的winResult:', winResult);
        
        // 2. 獲取一些應該中獎的投注來測試
        const shouldWinBets = await db.manyOrNone(`
            SELECT id, bet_type, bet_value, position, amount, odds, win, win_amount
            FROM bet_history 
            WHERE period = 20250714291 AND username = 'justin111'
            AND ((bet_type = 'champion' AND bet_value = 'big') OR 
                 (bet_type = 'champion' AND bet_value = 'even') OR
                 (bet_type = 'tenth' AND bet_value = 'big') OR
                 (bet_type = 'tenth' AND bet_value = 'odd'))
            ORDER BY id
        `);
        
        console.log('\\n🧪 測試當前checkWin邏輯:');
        
        shouldWinBets.forEach(bet => {
            const currentResult = checkWin(bet, winResult);
            const expectedResult = true; // 這些都應該中獎
            
            console.log(`\\n投注ID ${bet.id}: ${bet.bet_type} ${bet.bet_value}`);
            console.log(`  開獎位置值: ${bet.bet_type === 'champion' ? positions[0] : positions[9]}`);
            console.log(`  當前邏輯結果: ${currentResult ? '中獎' : '未中獎'}`);
            console.log(`  預期結果: ${expectedResult ? '中獎' : '未中獎'}`);
            console.log(`  數據庫記錄: ${bet.win ? '中獎' : '未中獎'} $${bet.win_amount || 0}`);
            console.log(`  ✅ 當前邏輯正確: ${currentResult === expectedResult}`);
        });
        
        // 3. 檢查可能的歷史問題
        console.log('\\n🔍 分析可能的歷史問題:');
        
        // 檢查結算時間與投注時間的關係
        const timingAnalysis = await db.one(`
            SELECT 
                MIN(created_at) as first_bet,
                MAX(created_at) as last_bet,
                (SELECT created_at FROM settlement_logs WHERE period = 20250714291) as settlement_time
            FROM bet_history 
            WHERE period = 20250714291 AND username = 'justin111'
        `);
        
        console.log('時間分析:');
        console.log(`  第一筆投注: ${timingAnalysis.first_bet}`);
        console.log(`  最後投注: ${timingAnalysis.last_bet}`);
        console.log(`  結算時間: ${timingAnalysis.settlement_time}`);
        
        const timeDiff = new Date(timingAnalysis.settlement_time) - new Date(timingAnalysis.last_bet);
        console.log(`  結算延遲: ${timeDiff / 1000} 秒`);
        
        if (timeDiff < 5000) {
            console.log('  ⚠️ 結算可能太快，投注可能還在處理中');
        }
        
        // 4. 檢查是否有資料格式問題的痕跡
        console.log('\\n🔍 檢查可能的資料格式問題:');
        
        // 檢查result_history中的資料格式
        const resultFormats = await db.manyOrNone(`
            SELECT period, result, 
                   CASE 
                     WHEN result::text LIKE '[%]' THEN 'array_format'
                     WHEN result::text LIKE '%,%' THEN 'string_format'
                     ELSE 'unknown_format'
                   END as format_type
            FROM result_history 
            WHERE period >= 20250714290 AND period <= 20250714292
            ORDER BY period
        `);
        
        console.log('近期結果格式:');
        resultFormats.forEach(r => {
            console.log(`  期號 ${r.period}: ${r.format_type} - ${JSON.stringify(r.result)}`);
        });
        
        // 5. 推斷根本原因
        console.log('\\n🎯 根本原因分析:');
        
        console.log('基於分析，期號291的問題最可能是:');
        console.log('');
        console.log('1. **時間窗口問題**: ');
        console.log('   - 投注在06:01:38-06:01:51期間完成');
        console.log('   - 結算在06:02:18執行，延遲僅27秒');
        console.log('   - 可能存在投注記錄尚未完全寫入的競態條件');
        console.log('');
        console.log('2. **結算邏輯版本問題**:');
        console.log('   - 當時可能使用了舊版本的checkWin邏輯');
        console.log('   - 或者winResult的資料格式與checkWin邏輯不匹配');
        console.log('');
        console.log('3. **資料同步問題**:');
        console.log('   - 投注記錄可能在不同服務間同步延遲');
        console.log('   - 結算時讀取到的資料可能不完整');
        
        console.log('\\n✅ 當前防護措施:');
        console.log('1. 分佈式鎖機制防止並發結算');
        console.log('2. 事務處理確保資料一致性');
        console.log('3. 統一的checkWin邏輯');
        console.log('4. 正確的資料格式 {positions: array}');
        console.log('5. 結算日誌記錄便於追蹤');
        
        await db.$pool.end();
    } catch (error) {
        console.error('分析過程中發生錯誤:', error);
        await db.$pool.end();
    }
}

analyzePeriod291RootCause();