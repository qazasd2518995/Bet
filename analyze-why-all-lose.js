// analyze-why-all-lose.js - 深入分析为什么所有投注都显示为输
import db from './db/config.js';

async function analyzeWhyAllLose() {
    try {
        console.log('🔍 深入分析为什么所有投注都显示为输...\n');
        
        // 1. 分析结算流程
        console.log('📋 分析结算流程:');
        console.log('1. backend.js 调用 settleBets(period, {positions: array})');
        console.log('2. settleBets 调用 improvedSettleBets(period, winResult)');
        console.log('3. improvedSettleBets 查询未结算的注单');
        console.log('4. 对每笔注单调用 checkWin(bet, winResult)');
        console.log('5. checkWin 根据 bet_type 和 bet_value 判断是否中奖\n');
        
        // 2. 检查一个具体的错误案例
        console.log('🔍 检查具体错误案例 - 期号291:');
        
        // 获取期号291的结果和一些投注
        const period291Result = await db.one('SELECT result FROM result_history WHERE period = 20250714291');
        const period291Bets = await db.any(`
            SELECT id, bet_type, bet_value, win, win_amount
            FROM bet_history 
            WHERE period = 20250714291 AND username = 'justin111'
            AND bet_type = 'champion' AND bet_value IN ('big', 'even')
            LIMIT 2
        `);
        
        console.log('开奖结果:', period291Result.result);
        console.log('冠军号码:', period291Result.result[0]);
        console.log('投注案例:');
        period291Bets.forEach(bet => {
            console.log(`  ${bet.bet_type} ${bet.bet_value}: ${bet.win ? '中奖' : '输'}`);
        });
        
        // 3. 分析所有期号的中奖率
        console.log('\n📊 分析各期号的中奖率:');
        const winRateAnalysis = await db.any(`
            SELECT 
                period,
                COUNT(*) as total_bets,
                SUM(CASE WHEN win = true THEN 1 ELSE 0 END) as winning_bets,
                ROUND(SUM(CASE WHEN win = true THEN 1 ELSE 0 END)::numeric / COUNT(*)::numeric * 100, 2) as win_rate
            FROM bet_history 
            WHERE username = 'justin111' 
                AND period >= 20250714280
                AND bet_value IN ('big', 'small', 'odd', 'even')
            GROUP BY period
            ORDER BY period DESC
            LIMIT 15
        `);
        
        winRateAnalysis.forEach(p => {
            const status = p.win_rate == 0 ? '❌' : p.win_rate > 40 ? '✅' : '⚠️';
            console.log(`${status} 期号 ${p.period}: ${p.total_bets}笔投注, ${p.winning_bets}笔中奖, 中奖率 ${p.win_rate}%`);
        });
        
        // 4. 检查结算时的数据流
        console.log('\n🔍 检查可能的问题点:');
        
        // 问题1：settled = true 但 win = false
        const suspiciousBets = await db.one(`
            SELECT COUNT(*) as count
            FROM bet_history 
            WHERE username = 'justin111' 
                AND period >= 20250714290
                AND settled = true 
                AND win = false 
                AND win_amount = 0
                AND bet_value IN ('big', 'small', 'odd', 'even')
        `);
        
        console.log(`1. 已结算但显示为输的大小单双投注: ${suspiciousBets.count}笔`);
        
        // 问题2：结算日志显示总中奖金额为0
        const zeroWinLogs = await db.any(`
            SELECT period, settled_count, total_win_amount
            FROM settlement_logs 
            WHERE total_win_amount = 0 
                AND settled_count >= 20
            ORDER BY created_at DESC
            LIMIT 10
        `);
        
        console.log(`2. 结算日志显示总中奖金额为0的期号: ${zeroWinLogs.length}个`);
        zeroWinLogs.forEach(log => {
            console.log(`   期号 ${log.period}: 结算${log.settled_count}笔, 总中奖$${log.total_win_amount}`);
        });
        
        // 5. 推测根本原因
        console.log('\n💡 可能的根本原因:');
        console.log('1. **初始结算逻辑错误**: 在创建bet_history记录时就错误地设置了win=false');
        console.log('2. **结算执行时机问题**: 可能在投注还在处理中时就执行了结算');
        console.log('3. **checkWin函数逻辑问题**: 虽然测试通过，但实际运行时可能有其他条件');
        console.log('4. **数据格式不一致**: winResult的格式可能与预期不同');
        console.log('5. **并发问题**: 多个结算进程同时运行导致数据错乱');
        
        // 6. 检查初始投注创建
        console.log('\n🔍 检查投注创建时的默认值:');
        const recentBetDefaults = await db.one(`
            SELECT 
                COUNT(CASE WHEN win = false THEN 1 END) as default_false,
                COUNT(CASE WHEN win = true THEN 1 END) as default_true,
                COUNT(CASE WHEN win IS NULL THEN 1 END) as default_null
            FROM bet_history 
            WHERE username = 'justin111' 
                AND created_at >= NOW() - INTERVAL '1 day'
        `);
        
        console.log(`win默认为false: ${recentBetDefaults.default_false}笔`);
        console.log(`win默认为true: ${recentBetDefaults.default_true}笔`);
        console.log(`win默认为null: ${recentBetDefaults.default_null}笔`);
        
        if (recentBetDefaults.default_false > 0 && recentBetDefaults.default_true === 0) {
            console.log('\n⚠️ 发现问题: 所有投注创建时win都默认为false');
            console.log('这可能导致如果结算逻辑没有正确执行，所有投注都会保持为输的状态');
        }
        
        await db.$pool.end();
    } catch (error) {
        console.error('分析过程中发生错误:', error);
        await db.$pool.end();
    }
}

analyzeWhyAllLose();