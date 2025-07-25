// check-specific-win-calculation.js - 检查特定的中奖计算问题
import db from './db/config.js';

async function checkWinCalculation() {
    console.log('🔍 检查9码投注的中奖计算...\n');
    
    try {
        // 检查最近的9码投注（号码9的投注）
        const recentBets = await db.any(`
            SELECT 
                bh.*,
                rh.result,
                m.balance as user_balance
            FROM bet_history bh
            JOIN members m ON bh.username = m.username
            LEFT JOIN result_history rh ON bh.period = rh.period
            WHERE bh.bet_value = '9' 
            AND bh.bet_type IN ('number', 'champion', 'runnerup', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth')
            AND bh.created_at >= NOW() - INTERVAL '24 hours'
            ORDER BY bh.period DESC, bh.created_at DESC
            LIMIT 20
        `);
        
        console.log(`找到 ${recentBets.length} 笔9码投注记录\n`);
        
        // 分析每笔投注
        for (const bet of recentBets) {
            console.log(`期号: ${bet.period}`);
            console.log(`用户: ${bet.username}, 当前余额: ${bet.user_balance}`);
            console.log(`投注: ${bet.bet_type} = ${bet.bet_value}, 位置: ${bet.position || 'N/A'}`);
            console.log(`金额: ${bet.amount}, 赔率: ${bet.odds || '未记录'}`);
            console.log(`结算状态: ${bet.settled ? '已结算' : '未结算'}`);
            
            if (bet.settled) {
                console.log(`中奖: ${bet.win ? '是' : '否'}, 中奖金额: ${bet.win_amount || 0}`);
                
                if (bet.win && bet.win_amount) {
                    const expectedWin = parseFloat(bet.amount) * 9.89;
                    const actualWin = parseFloat(bet.win_amount);
                    const netProfit = actualWin - parseFloat(bet.amount);
                    
                    console.log(`预期中奖: ${expectedWin.toFixed(2)}`);
                    console.log(`实际中奖: ${actualWin.toFixed(2)}`);
                    console.log(`净利润: ${netProfit.toFixed(2)}`);
                    
                    if (Math.abs(actualWin - expectedWin) > 0.01) {
                        console.log(`⚠️ 中奖金额异常！`);
                    }
                }
            }
            
            if (bet.result) {
                const result = JSON.parse(bet.result);
                console.log(`开奖结果: ${result.positions.join(', ')}`);
                
                // 检查是否应该中奖
                let shouldWin = false;
                if (bet.bet_type === 'champion' && result.positions[0] === 9) shouldWin = true;
                else if (bet.bet_type === 'runnerup' && result.positions[1] === 9) shouldWin = true;
                else if (bet.bet_type === 'number' && bet.position && result.positions[bet.position - 1] === 9) shouldWin = true;
                // ... 其他位置类似
                
                if (shouldWin && !bet.win) {
                    console.log(`❌ 应该中奖但未中奖！`);
                } else if (!shouldWin && bet.win) {
                    console.log(`❌ 不应该中奖但中奖了！`);
                }
            }
            
            console.log('---\n');
        }
        
        // 检查该用户的交易记录
        console.log('📊 检查相关的交易记录...\n');
        const transactions = await db.any(`
            SELECT 
                tr.*,
                m.username
            FROM transaction_records tr
            JOIN members m ON tr.user_id = m.id AND tr.user_type = 'member'
            WHERE m.username IN (SELECT DISTINCT username FROM bet_history WHERE bet_value = '9' AND created_at >= NOW() - INTERVAL '24 hours')
            AND tr.transaction_type = 'win'
            AND tr.created_at >= NOW() - INTERVAL '24 hours'
            ORDER BY tr.created_at DESC
            LIMIT 20
        `);
        
        console.log(`找到 ${transactions.length} 笔中奖交易记录：`);
        transactions.forEach(tx => {
            console.log(`  用户: ${tx.username}`);
            console.log(`  金额: ${tx.amount}`);
            console.log(`  余额: ${tx.balance_before} → ${tx.balance_after}`);
            console.log(`  描述: ${tx.description}`);
            console.log(`  时间: ${tx.created_at}`);
            console.log('  ---');
        });
        
        // 检查是否有多次结算的情况
        console.log('\n🔄 检查是否有多次结算...\n');
        const multipleWins = await db.any(`
            WITH win_analysis AS (
                SELECT 
                    period,
                    username,
                    COUNT(CASE WHEN win THEN 1 END) as win_count,
                    SUM(CASE WHEN win THEN win_amount ELSE 0 END) as total_win,
                    COUNT(*) as bet_count,
                    SUM(amount) as total_bet_amount,
                    STRING_AGG(CASE WHEN win THEN bet_type || '(' || bet_value || ')' END, ', ') as winning_bets
                FROM bet_history
                WHERE bet_value = '9'
                AND created_at >= NOW() - INTERVAL '24 hours'
                AND settled = true
                GROUP BY period, username
                HAVING COUNT(CASE WHEN win THEN 1 END) > 0
            )
            SELECT * FROM win_analysis
            WHERE total_win > total_bet_amount * 2  -- 中奖金额超过下注金额的2倍
            ORDER BY period DESC, total_win DESC
        `);
        
        if (multipleWins.length > 0) {
            console.log(`⚠️ 发现异常高的中奖记录：`);
            multipleWins.forEach(record => {
                console.log(`  期号: ${record.period}, 用户: ${record.username}`);
                console.log(`  下注: ${record.bet_count}次, 共${record.total_bet_amount}元`);
                console.log(`  中奖: ${record.win_count}次, 共${record.total_win}元`);
                console.log(`  中奖投注: ${record.winning_bets}`);
                console.log(`  倍率: ${(record.total_win / record.total_bet_amount).toFixed(2)}x`);
                console.log('  ---');
            });
        }
        
    } catch (error) {
        console.error('检查过程中发生错误:', error);
    } finally {
        await db.$pool.end();
    }
}

// 执行检查
checkWinCalculation();