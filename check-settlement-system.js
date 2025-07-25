// check-settlement-system.js - 检查整个结算系统
import db from './db/config.js';

async function checkSettlementSystem() {
    console.log('🔍 检查整个结算系统的运作状态...\n');
    
    try {
        // 1. 检查期号234的状态
        console.log('📊 检查期号234的详细状态：');
        
        // 检查是否已开奖
        const result234 = await db.oneOrNone(`
            SELECT period, result, created_at
            FROM result_history
            WHERE period = 20250714234
        `);
        
        if (result234) {
            console.log(`✅ 期号234已开奖: ${result234.created_at}`);
            console.log(`开奖结果: ${result234.result}`);
            
            // 解析第4名
            let positions = [];
            if (Array.isArray(result234.result)) {
                positions = result234.result;
            } else if (typeof result234.result === 'string') {
                positions = result234.result.split(',').map(n => parseInt(n.trim()));
            }
            
            if (positions.length >= 4) {
                console.log(`第4名开出: ${positions[3]}号`);
            }
        } else {
            console.log('❌ 期号234尚未开奖');
        }
        
        // 检查投注记录
        const bets234 = await db.any(`
            SELECT id, username, bet_type, bet_value, position, amount, odds,
                   win, win_amount, settled, settled_at, created_at
            FROM bet_history
            WHERE period = 20250714234
            ORDER BY created_at ASC
        `);
        
        console.log(`\n📋 期号234投注记录 (${bets234.length}笔):`);
        bets234.forEach(bet => {
            const status = bet.settled ? '已结算' : '⚠️ 未结算';
            console.log(`ID ${bet.id}: ${bet.username} 第${bet.position}名=${bet.bet_value}号, $${bet.amount}, ${status}`);
        });
        
        // 2. 检查最近几期的结算情况
        console.log('\n📈 检查最近几期的结算情况：');
        
        const recentPeriods = await db.any(`
            SELECT bh.period, 
                   COUNT(*) as total_bets,
                   SUM(CASE WHEN bh.settled = true THEN 1 ELSE 0 END) as settled_count,
                   MAX(bh.created_at) as latest_bet,
                   rh.created_at as draw_time
            FROM bet_history bh
            LEFT JOIN result_history rh ON bh.period = rh.period
            WHERE bh.period >= 20250714230
            GROUP BY bh.period, rh.created_at
            ORDER BY bh.period DESC
        `);
        
        console.log('期号 | 总投注 | 已结算 | 开奖时间 | 最后投注时间');
        console.log('-'.repeat(60));
        recentPeriods.forEach(period => {
            const unsettled = period.total_bets - period.settled_count;
            const drawStatus = period.draw_time ? '已开奖' : '未开奖';
            const settlementStatus = unsettled > 0 ? `❌ ${unsettled}未结算` : '✅ 全部结算';
            
            console.log(`${period.period} | ${period.total_bets} | ${period.settled_count} | ${drawStatus} | ${settlementStatus}`);
            if (period.draw_time && period.latest_bet) {
                const timeDiff = Math.round((new Date(period.draw_time) - new Date(period.latest_bet)) / 1000);
                console.log(`  时间差: ${timeDiff}秒 (投注到开奖)`);
            }
        });
        
        // 3. 检查结算日志
        console.log('\n📝 检查结算日志记录：');
        
        const settlementLogs = await db.any(`
            SELECT period, settled_count, total_win_amount, created_at
            FROM settlement_logs
            WHERE period >= 20250714230
            ORDER BY period DESC
        `);
        
        if (settlementLogs.length > 0) {
            console.log('有结算日志的期号：');
            settlementLogs.forEach(log => {
                console.log(`  期号 ${log.period}: ${log.settled_count}注, $${log.total_win_amount}, ${log.created_at}`);
            });
            
            // 找出缺少结算日志的期号
            const loggedPeriods = settlementLogs.map(log => log.period);
            const allPeriods = recentPeriods.map(p => p.period);
            const missingLogs = allPeriods.filter(period => !loggedPeriods.includes(period));
            
            if (missingLogs.length > 0) {
                console.log(`\n⚠️ 缺少结算日志的期号: ${missingLogs.join(', ')}`);
            }
        } else {
            console.log('❌ 最近期号都没有结算日志记录');
        }
        
        // 4. 检查当前游戏状态
        console.log('\n🎮 检查当前游戏状态：');
        
        const gameState = await db.oneOrNone(`
            SELECT current_period, status, countdown_seconds, last_result
            FROM game_state
            ORDER BY id DESC
            LIMIT 1
        `);
        
        if (gameState) {
            console.log(`当前期号: ${gameState.current_period}`);
            console.log(`当前状态: ${gameState.status}`);
            console.log(`倒计时: ${gameState.countdown_seconds}秒`);
            
            // 检查游戏是否正常循环
            if (gameState.current_period <= 20250714234) {
                console.log('⚠️ 游戏期号推进可能有问题');
            } else {
                console.log('✅ 游戏正常推进到新期号');
            }
        }
        
        // 5. 检查后端服务状态（通过最近的活动）
        console.log('\n🔧 检查后端服务活动状态：');
        
        // 检查最近的开奖活动
        const recentDraws = await db.any(`
            SELECT period, created_at
            FROM result_history
            WHERE created_at > NOW() - INTERVAL '30 minutes'
            ORDER BY created_at DESC
            LIMIT 5
        `);
        
        if (recentDraws.length > 0) {
            console.log('最近30分钟的开奖活动：');
            recentDraws.forEach(draw => {
                console.log(`  期号 ${draw.period}: ${draw.created_at}`);
            });
            console.log('✅ 后端服务正在正常开奖');
        } else {
            console.log('❌ 最近30分钟没有开奖活动');
        }
        
        // 检查最近的投注活动
        const recentBets = await db.any(`
            SELECT period, COUNT(*) as bet_count, MAX(created_at) as latest_bet
            FROM bet_history
            WHERE created_at > NOW() - INTERVAL '30 minutes'
            GROUP BY period
            ORDER BY latest_bet DESC
        `);
        
        if (recentBets.length > 0) {
            console.log('\n最近30分钟的投注活动：');
            recentBets.forEach(bet => {
                console.log(`  期号 ${bet.period}: ${bet.bet_count}笔投注, 最后: ${bet.latest_bet}`);
            });
            console.log('✅ 投注系统正常工作');
        } else {
            console.log('\n❌ 最近30分钟没有投注活动');
        }
        
        // 6. 检查结算锁状态
        console.log('\n🔒 检查结算锁状态：');
        
        const activeLocks = await db.any(`
            SELECT lock_key, locked_at, expires_at
            FROM settlement_locks
            WHERE expires_at > NOW()
        `);
        
        if (activeLocks.length > 0) {
            console.log('发现活跃的结算锁：');
            activeLocks.forEach(lock => {
                console.log(`  ${lock.lock_key}: ${lock.locked_at} -> ${lock.expires_at}`);
            });
        } else {
            console.log('✅ 没有活跃的结算锁');
        }
        
        // 7. 诊断结算失败的可能原因
        console.log('\n🔍 诊断结算系统问题：');
        
        const problemsFound = [];
        
        // 检查是否有系统性的结算失败
        const unsettledPeriods = recentPeriods.filter(p => 
            p.draw_time && (p.total_bets - p.settled_count) > 0
        );
        
        if (unsettledPeriods.length > 0) {
            problemsFound.push(`${unsettledPeriods.length}个期号有未结算注单`);
        }
        
        // 检查是否缺少结算日志
        const periodsWithBets = recentPeriods.filter(p => p.total_bets > 0);
        const periodsWithLogs = settlementLogs.length;
        
        if (periodsWithBets.length > periodsWithLogs) {
            problemsFound.push(`${periodsWithBets.length - periodsWithLogs}个期号缺少结算日志`);
        }
        
        if (problemsFound.length > 0) {
            console.log('❌ 发现的问题：');
            problemsFound.forEach(problem => console.log(`  - ${problem}`));
            
            console.log('\n🔧 可能的原因：');
            console.log('1. 后端服务在开奖后没有正确调用结算函数');
            console.log('2. improved-settlement-system.js 的 total_win 栏位问题导致结算失败');
            console.log('3. 结算过程中发生异常但没有重试机制');
            console.log('4. 数据库连接或事务问题');
            console.log('5. 结算锁机制阻止了结算执行');
            
            console.log('\n💡 建议的修复措施：');
            console.log('1. 重启后端服务确保使用最新的代码');
            console.log('2. 手动触发未结算期号的结算');
            console.log('3. 添加结算失败重试机制');
            console.log('4. 增强结算日志和异常处理');
            console.log('5. 实施结算状态监控');
        } else {
            console.log('✅ 没有发现明显的系统性问题');
        }
        
    } catch (error) {
        console.error('检查过程中发生错误:', error);
    } finally {
        await db.$pool.end();
    }
}

// 执行检查
checkSettlementSystem();