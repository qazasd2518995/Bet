// diagnose-settlement-issues.js - 诊断结算问题
import db from './db/config.js';

async function diagnoseSettlementIssues() {
    console.log('🔍 开始诊断结算系统问题...\n');
    
    try {
        // 1. 检查最近的结算记录
        console.log('📊 最近24小时的结算统计：');
        const recentStats = await db.oneOrNone(`
            SELECT 
                COUNT(DISTINCT period) as total_periods,
                COUNT(*) as total_bets,
                COUNT(CASE WHEN settled = true THEN 1 END) as settled_bets,
                COUNT(CASE WHEN settled = false THEN 1 END) as unsettled_bets,
                SUM(amount) as total_bet_amount,
                SUM(CASE WHEN win = true THEN win_amount ELSE 0 END) as total_win_amount
            FROM bet_history
            WHERE created_at > NOW() - INTERVAL '24 hours'
        `);
        
        if (recentStats) {
            console.log(`  - 总期数: ${recentStats.total_periods}`);
            console.log(`  - 总注单数: ${recentStats.total_bets}`);
            console.log(`  - 已结算: ${recentStats.settled_bets}`);
            console.log(`  - 未结算: ${recentStats.unsettled_bets}`);
            console.log(`  - 总下注额: ${recentStats.total_bet_amount || 0}`);
            console.log(`  - 总中奖额: ${recentStats.total_win_amount || 0}`);
        }
        
        // 2. 检查可能的重复结算
        console.log('\n🔄 检查重复结算情况：');
        const duplicateSettlements = await db.manyOrNone(`
            WITH bet_groups AS (
                SELECT 
                    period,
                    username,
                    bet_type,
                    bet_value,
                    position,
                    amount,
                    COUNT(*) as duplicate_count,
                    SUM(win_amount) as total_win_amount,
                    array_agg(id ORDER BY created_at) as bet_ids,
                    array_agg(settled ORDER BY created_at) as settled_status,
                    array_agg(created_at ORDER BY created_at) as created_times
                FROM bet_history
                WHERE created_at > NOW() - INTERVAL '24 hours'
                GROUP BY period, username, bet_type, bet_value, position, amount
                HAVING COUNT(*) > 1
            )
            SELECT * FROM bet_groups
            ORDER BY duplicate_count DESC, period DESC
            LIMIT 20
        `);
        
        if (duplicateSettlements && duplicateSettlements.length > 0) {
            console.log(`  ⚠️ 发现 ${duplicateSettlements.length} 组可能的重复注单：`);
            duplicateSettlements.forEach((dup, index) => {
                console.log(`\n  ${index + 1}. 期号: ${dup.period}, 用户: ${dup.username}`);
                console.log(`     类型: ${dup.bet_type}, 值: ${dup.bet_value}, 金额: ${dup.amount}`);
                console.log(`     重复次数: ${dup.duplicate_count}, 总中奖: ${dup.total_win_amount || 0}`);
                console.log(`     注单ID: ${dup.bet_ids.join(', ')}`);
                console.log(`     结算状态: ${dup.settled_status.join(', ')}`);
            });
        } else {
            console.log('  ✅ 没有发现重复注单');
        }
        
        // 3. 检查异常的中奖金额
        console.log('\n💰 检查异常中奖金额：');
        const abnormalWins = await db.manyOrNone(`
            SELECT 
                id,
                period,
                username,
                bet_type,
                bet_value,
                amount,
                win_amount,
                win_amount / NULLIF(amount, 0) as win_ratio,
                created_at
            FROM bet_history
            WHERE settled = true 
            AND win = true
            AND win_amount > amount * 50  -- 赔率超过50倍的
            AND created_at > NOW() - INTERVAL '24 hours'
            ORDER BY win_ratio DESC
            LIMIT 10
        `);
        
        if (abnormalWins && abnormalWins.length > 0) {
            console.log(`  ⚠️ 发现 ${abnormalWins.length} 笔异常高赔率的中奖：`);
            abnormalWins.forEach(win => {
                console.log(`    - ID: ${win.id}, 期号: ${win.period}, 用户: ${win.username}`);
                console.log(`      下注: ${win.amount}, 中奖: ${win.win_amount}, 倍率: ${win.win_ratio.toFixed(2)}x`);
            });
        } else {
            console.log('  ✅ 没有发现异常的中奖金额');
        }
        
        // 4. 检查用户余额异常
        console.log('\n👤 检查用户余额异常：');
        const balanceIssues = await db.manyOrNone(`
            WITH user_stats AS (
                SELECT 
                    m.username,
                    m.balance as current_balance,
                    COALESCE(SUM(CASE WHEN tr.transaction_type = 'deposit' THEN tr.amount ELSE 0 END), 0) as total_deposits,
                    COALESCE(SUM(CASE WHEN tr.transaction_type = 'withdraw' THEN tr.amount ELSE 0 END), 0) as total_withdraws,
                    COALESCE(SUM(CASE WHEN tr.transaction_type = 'bet' THEN -tr.amount ELSE 0 END), 0) as total_bets,
                    COALESCE(SUM(CASE WHEN tr.transaction_type = 'win' THEN tr.amount ELSE 0 END), 0) as total_wins,
                    COALESCE(SUM(CASE WHEN tr.transaction_type = 'rebate' THEN tr.amount ELSE 0 END), 0) as total_rebates
                FROM members m
                LEFT JOIN transaction_records tr ON m.id = tr.user_id AND tr.user_type = 'member'
                WHERE m.balance != 0
                GROUP BY m.username, m.balance
            )
            SELECT 
                username,
                current_balance,
                total_deposits,
                total_withdraws,
                total_bets,
                total_wins,
                total_rebates,
                (total_deposits - total_withdraws + total_bets + total_wins + total_rebates) as calculated_balance,
                current_balance - (total_deposits - total_withdraws + total_bets + total_wins + total_rebates) as difference
            FROM user_stats
            WHERE ABS(current_balance - (total_deposits - total_withdraws + total_bets + total_wins + total_rebates)) > 1
            ORDER BY ABS(current_balance - (total_deposits - total_withdraws + total_bets + total_wins + total_rebates)) DESC
            LIMIT 10
        `);
        
        if (balanceIssues && balanceIssues.length > 0) {
            console.log(`  ⚠️ 发现 ${balanceIssues.length} 个用户余额可能有异常：`);
            balanceIssues.forEach(user => {
                console.log(`\n    用户: ${user.username}`);
                console.log(`    当前余额: ${user.current_balance}`);
                console.log(`    计算余额: ${user.calculated_balance}`);
                console.log(`    差异: ${user.difference}`);
                console.log(`    明细: 存款(${user.total_deposits}) - 提款(${user.total_withdraws}) + 下注(${user.total_bets}) + 中奖(${user.total_wins}) + 退水(${user.total_rebates})`);
            });
        } else {
            console.log('  ✅ 用户余额计算正常');
        }
        
        // 5. 检查未结算的过期注单
        console.log('\n⏰ 检查未结算的过期注单：');
        const expiredUnsettled = await db.manyOrNone(`
            SELECT 
                period,
                COUNT(*) as bet_count,
                SUM(amount) as total_amount,
                MIN(created_at) as earliest_bet,
                MAX(created_at) as latest_bet
            FROM bet_history
            WHERE settled = false
            AND created_at < NOW() - INTERVAL '1 hour'
            GROUP BY period
            ORDER BY period DESC
            LIMIT 10
        `);
        
        if (expiredUnsettled && expiredUnsettled.length > 0) {
            console.log(`  ⚠️ 发现 ${expiredUnsettled.length} 个期号有超过1小时未结算的注单：`);
            expiredUnsettled.forEach(period => {
                console.log(`    期号: ${period.period}, 注单数: ${period.bet_count}, 总金额: ${period.total_amount}`);
                console.log(`    最早: ${period.earliest_bet}, 最晚: ${period.latest_bet}`);
            });
        } else {
            console.log('  ✅ 没有发现过期未结算的注单');
        }
        
        // 6. 提供修复建议
        console.log('\n🔧 修复建议：');
        console.log('1. 执行 node init-settlement-system.js 初始化结算系统');
        console.log('2. 执行 node fix-duplicate-settlements-v2.cjs 修复重复结算');
        console.log('3. 重启服务以使用新的结算系统');
        console.log('4. 监控 settlement_logs 表以追踪结算情况');
        
    } catch (error) {
        console.error('❌ 诊断过程中发生错误:', error);
    }
}

// 如果直接执行此文件
if (process.argv[1] === new URL(import.meta.url).pathname) {
    diagnoseSettlementIssues()
        .then(() => {
            console.log('\n诊断完成');
            process.exit(0);
        })
        .catch(error => {
            console.error('诊断失败:', error);
            process.exit(1);
        });
}

export default diagnoseSettlementIssues;