// diagnose-settlement-failure.js - 诊断自动结算失败的原因
import db from './db/config.js';

async function diagnoseSettlementFailure() {
    console.log('🔍 诊断期号229自动结算失败的原因...\n');
    
    try {
        // 1. 检查期号229的时间线
        console.log('⏰ 期号229的时间线分析：');
        
        // 获取开奖时间
        const result = await db.one(`
            SELECT period, result, created_at
            FROM result_history
            WHERE period = 20250714229
        `);
        
        console.log(`开奖时间: ${result.created_at}`);
        
        // 获取最早和最晚的投注时间
        const betTimes = await db.any(`
            SELECT MIN(created_at) as first_bet, MAX(created_at) as last_bet
            FROM bet_history
            WHERE period = 20250714229
        `);
        
        if (betTimes[0].first_bet) {
            console.log(`第一笔投注: ${betTimes[0].first_bet}`);
            console.log(`最后投注: ${betTimes[0].last_bet}`);
            
            const drawTime = new Date(result.created_at);
            const lastBetTime = new Date(betTimes[0].last_bet);
            const timeDiff = Math.round((drawTime - lastBetTime) / 1000);
            
            console.log(`投注截止到开奖间隔: ${timeDiff}秒`);
            
            if (timeDiff < 30) {
                console.log('⚠️ 投注时间太接近开奖时间，可能影响结算');
            }
        }
        
        // 2. 检查结算系统的调用记录
        console.log('\n📋 检查结算系统调用：');
        
        // 检查settlement_logs是否有其他期号的记录
        const recentSettlements = await db.any(`
            SELECT period, settled_count, total_win_amount, created_at
            FROM settlement_logs
            WHERE period >= 20250714227
            ORDER BY period DESC
        `);
        
        if (recentSettlements.length > 0) {
            console.log('最近的结算记录：');
            recentSettlements.forEach(log => {
                console.log(`  期号 ${log.period}: ${log.settled_count}注, $${log.total_win_amount}, ${log.created_at}`);
            });
            
            // 检查是否有连续的结算空档
            const missingPeriods = [];
            for (let i = 227; i <= 232; i++) {
                const period = 20250714000 + i;
                const found = recentSettlements.find(log => log.period == period);
                if (!found) {
                    missingPeriods.push(period);
                }
            }
            
            if (missingPeriods.length > 0) {
                console.log(`\n⚠️ 缺少结算记录的期号: ${missingPeriods.join(', ')}`);
            }
        } else {
            console.log('❌ 没有找到任何结算记录');
        }
        
        // 3. 检查backend.js的结算调用逻辑
        console.log('\n🎯 分析可能的结算失败原因：');
        
        // 检查是否有结算锁残留
        const oldLocks = await db.any(`
            SELECT lock_key, locked_at, expires_at
            FROM settlement_locks
            WHERE locked_at < NOW() - INTERVAL '1 hour'
        `);
        
        if (oldLocks.length > 0) {
            console.log('发现过期的结算锁：');
            oldLocks.forEach(lock => {
                console.log(`  ${lock.lock_key}: ${lock.locked_at} (已过期)`);
            });
        }
        
        // 4. 检查后端日志或错误
        console.log('\n🔧 可能的失败原因：');
        console.log('1. 后端服务在期号229开奖时未运行');
        console.log('2. 结算函数调用时发生异常');
        console.log('3. 数据库连接问题');
        console.log('4. total_win栏位不存在导致结算失败');
        console.log('5. 结算锁机制阻止了结算');
        console.log('6. 事务回滚导致结算未完成');
        
        // 5. 检查其他可能未结算的期号
        console.log('\n🔍 检查其他可能的未结算期号：');
        
        const unsettledPeriods = await db.any(`
            SELECT period, COUNT(*) as total_bets,
                   SUM(CASE WHEN settled = true THEN 1 ELSE 0 END) as settled_count
            FROM bet_history
            WHERE period >= 20250714225
            GROUP BY period
            HAVING COUNT(*) > SUM(CASE WHEN settled = true THEN 1 ELSE 0 END)
            ORDER BY period ASC
        `);
        
        if (unsettledPeriods.length > 0) {
            console.log('发现有未结算注单的期号：');
            unsettledPeriods.forEach(period => {
                const unsettled = period.total_bets - period.settled_count;
                console.log(`  期号 ${period.period}: ${unsettled}/${period.total_bets} 未结算`);
            });
        } else {
            console.log('✅ 除了期号229，其他期号都已正常结算');
        }
        
        // 6. 建议的修复和预防措施
        console.log('\n💡 建议的修复和预防措施：');
        console.log('1. 修复improved-settlement-system.js中的total_win栏位问题 ✅ 已完成');
        console.log('2. 增加结算失败时的重试机制');
        console.log('3. 添加结算状态监控和告警');
        console.log('4. 实施结算完整性检查');
        console.log('5. 定期清理过期的结算锁');
        console.log('6. 增加结算日志的详细记录');
        
        // 7. 实时检查当前系统状态
        console.log('\n📊 当前系统状态：');
        
        const currentPeriod = await db.oneOrNone(`
            SELECT current_period, status
            FROM game_state
            ORDER BY id DESC
            LIMIT 1
        `);
        
        if (currentPeriod) {
            console.log(`当前期号: ${currentPeriod.current_period}`);
            console.log(`当前状态: ${currentPeriod.status}`);
            
            // 检查当前期号是否有投注
            const currentBets = await db.oneOrNone(`
                SELECT COUNT(*) as bet_count
                FROM bet_history
                WHERE period = $1
            `, [currentPeriod.current_period]);
            
            if (currentBets && parseInt(currentBets.bet_count) > 0) {
                console.log(`当前期号投注数: ${currentBets.bet_count}`);
                console.log('✅ 系统正常接受投注');
            }
        }
        
    } catch (error) {
        console.error('诊断过程中发生错误:', error);
    } finally {
        await db.$pool.end();
    }
}

// 执行诊断
diagnoseSettlementFailure();