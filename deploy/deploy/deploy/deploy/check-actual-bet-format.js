// check-actual-bet-format.js - 檢查實際投注格式
import db from './db/config.js';

async function checkActualBetFormat() {
    try {
        console.log('🔍 檢查實際投注格式...\n');
        
        // 1. 檢查最近期號的實際投注記錄
        const recentBets = await db.any(`
            SELECT id, period, bet_type, bet_value, amount, odds, win, win_amount, settled, created_at
            FROM bet_history 
            WHERE username = 'justin111' 
                AND period IN (20250714299, 20250714309)
            ORDER BY period DESC, id ASC
            LIMIT 20
        `);
        
        console.log('📋 最近的投注記錄詳情:');
        recentBets.forEach(bet => {
            console.log(`期號 ${bet.period} - ID ${bet.id}:`);
            console.log(`  bet_type: "${bet.bet_type}"`);
            console.log(`  bet_value: "${bet.bet_value}"`);
            console.log(`  win: ${bet.win}`);
            console.log(`  settled: ${bet.settled}`);
            console.log('');
        });
        
        // 2. 統計bet_value的所有格式
        const allFormats = await db.any(`
            SELECT DISTINCT bet_value, COUNT(*) as count
            FROM bet_history 
            WHERE username = 'justin111' 
                AND created_at >= NOW() - INTERVAL '1 day'
            GROUP BY bet_value
            ORDER BY bet_value
        `);
        
        console.log('📊 過去24小時所有bet_value格式:');
        allFormats.forEach(f => {
            console.log(`  "${f.bet_value}": ${f.count}筆`);
        });
        
        // 3. 檢查是否有混合格式
        const mixedCheck = await db.any(`
            SELECT period, 
                   SUM(CASE WHEN bet_value IN ('大', '小', '單', '雙') THEN 1 ELSE 0 END) as chinese_count,
                   SUM(CASE WHEN bet_value IN ('big', 'small', 'odd', 'even') THEN 1 ELSE 0 END) as english_count,
                   COUNT(*) as total_count
            FROM bet_history 
            WHERE username = 'justin111' 
                AND period >= 20250714290
            GROUP BY period
            HAVING SUM(CASE WHEN bet_value IN ('大', '小', '單', '雙') THEN 1 ELSE 0 END) > 0
               OR SUM(CASE WHEN bet_value IN ('big', 'small', 'odd', 'even') THEN 1 ELSE 0 END) > 0
            ORDER BY period DESC
            LIMIT 10
        `);
        
        console.log('\n📈 各期號格式使用情況:');
        mixedCheck.forEach(p => {
            console.log(`期號 ${p.period}: 中文${p.chinese_count}筆, 英文${p.english_count}筆, 總計${p.total_count}筆`);
        });
        
        // 4. 找出問題根源
        console.log('\n💡 問題分析:');
        
        const hasChineseFormat = allFormats.some(f => ['大', '小', '單', '雙'].includes(f.bet_value));
        const hasEnglishFormat = allFormats.some(f => ['big', 'small', 'odd', 'even'].includes(f.bet_value));
        
        if (hasChineseFormat && !hasEnglishFormat) {
            console.log('❌ 發現問題: 所有投注都使用中文格式（大、小、單、雙）');
            console.log('❌ 但checkWin函數只支援英文格式（big、small、odd、even）');
            console.log('💡 解決方案: 更新checkWin函數以支援中文格式');
        } else if (hasChineseFormat && hasEnglishFormat) {
            console.log('⚠️ 發現混合使用中文和英文格式');
            console.log('💡 建議統一使用一種格式，或讓checkWin同時支援兩種格式');
        } else if (!hasChineseFormat && hasEnglishFormat) {
            console.log('✅ 所有投注都使用英文格式，checkWin應該能正常工作');
            console.log('❓ 如果還有問題，可能是其他原因');
        }
        
        await db.$pool.end();
    } catch (error) {
        console.error('檢查過程中發生錯誤:', error);
        await db.$pool.end();
    }
}

checkActualBetFormat();