// check-period-229.js - 检查期号229的结算问题
import db from './db/config.js';

async function checkPeriod229() {
    console.log('🔍 检查期号 20250714229 的结算问题...\n');
    
    try {
        // 1. 检查期号229是否已经开奖
        console.log('📊 检查期号229的开奖状态：');
        const result = await db.oneOrNone(`
            SELECT period, result, created_at
            FROM result_history
            WHERE period = 20250714229
        `);
        
        if (result) {
            console.log(`✅ 期号229已开奖`);
            console.log(`开奖时间: ${result.created_at}`);
            console.log(`开奖结果: ${result.result}`);
            
            // 解析开奖结果
            let positions = [];
            if (Array.isArray(result.result)) {
                positions = result.result;
            } else if (typeof result.result === 'string') {
                positions = result.result.split(',').map(n => parseInt(n.trim()));
            }
            
            if (positions.length >= 6) {
                console.log(`第6名开出: ${positions[5]}号`);
            }
        } else {
            console.log('❌ 期号229尚未开奖或结果未保存');
            return;
        }
        
        // 2. 检查投注记录的状态
        console.log('\n📋 检查期号229的投注记录：');
        const bets = await db.any(`
            SELECT id, username, bet_type, bet_value, position, amount, odds,
                   win, win_amount, settled, settled_at, created_at
            FROM bet_history
            WHERE period = 20250714229
            AND position = 6
            AND bet_type = 'number'
            ORDER BY created_at ASC
        `);
        
        if (bets.length > 0) {
            console.log(`找到 ${bets.length} 笔第6名投注记录：\n`);
            
            bets.forEach(bet => {
                const status = bet.settled ? '已结算' : '⚠️ 未结算';
                const winStatus = bet.win ? `中奖 $${bet.win_amount}` : '未中奖';
                
                console.log(`ID ${bet.id}: 投注${bet.bet_value}号`);
                console.log(`  用户: ${bet.username}`);
                console.log(`  投注时间: ${bet.created_at}`);
                console.log(`  结算状态: ${status}`);
                console.log(`  结算时间: ${bet.settled_at || '无'}`);
                console.log(`  中奖状态: ${winStatus}`);
                console.log('');
            });
            
            // 检查是否有未结算的注单
            const unsettledCount = bets.filter(bet => !bet.settled).length;
            if (unsettledCount > 0) {
                console.log(`⚠️ 发现 ${unsettledCount} 笔未结算的注单！`);
            } else {
                console.log(`✅ 所有注单都已结算`);
            }
        } else {
            console.log('未找到期号229第6名的投注记录');
        }
        
        // 3. 检查结算日志
        console.log('\n📝 检查结算日志：');
        try {
            const settlementLogs = await db.any(`
                SELECT period, settled_count, total_win_amount, settlement_details, created_at
                FROM settlement_logs
                WHERE period = 20250714229
                ORDER BY created_at ASC
            `);
            
            if (settlementLogs.length > 0) {
                console.log(`找到 ${settlementLogs.length} 条结算记录：`);
                settlementLogs.forEach((log, idx) => {
                    console.log(`\n记录 ${idx + 1} (${log.created_at}):`);
                    console.log(`  结算数量: ${log.settled_count}`);
                    console.log(`  总中奖金额: $${log.total_win_amount}`);
                    
                    if (log.settlement_details) {
                        try {
                            const details = JSON.parse(log.settlement_details);
                            const position6Bets = details.filter(d => d.username === 'justin111');
                            if (position6Bets.length > 0) {
                                console.log(`  justin111的结算:`);
                                position6Bets.forEach(detail => {
                                    console.log(`    ID ${detail.betId}: ${detail.isWin ? '中奖' : '未中奖'} $${detail.winAmount || 0}`);
                                });
                            }
                        } catch (e) {
                            console.log(`  详情解析失败: ${e.message}`);
                        }
                    }
                });
            } else {
                console.log('❌ 未找到结算日志记录');
                console.log('这表明结算系统可能没有执行或执行失败');
            }
        } catch (error) {
            console.log('结算日志查询失败:', error.message);
        }
        
        // 4. 检查可能的结算问题
        console.log('\n🔍 诊断可能的问题：');
        
        // 检查当前游戏状态
        try {
            const currentState = await db.oneOrNone(`
                SELECT current_period, status, countdown_seconds, last_result
                FROM game_state
                ORDER BY id DESC
                LIMIT 1
            `);
            
            if (currentState) {
                console.log(`当前游戏期号: ${currentState.current_period}`);
                console.log(`当前状态: ${currentState.status}`);
                console.log(`倒计时: ${currentState.countdown_seconds}秒`);
                
                if (currentState.current_period > 20250714229) {
                    console.log('✅ 游戏已进入下一期，期号229应该已结算');
                } else {
                    console.log('⚠️ 游戏可能还在期号229或之前');
                }
            }
        } catch (error) {
            console.log('游戏状态查询失败:', error.message);
        }
        
        // 5. 检查settlement_locks表是否有卡住的锁
        try {
            const locks = await db.any(`
                SELECT lock_key, locked_at, expires_at
                FROM settlement_locks
                WHERE lock_key LIKE '%229%' OR expires_at > NOW()
            `);
            
            if (locks.length > 0) {
                console.log('\n🔒 发现活跃的结算锁：');
                locks.forEach(lock => {
                    const isExpired = new Date(lock.expires_at) < new Date();
                    console.log(`  ${lock.lock_key}: ${isExpired ? '已过期' : '仍活跃'} (${lock.expires_at})`);
                });
            } else {
                console.log('\n✅ 没有活跃的结算锁');
            }
        } catch (error) {
            console.log('结算锁查询失败:', error.message);
        }
        
        // 6. 检查是否需要手动触发结算
        if (result && bets.length > 0) {
            const unsettledBets = bets.filter(bet => !bet.settled);
            if (unsettledBets.length > 0) {
                console.log('\n🔧 需要执行的修复动作：');
                console.log('1. 手动触发期号229的结算');
                console.log('2. 检查结算系统是否正常运行');
                console.log('3. 清理可能卡住的结算锁');
                console.log('4. 验证结算结果的正确性');
                
                console.log('\n📋 未结算的注单ID：');
                unsettledBets.forEach(bet => {
                    console.log(`  ID ${bet.id}: 投注${bet.bet_value}号, 金额 $${bet.amount}`);
                });
            }
        }
        
    } catch (error) {
        console.error('检查过程中发生错误:', error);
    } finally {
        await db.$pool.end();
    }
}

// 执行检查
checkPeriod229();