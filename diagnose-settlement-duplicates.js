// diagnose-settlement-duplicates.js - 诊断重复结算问题
import db from './db/config.js';

async function diagnoseDuplicateSettlements() {
    console.log('🔍 开始诊断重复结算问题...\n');
    
    try {
        // 1. 检查是否有重复的结算记录
        console.log('1️⃣ 检查重复结算记录...');
        const duplicateSettlements = await db.any(`
            WITH bet_settlements AS (
                SELECT 
                    period,
                    username,
                    bet_type,
                    bet_value,
                    position,
                    amount,
                    COUNT(*) as settlement_count,
                    SUM(win_amount) as total_win_amount,
                    STRING_AGG(id::text, ', ') as bet_ids,
                    STRING_AGG(CASE WHEN settled THEN 'Y' ELSE 'N' END, ', ') as settled_flags
                FROM bet_history
                WHERE period >= (SELECT MAX(period) - 10 FROM bet_history)
                GROUP BY period, username, bet_type, bet_value, position, amount
                HAVING COUNT(*) > 1
            )
            SELECT * FROM bet_settlements
            ORDER BY period DESC, username, bet_type
        `);
        
        if (duplicateSettlements.length > 0) {
            console.log(`❌ 发现 ${duplicateSettlements.length} 组重复的注单！`);
            console.log('\n详细信息：');
            duplicateSettlements.forEach(dup => {
                console.log(`  期号: ${dup.period}, 用户: ${dup.username}`);
                console.log(`  类型: ${dup.bet_type}, 值: ${dup.bet_value}, 位置: ${dup.position || 'N/A'}`);
                console.log(`  金额: ${dup.amount}, 结算次数: ${dup.settlement_count}`);
                console.log(`  总中奖金额: ${dup.total_win_amount}`);
                console.log(`  注单ID: ${dup.bet_ids}`);
                console.log(`  已结算标记: ${dup.settled_flags}`);
                console.log('  ---');
            });
        } else {
            console.log('✅ 没有发现重复的注单记录');
        }
        
        // 2. 检查交易记录中的重复
        console.log('\n2️⃣ 检查交易记录中的重复结算...');
        const duplicateTransactions = await db.any(`
            WITH win_transactions AS (
                SELECT 
                    user_id,
                    transaction_type,
                    amount,
                    description,
                    created_at::date as transaction_date,
                    COUNT(*) as count,
                    STRING_AGG(id::text, ', ') as transaction_ids
                FROM transaction_records
                WHERE transaction_type = 'win'
                AND created_at >= NOW() - INTERVAL '7 days'
                GROUP BY user_id, transaction_type, amount, description, created_at::date
                HAVING COUNT(*) > 1
            )
            SELECT 
                t.*,
                m.username
            FROM win_transactions t
            JOIN members m ON t.user_id = m.id
            ORDER BY t.transaction_date DESC
        `);
        
        if (duplicateTransactions.length > 0) {
            console.log(`❌ 发现 ${duplicateTransactions.length} 组重复的中奖交易！`);
            duplicateTransactions.forEach(dup => {
                console.log(`  用户: ${dup.username}, 日期: ${dup.transaction_date}`);
                console.log(`  金额: ${dup.amount}, 描述: ${dup.description}`);
                console.log(`  重复次数: ${dup.count}`);
                console.log(`  交易ID: ${dup.transaction_ids}`);
                console.log('  ---');
            });
        } else {
            console.log('✅ 没有发现重复的中奖交易记录');
        }
        
        // 3. 检查结算锁表
        console.log('\n3️⃣ 检查结算锁表...');
        const lockTableExists = await db.oneOrNone(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'settlement_locks'
            ) as exists
        `);
        
        if (lockTableExists?.exists) {
            const currentLocks = await db.any(`
                SELECT * FROM settlement_locks 
                WHERE expires_at > NOW()
                ORDER BY locked_at DESC
            `);
            
            if (currentLocks.length > 0) {
                console.log(`⚠️ 发现 ${currentLocks.length} 个活跃的结算锁：`);
                currentLocks.forEach(lock => {
                    console.log(`  锁键: ${lock.lock_key}`);
                    console.log(`  锁定时间: ${lock.locked_at}`);
                    console.log(`  过期时间: ${lock.expires_at}`);
                });
            } else {
                console.log('✅ 没有活跃的结算锁');
            }
            
            // 检查过期的锁
            const expiredLocks = await db.any(`
                SELECT COUNT(*) as count FROM settlement_locks 
                WHERE expires_at <= NOW()
            `);
            
            if (expiredLocks[0].count > 0) {
                console.log(`⚠️ 发现 ${expiredLocks[0].count} 个过期的结算锁需要清理`);
            }
        } else {
            console.log('❌ 结算锁表不存在！这可能导致并发结算问题');
        }
        
        // 4. 检查最近的结算记录
        console.log('\n4️⃣ 检查最近的结算记录...');
        const recentSettlements = await db.any(`
            SELECT 
                period,
                COUNT(*) as bet_count,
                SUM(CASE WHEN settled THEN 1 ELSE 0 END) as settled_count,
                SUM(CASE WHEN win THEN 1 ELSE 0 END) as win_count,
                SUM(win_amount) as total_win_amount,
                MIN(created_at) as first_bet_time,
                MAX(CASE WHEN settled THEN settled_at ELSE NULL END) as last_settled_time
            FROM bet_history
            WHERE period >= (SELECT MAX(period) - 5 FROM bet_history)
            GROUP BY period
            ORDER BY period DESC
        `);
        
        console.log('最近5期的结算情况：');
        recentSettlements.forEach(record => {
            console.log(`  期号: ${record.period}`);
            console.log(`  总注单: ${record.bet_count}, 已结算: ${record.settled_count}`);
            console.log(`  中奖数: ${record.win_count}, 总中奖金额: ${record.total_win_amount || 0}`);
            console.log(`  首次下注: ${record.first_bet_time}`);
            console.log(`  最后结算: ${record.last_settled_time || '未结算'}`);
            console.log('  ---');
        });
        
        // 5. 检查用户余额异常
        console.log('\n5️⃣ 检查用户余额异常（可能因重复结算）...');
        const balanceAnomalies = await db.any(`
            WITH user_stats AS (
                SELECT 
                    m.username,
                    m.balance,
                    COALESCE(SUM(CASE WHEN bh.win THEN bh.win_amount ELSE 0 END), 0) as total_wins,
                    COALESCE(SUM(bh.amount), 0) as total_bets,
                    COUNT(bh.id) as bet_count,
                    COUNT(CASE WHEN bh.win THEN 1 END) as win_count
                FROM members m
                LEFT JOIN bet_history bh ON m.username = bh.username 
                    AND bh.created_at >= NOW() - INTERVAL '24 hours'
                    AND bh.settled = true
                GROUP BY m.username, m.balance
                HAVING COUNT(bh.id) > 0
            )
            SELECT *,
                   (total_wins - total_bets) as expected_profit,
                   CASE 
                       WHEN total_bets > 0 AND (total_wins / total_bets) > 5 THEN '异常高'
                       WHEN total_bets > 0 AND (total_wins / total_bets) > 2 THEN '偏高'
                       ELSE '正常'
                   END as win_ratio_status
            FROM user_stats
            WHERE total_wins > total_bets * 2  -- 赢的金额超过下注金额的2倍
            ORDER BY (total_wins - total_bets) DESC
            LIMIT 10
        `);
        
        if (balanceAnomalies.length > 0) {
            console.log(`⚠️ 发现 ${balanceAnomalies.length} 个用户的中奖金额异常偏高：`);
            balanceAnomalies.forEach(user => {
                console.log(`  用户: ${user.username}`);
                console.log(`  当前余额: ${user.balance}`);
                console.log(`  24小时内: 下注${user.bet_count}次, 中奖${user.win_count}次`);
                console.log(`  总下注: ${user.total_bets}, 总中奖: ${user.total_wins}`);
                console.log(`  净利润: ${user.expected_profit} (${user.win_ratio_status})`);
                console.log('  ---');
            });
        } else {
            console.log('✅ 没有发现余额异常的用户');
        }
        
        // 6. 提供修复建议
        console.log('\n📋 诊断总结与建议：');
        if (duplicateSettlements.length > 0 || duplicateTransactions.length > 0) {
            console.log('❌ 发现重复结算问题！');
            console.log('\n建议的修复步骤：');
            console.log('1. 立即停止游戏服务，防止问题扩大');
            console.log('2. 备份当前资料库');
            console.log('3. 执行 fix-duplicate-settlements-v3.cjs 修复重复结算');
            console.log('4. 确保 settlement_locks 表存在并正常工作');
            console.log('5. 检查是否有多个服务实例同时运行');
            console.log('6. 验证改进的结算系统 (improved-settlement-system.js) 是否正确引入');
        } else {
            console.log('✅ 未发现明显的重复结算问题');
            console.log('\n但如果用户报告余额异常，请检查：');
            console.log('1. 是否有并发结算的情况');
            console.log('2. 结算锁机制是否正常工作');
            console.log('3. 代理系统和游戏系统之间的同步是否有延迟');
        }
        
    } catch (error) {
        console.error('诊断过程中发生错误:', error);
    } finally {
        await db.$pool.end();
    }
}

// 执行诊断
diagnoseDuplicateSettlements();