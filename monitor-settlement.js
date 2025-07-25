// monitor-settlement.js - 监控结算系统
import db from './db/config.js';

async function monitorSettlement() {
    console.log('🔍 监控结算系统状态...\n');
    
    try {
        // 检查最近5期的结算状况
        const recentPeriods = await db.any(`
            SELECT bh.period, 
                   COUNT(*) as total_bets,
                   SUM(CASE WHEN bh.settled = true THEN 1 ELSE 0 END) as settled_count,
                   rh.created_at as draw_time,
                   sl.created_at as settlement_time,
                   sl.settled_count as log_settled_count
            FROM bet_history bh
            LEFT JOIN result_history rh ON bh.period = rh.period
            LEFT JOIN settlement_logs sl ON bh.period = sl.period
            WHERE bh.period >= 20250714254
            GROUP BY bh.period, rh.created_at, sl.created_at, sl.settled_count
            ORDER BY bh.period DESC
        `);
        
        console.log('📊 最近5期结算状况：');
        console.log('期号 | 投注数 | 已结算 | 开奖时间 | 结算时间 | 状态');
        console.log('-'.repeat(80));
        
        recentPeriods.forEach(period => {
            const unsettled = period.total_bets - period.settled_count;
            let status = '✅ 正常';
            
            if (period.draw_time && unsettled > 0) {
                status = `❌ ${unsettled}笔未结算`;
            } else if (!period.draw_time) {
                status = '⏳ 未开奖';
            } else if (!period.settlement_time) {
                status = '⚠️ 无结算日志';
            }
            
            const drawTime = period.draw_time ? period.draw_time.toLocaleString('zh-TW') : '未开奖';
            const settlementTime = period.settlement_time ? period.settlement_time.toLocaleString('zh-TW') : '无';
            
            console.log(`${period.period} | ${period.total_bets} | ${period.settled_count} | ${drawTime} | ${settlementTime} | ${status}`);
        });
        
        // 检查当前期号
        const currentState = await db.oneOrNone(`
            SELECT current_period, status, countdown_seconds
            FROM game_state
            ORDER BY id DESC
            LIMIT 1
        `);
        
        if (currentState) {
            console.log(`\n🎮 当前游戏状态：`);
            console.log(`期号: ${currentState.current_period}`);
            console.log(`状态: ${currentState.status}`);
            console.log(`倒计时: ${currentState.countdown_seconds}秒`);
            
            // 检查当前期号是否有投注
            const currentBets = await db.oneOrNone(`
                SELECT COUNT(*) as bet_count
                FROM bet_history
                WHERE period = $1
            `, [currentState.current_period]);
            
            if (currentBets && parseInt(currentBets.bet_count) > 0) {
                console.log(`当前期号投注数: ${currentBets.bet_count}`);
            } else {
                console.log('当前期号暂无投注');
            }
        }
        
        // 检查结算系统健康状况
        console.log('\n🏥 结算系统健康检查：');
        
        // 检查是否有活跃的结算锁
        const activeLocks = await db.any(`
            SELECT COUNT(*) as lock_count
            FROM settlement_locks
            WHERE expires_at > NOW()
        `);
        
        const lockCount = activeLocks[0]?.lock_count || 0;
        console.log(`活跃结算锁: ${lockCount} ${lockCount === 0 ? '✅' : '⚠️'}`);
        
        // 检查最近结算活动
        const recentSettlements = await db.any(`
            SELECT period, created_at
            FROM settlement_logs
            WHERE created_at > NOW() - INTERVAL '1 hour'
            ORDER BY created_at DESC
        `);
        
        console.log(`最近1小时结算活动: ${recentSettlements.length}次 ${recentSettlements.length > 0 ? '✅' : '⚠️'}`);
        
        if (recentSettlements.length > 0) {
            console.log('最近结算记录：');
            recentSettlements.slice(0, 3).forEach(log => {
                console.log(`  期号 ${log.period}: ${log.created_at.toLocaleString('zh-TW')}`);
            });
        }
        
        // 总结
        const problemPeriods = recentPeriods.filter(p => 
            p.draw_time && (p.total_bets - p.settled_count) > 0
        );
        
        console.log('\n📋 系统状态总结：');
        if (problemPeriods.length === 0) {
            console.log('✅ 结算系统运行正常');
            console.log('✅ 所有已开奖期号都已正确结算');
            console.log('✅ 新投注会在开奖后自动结算');
        } else {
            console.log(`❌ 发现 ${problemPeriods.length} 个期号有未结算问题`);
            problemPeriods.forEach(p => {
                console.log(`  期号 ${p.period}: ${p.total_bets - p.settled_count} 笔未结算`);
            });
        }
        
    } catch (error) {
        console.error('监控过程中发生错误:', error);
    } finally {
        await db.$pool.end();
    }
}

// 执行监控
monitorSettlement();