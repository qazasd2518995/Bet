// check-actual-bet-format.js - 检查实际投注格式
import db from './db/config.js';

async function checkActualBetFormat() {
    try {
        console.log('🔍 检查实际投注格式...\n');
        
        // 1. 检查最近期号的实际投注记录
        const recentBets = await db.any(`
            SELECT id, period, bet_type, bet_value, amount, odds, win, win_amount, settled, created_at
            FROM bet_history 
            WHERE username = 'justin111' 
                AND period IN (20250714299, 20250714309)
            ORDER BY period DESC, id ASC
            LIMIT 20
        `);
        
        console.log('📋 最近的投注记录详情:');
        recentBets.forEach(bet => {
            console.log(`期号 ${bet.period} - ID ${bet.id}:`);
            console.log(`  bet_type: "${bet.bet_type}"`);
            console.log(`  bet_value: "${bet.bet_value}"`);
            console.log(`  win: ${bet.win}`);
            console.log(`  settled: ${bet.settled}`);
            console.log('');
        });
        
        // 2. 统计bet_value的所有格式
        const allFormats = await db.any(`
            SELECT DISTINCT bet_value, COUNT(*) as count
            FROM bet_history 
            WHERE username = 'justin111' 
                AND created_at >= NOW() - INTERVAL '1 day'
            GROUP BY bet_value
            ORDER BY bet_value
        `);
        
        console.log('📊 过去24小时所有bet_value格式:');
        allFormats.forEach(f => {
            console.log(`  "${f.bet_value}": ${f.count}笔`);
        });
        
        // 3. 检查是否有混合格式
        const mixedCheck = await db.any(`
            SELECT period, 
                   SUM(CASE WHEN bet_value IN ('大', '小', '单', '双') THEN 1 ELSE 0 END) as chinese_count,
                   SUM(CASE WHEN bet_value IN ('big', 'small', 'odd', 'even') THEN 1 ELSE 0 END) as english_count,
                   COUNT(*) as total_count
            FROM bet_history 
            WHERE username = 'justin111' 
                AND period >= 20250714290
            GROUP BY period
            HAVING SUM(CASE WHEN bet_value IN ('大', '小', '单', '双') THEN 1 ELSE 0 END) > 0
               OR SUM(CASE WHEN bet_value IN ('big', 'small', 'odd', 'even') THEN 1 ELSE 0 END) > 0
            ORDER BY period DESC
            LIMIT 10
        `);
        
        console.log('\n📈 各期号格式使用情况:');
        mixedCheck.forEach(p => {
            console.log(`期号 ${p.period}: 中文${p.chinese_count}笔, 英文${p.english_count}笔, 总计${p.total_count}笔`);
        });
        
        // 4. 找出问题根源
        console.log('\n💡 问题分析:');
        
        const hasChineseFormat = allFormats.some(f => ['大', '小', '单', '双'].includes(f.bet_value));
        const hasEnglishFormat = allFormats.some(f => ['big', 'small', 'odd', 'even'].includes(f.bet_value));
        
        if (hasChineseFormat && !hasEnglishFormat) {
            console.log('❌ 发现问题: 所有投注都使用中文格式（大、小、单、双）');
            console.log('❌ 但checkWin函数只支援英文格式（big、small、odd、even）');
            console.log('💡 解决方案: 更新checkWin函数以支援中文格式');
        } else if (hasChineseFormat && hasEnglishFormat) {
            console.log('⚠️ 发现混合使用中文和英文格式');
            console.log('💡 建议统一使用一种格式，或让checkWin同时支援两种格式');
        } else if (!hasChineseFormat && hasEnglishFormat) {
            console.log('✅ 所有投注都使用英文格式，checkWin应该能正常工作');
            console.log('❓ 如果还有问题，可能是其他原因');
        }
        
        await db.$pool.end();
    } catch (error) {
        console.error('检查过程中发生错误:', error);
        await db.$pool.end();
    }
}

checkActualBetFormat();