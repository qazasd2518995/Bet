// diagnose-multiple-bet-settlement.js - 诊断多笔下注结算问题
import db from './db/config.js';

async function diagnoseMultipleBetSettlement() {
    console.log('🔍 诊断多笔下注结算问题...\n');
    
    try {
        // 1. 查找 justin111 最近的下注记录
        console.log('📊 查找 justin111 最近的下注记录：');
        const recentBets = await db.manyOrNone(`
            SELECT 
                id,
                username,
                bet_type,
                bet_value,
                position,
                amount,
                odds,
                period,
                win,
                win_amount,
                settled,
                created_at
            FROM bet_history
            WHERE username = 'justin111'
            AND created_at > NOW() - INTERVAL '1 hour'
            ORDER BY created_at DESC
            LIMIT 20
        `);
        
        if (recentBets && recentBets.length > 0) {
            console.log(`找到 ${recentBets.length} 笔最近的下注记录：`);
            
            // 按期号分组
            const betsByPeriod = {};
            recentBets.forEach(bet => {
                if (!betsByPeriod[bet.period]) {
                    betsByPeriod[bet.period] = [];
                }
                betsByPeriod[bet.period].push(bet);
            });
            
            // 显示每期的下注详情
            for (const [period, bets] of Object.entries(betsByPeriod)) {
                console.log(`\n期号 ${period}：`);
                console.log(`  下注数量：${bets.length}`);
                
                let totalBetAmount = 0;
                let totalWinAmount = 0;
                let winCount = 0;
                
                bets.forEach(bet => {
                    totalBetAmount += parseFloat(bet.amount);
                    if (bet.win) {
                        winCount++;
                        totalWinAmount += parseFloat(bet.win_amount || 0);
                    }
                    
                    console.log(`  - ID: ${bet.id}, 类型: ${bet.bet_type}, 值: ${bet.bet_value}, 金额: ${bet.amount}, 中奖: ${bet.win ? '是' : '否'}, 奖金: ${bet.win_amount || 0}`);
                });
                
                console.log(`  总下注: ${totalBetAmount}, 中奖数: ${winCount}, 总奖金: ${totalWinAmount}`);
                
                // 检查是否有异常
                if (winCount === 1 && bets.length > 1 && totalWinAmount > 1000) {
                    console.log(`  ⚠️ 可能的异常：只有1个中奖但总奖金过高`);
                }
            }
        } else {
            console.log('没有找到最近的下注记录');
        }
        
        // 2. 查看最近的交易记录
        console.log('\n📊 查看 justin111 最近的交易记录：');
        const recentTransactions = await db.manyOrNone(`
            SELECT 
                tr.id,
                tr.transaction_type,
                tr.amount,
                tr.balance_before,
                tr.balance_after,
                tr.description,
                tr.created_at
            FROM transaction_records tr
            JOIN members m ON tr.user_id = m.id AND tr.user_type = 'member'
            WHERE m.username = 'justin111'
            AND tr.created_at > NOW() - INTERVAL '1 hour'
            ORDER BY tr.created_at DESC
            LIMIT 20
        `);
        
        if (recentTransactions && recentTransactions.length > 0) {
            console.log(`找到 ${recentTransactions.length} 笔交易记录：`);
            recentTransactions.forEach(tx => {
                console.log(`  - ${tx.created_at}: ${tx.transaction_type} ${tx.amount}, 余额: ${tx.balance_before} → ${tx.balance_after}, 说明: ${tx.description}`);
            });
        }
        
        // 3. 检查结算日志
        console.log('\n📊 检查最近的结算日志：');
        const settlementLogs = await db.manyOrNone(`
            SELECT 
                period,
                settled_count,
                total_win_amount,
                settlement_details,
                created_at
            FROM settlement_logs
            WHERE created_at > NOW() - INTERVAL '1 hour'
            ORDER BY created_at DESC
            LIMIT 10
        `);
        
        if (settlementLogs && settlementLogs.length > 0) {
            console.log(`找到 ${settlementLogs.length} 笔结算日志：`);
            settlementLogs.forEach(log => {
                console.log(`\n  期号 ${log.period}：`);
                console.log(`  - 结算数量: ${log.settled_count}`);
                console.log(`  - 总奖金: ${log.total_win_amount}`);
                console.log(`  - 时间: ${log.created_at}`);
                
                // 解析详细信息
                if (log.settlement_details) {
                    const details = log.settlement_details;
                    const justinBets = details.filter(d => d.username === 'justin111');
                    if (justinBets.length > 0) {
                        console.log(`  - justin111 的注单：`);
                        justinBets.forEach(d => {
                            console.log(`    ID: ${d.betId}, 中奖: ${d.isWin}, 奖金: ${d.winAmount}`);
                        });
                    }
                }
            });
        }
        
        // 4. 分析可能的问题
        console.log('\n🔍 分析可能的问题：');
        
        // 检查是否有重复的中奖记录
        const duplicateWins = await db.manyOrNone(`
            SELECT 
                period,
                username,
                COUNT(*) as bet_count,
                SUM(CASE WHEN win = true THEN 1 ELSE 0 END) as win_count,
                SUM(amount) as total_bet,
                SUM(win_amount) as total_win
            FROM bet_history
            WHERE username = 'justin111'
            AND settled = true
            AND created_at > NOW() - INTERVAL '1 hour'
            GROUP BY period, username
            HAVING COUNT(*) > 5
            ORDER BY period DESC
        `);
        
        if (duplicateWins && duplicateWins.length > 0) {
            console.log('发现多笔下注的期号：');
            duplicateWins.forEach(record => {
                console.log(`  期号 ${record.period}: ${record.bet_count} 笔下注, ${record.win_count} 笔中奖, 总下注 ${record.total_bet}, 总奖金 ${record.total_win}`);
                
                // 计算预期奖金
                const expectedWin = parseFloat(record.total_bet) * 0.89; // 假设赔率是 0.89
                const actualWin = parseFloat(record.total_win || 0);
                
                if (Math.abs(actualWin - expectedWin) > 100 && record.win_count === 1) {
                    console.log(`  ⚠️ 奖金异常：预期 ${expectedWin.toFixed(2)}, 实际 ${actualWin.toFixed(2)}`);
                }
            });
        }
        
        console.log('\n💡 建议：');
        console.log('1. 检查 calculateWinAmount 函数是否正确处理号码投注的赔率');
        console.log('2. 确认结算时是否正确识别中奖注单');
        console.log('3. 检查是否有重复执行结算的情况');
        
    } catch (error) {
        console.error('❌ 诊断过程中发生错误:', error);
    }
}

// 如果直接执行此文件
if (process.argv[1] === new URL(import.meta.url).pathname) {
    diagnoseMultipleBetSettlement()
        .then(() => {
            console.log('\n诊断完成');
            process.exit(0);
        })
        .catch(error => {
            console.error('诊断失败:', error);
            process.exit(1);
        });
}

export default diagnoseMultipleBetSettlement;