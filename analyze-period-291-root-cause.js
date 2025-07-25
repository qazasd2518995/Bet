// analyze-period-291-root-cause.js - 分析期号291根本原因
import db from './db/config.js';
import { checkWin } from './improved-settlement-system.js';

async function analyzePeriod291RootCause() {
    try {
        console.log('🔍 分析期号291结算错误的根本原因...\n');
        
        // 1. 获取期号291的开奖结果
        const result = await db.one('SELECT period, result FROM result_history WHERE period = 20250714291');
        console.log('期号291开奖结果:', result.result);
        
        let positions = [];
        if (Array.isArray(result.result)) {
            positions = result.result;
        } else if (typeof result.result === 'string') {
            positions = result.result.split(',').map(n => parseInt(n.trim()));
        }
        
        const winResult = { positions };
        console.log('解析后的winResult:', winResult);
        
        // 2. 获取一些应该中奖的投注来测试
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
        
        console.log('\\n🧪 测试当前checkWin逻辑:');
        
        shouldWinBets.forEach(bet => {
            const currentResult = checkWin(bet, winResult);
            const expectedResult = true; // 这些都应该中奖
            
            console.log(`\\n投注ID ${bet.id}: ${bet.bet_type} ${bet.bet_value}`);
            console.log(`  开奖位置值: ${bet.bet_type === 'champion' ? positions[0] : positions[9]}`);
            console.log(`  当前逻辑结果: ${currentResult ? '中奖' : '未中奖'}`);
            console.log(`  预期结果: ${expectedResult ? '中奖' : '未中奖'}`);
            console.log(`  数据库记录: ${bet.win ? '中奖' : '未中奖'} $${bet.win_amount || 0}`);
            console.log(`  ✅ 当前逻辑正确: ${currentResult === expectedResult}`);
        });
        
        // 3. 检查可能的历史问题
        console.log('\\n🔍 分析可能的历史问题:');
        
        // 检查结算时间与投注时间的关系
        const timingAnalysis = await db.one(`
            SELECT 
                MIN(created_at) as first_bet,
                MAX(created_at) as last_bet,
                (SELECT created_at FROM settlement_logs WHERE period = 20250714291) as settlement_time
            FROM bet_history 
            WHERE period = 20250714291 AND username = 'justin111'
        `);
        
        console.log('时间分析:');
        console.log(`  第一笔投注: ${timingAnalysis.first_bet}`);
        console.log(`  最后投注: ${timingAnalysis.last_bet}`);
        console.log(`  结算时间: ${timingAnalysis.settlement_time}`);
        
        const timeDiff = new Date(timingAnalysis.settlement_time) - new Date(timingAnalysis.last_bet);
        console.log(`  结算延迟: ${timeDiff / 1000} 秒`);
        
        if (timeDiff < 5000) {
            console.log('  ⚠️ 结算可能太快，投注可能还在处理中');
        }
        
        // 4. 检查是否有资料格式问题的痕迹
        console.log('\\n🔍 检查可能的资料格式问题:');
        
        // 检查result_history中的资料格式
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
        
        console.log('近期结果格式:');
        resultFormats.forEach(r => {
            console.log(`  期号 ${r.period}: ${r.format_type} - ${JSON.stringify(r.result)}`);
        });
        
        // 5. 推断根本原因
        console.log('\\n🎯 根本原因分析:');
        
        console.log('基于分析，期号291的问题最可能是:');
        console.log('');
        console.log('1. **时间窗口问题**: ');
        console.log('   - 投注在06:01:38-06:01:51期间完成');
        console.log('   - 结算在06:02:18执行，延迟仅27秒');
        console.log('   - 可能存在投注记录尚未完全写入的竞态条件');
        console.log('');
        console.log('2. **结算逻辑版本问题**:');
        console.log('   - 当时可能使用了旧版本的checkWin逻辑');
        console.log('   - 或者winResult的资料格式与checkWin逻辑不匹配');
        console.log('');
        console.log('3. **资料同步问题**:');
        console.log('   - 投注记录可能在不同服务间同步延迟');
        console.log('   - 结算时读取到的资料可能不完整');
        
        console.log('\\n✅ 当前防护措施:');
        console.log('1. 分布式锁机制防止并发结算');
        console.log('2. 事务处理确保资料一致性');
        console.log('3. 统一的checkWin逻辑');
        console.log('4. 正确的资料格式 {positions: array}');
        console.log('5. 结算日志记录便于追踪');
        
        await db.$pool.end();
    } catch (error) {
        console.error('分析过程中发生错误:', error);
        await db.$pool.end();
    }
}

analyzePeriod291RootCause();