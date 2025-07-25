// analyze-balance-issue.js - 分析余额异常问题
import db from './db/config.js';

async function analyzeBalanceIssue() {
    console.log('🔍 分析余额异常增加问题...\n');
    
    try {
        // 1. 检查最近的交易记录
        console.log('1️⃣ 检查 justin111 的最近交易记录...');
        const transactions = await db.any(`
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
            AND tr.created_at >= NOW() - INTERVAL '2 hours'
            ORDER BY tr.created_at DESC
        `);
        
        console.log(`找到 ${transactions.length} 笔交易记录：\n`);
        
        let suspiciousTransactions = [];
        
        transactions.forEach(tx => {
            const balanceChange = tx.balance_after - tx.balance_before;
            console.log(`时间: ${new Date(tx.created_at).toLocaleString()}`);
            console.log(`类型: ${tx.transaction_type}`);
            console.log(`金额: ${tx.amount}`);
            console.log(`余额: ${tx.balance_before} → ${tx.balance_after}`);
            console.log(`变化: ${balanceChange > 0 ? '+' : ''}${balanceChange.toFixed(2)}`);
            console.log(`描述: ${tx.description}`);
            
            // 检查中奖交易
            if (tx.transaction_type === 'win') {
                const expectedChange = parseFloat(tx.amount);
                if (Math.abs(balanceChange - expectedChange) > 0.01) {
                    console.log(`⚠️ 异常：预期增加 ${expectedChange}，实际增加 ${balanceChange}`);
                    suspiciousTransactions.push(tx);
                }
                
                // 检查是否有重复的中奖交易
                const periodMatch = tx.description.match(/期号 (\d+)/);
                if (periodMatch) {
                    console.log(`期号: ${periodMatch[1]}`);
                }
            }
            
            console.log('---\n');
        });
        
        // 2. 检查特定期号的中奖情况
        console.log('2️⃣ 检查最近期号的详细中奖记录...');
        
        // 获取最近有中奖的期号
        const recentWinPeriods = await db.any(`
            SELECT DISTINCT period
            FROM bet_history
            WHERE username = 'justin111'
            AND win = true
            AND created_at >= NOW() - INTERVAL '2 hours'
            ORDER BY period DESC
            LIMIT 5
        `);
        
        for (const record of recentWinPeriods) {
            const period = record.period;
            console.log(`\n📋 期号 ${period}:`);
            
            // 获取该期所有中奖记录
            const allWins = await db.any(`
                SELECT 
                    id,
                    username,
                    bet_type,
                    bet_value,
                    position,
                    amount,
                    win_amount,
                    settled,
                    created_at
                FROM bet_history
                WHERE period = $1
                AND win = true
                ORDER BY username, id
            `, [period]);
            
            // 统计每个用户的中奖情况
            const userStats = {};
            allWins.forEach(win => {
                if (!userStats[win.username]) {
                    userStats[win.username] = {
                        count: 0,
                        totalWin: 0,
                        details: []
                    };
                }
                userStats[win.username].count++;
                userStats[win.username].totalWin += parseFloat(win.win_amount);
                userStats[win.username].details.push({
                    id: win.id,
                    type: win.bet_type,
                    value: win.bet_value,
                    amount: win.amount,
                    winAmount: win.win_amount
                });
            });
            
            // 显示统计
            Object.entries(userStats).forEach(([username, stats]) => {
                console.log(`  用户: ${username}`);
                console.log(`  中奖次数: ${stats.count}`);
                console.log(`  总中奖金额: ${stats.totalWin}`);
                
                if (username === 'justin111') {
                    console.log(`  详细中奖：`);
                    stats.details.forEach(d => {
                        console.log(`    - ID: ${d.id}, ${d.type}=${d.value}, 下注${d.amount}, 中奖${d.winAmount}`);
                    });
                    
                    if (stats.count > 1) {
                        console.log(`  ⚠️ 警告：同一期有多笔中奖记录！`);
                    }
                    if (stats.totalWin > 989) {
                        console.log(`  ⚠️ 警告：总中奖金额异常！`);
                    }
                }
            });
            
            // 检查该期的交易记录
            const periodTransactions = await db.any(`
                SELECT COUNT(*) as count, SUM(amount) as total
                FROM transaction_records tr
                JOIN members m ON tr.user_id = m.id AND tr.user_type = 'member'
                WHERE m.username = 'justin111'
                AND tr.transaction_type = 'win'
                AND tr.description LIKE '%期号 ' || $1 || '%'
            `, [period]);
            
            if (periodTransactions[0].count > 0) {
                console.log(`  交易记录: ${periodTransactions[0].count} 笔，总额 ${periodTransactions[0].total}`);
                if (periodTransactions[0].count > 1) {
                    console.log(`  ⚠️ 警告：同一期有多笔中奖交易！可能重复结算！`);
                }
            }
        }
        
        // 3. 分析可能的原因
        console.log('\n\n📊 分析结果：');
        if (suspiciousTransactions.length > 0) {
            console.log(`发现 ${suspiciousTransactions.length} 笔异常交易`);
        }
        
        // 检查是否有并发结算
        const concurrentSettlements = await db.any(`
            SELECT 
                period,
                COUNT(DISTINCT settled_at) as different_times,
                COUNT(*) as total_count
            FROM bet_history
            WHERE username = 'justin111'
            AND settled = true
            AND settled_at IS NOT NULL
            AND created_at >= NOW() - INTERVAL '2 hours'
            GROUP BY period
            HAVING COUNT(DISTINCT settled_at) > 1
        `);
        
        if (concurrentSettlements.length > 0) {
            console.log('\n⚠️ 发现并发结算问题：');
            concurrentSettlements.forEach(cs => {
                console.log(`  期号 ${cs.period}: ${cs.different_times} 个不同的结算时间`);
            });
        }
        
        // 提供解决方案
        console.log('\n💡 可能的问题和解决方案：');
        console.log('1. 如果余额从 147,618 → 146,718（下注900）→ 148,696（增加1,978而非89）');
        console.log('   表示中奖金额被加了两次：989（含本金）+ 989 = 1,978');
        console.log('\n2. 可能的原因：');
        console.log('   - 改进的结算系统和旧的结算系统同时执行');
        console.log('   - 结算时余额增加了总奖金（989）而不是净利润（89）');
        console.log('   - 代理系统也在同步更新余额');
        console.log('\n3. 建议修复：');
        console.log('   - 确认 backend.js 只调用 improvedSettleBets');
        console.log('   - 检查是否有其他地方也在更新用户余额');
        console.log('   - 确保结算锁机制正常工作');
        
    } catch (error) {
        console.error('分析过程中发生错误:', error);
    } finally {
        await db.$pool.end();
    }
}

// 执行分析
analyzeBalanceIssue();