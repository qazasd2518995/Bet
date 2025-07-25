// check-specific-win-calculation.js - 檢查特定的中獎計算問題
import db from './db/config.js';

async function checkWinCalculation() {
    console.log('🔍 檢查9碼投注的中獎計算...\n');
    
    try {
        // 檢查最近的9碼投注（號碼9的投注）
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
        
        console.log(`找到 ${recentBets.length} 筆9碼投注記錄\n`);
        
        // 分析每筆投注
        for (const bet of recentBets) {
            console.log(`期號: ${bet.period}`);
            console.log(`用戶: ${bet.username}, 當前餘額: ${bet.user_balance}`);
            console.log(`投注: ${bet.bet_type} = ${bet.bet_value}, 位置: ${bet.position || 'N/A'}`);
            console.log(`金額: ${bet.amount}, 賠率: ${bet.odds || '未記錄'}`);
            console.log(`結算狀態: ${bet.settled ? '已結算' : '未結算'}`);
            
            if (bet.settled) {
                console.log(`中獎: ${bet.win ? '是' : '否'}, 中獎金額: ${bet.win_amount || 0}`);
                
                if (bet.win && bet.win_amount) {
                    const expectedWin = parseFloat(bet.amount) * 9.89;
                    const actualWin = parseFloat(bet.win_amount);
                    const netProfit = actualWin - parseFloat(bet.amount);
                    
                    console.log(`預期中獎: ${expectedWin.toFixed(2)}`);
                    console.log(`實際中獎: ${actualWin.toFixed(2)}`);
                    console.log(`淨利潤: ${netProfit.toFixed(2)}`);
                    
                    if (Math.abs(actualWin - expectedWin) > 0.01) {
                        console.log(`⚠️ 中獎金額異常！`);
                    }
                }
            }
            
            if (bet.result) {
                const result = JSON.parse(bet.result);
                console.log(`開獎結果: ${result.positions.join(', ')}`);
                
                // 檢查是否應該中獎
                let shouldWin = false;
                if (bet.bet_type === 'champion' && result.positions[0] === 9) shouldWin = true;
                else if (bet.bet_type === 'runnerup' && result.positions[1] === 9) shouldWin = true;
                else if (bet.bet_type === 'number' && bet.position && result.positions[bet.position - 1] === 9) shouldWin = true;
                // ... 其他位置類似
                
                if (shouldWin && !bet.win) {
                    console.log(`❌ 應該中獎但未中獎！`);
                } else if (!shouldWin && bet.win) {
                    console.log(`❌ 不應該中獎但中獎了！`);
                }
            }
            
            console.log('---\n');
        }
        
        // 檢查該用戶的交易記錄
        console.log('📊 檢查相關的交易記錄...\n');
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
        
        console.log(`找到 ${transactions.length} 筆中獎交易記錄：`);
        transactions.forEach(tx => {
            console.log(`  用戶: ${tx.username}`);
            console.log(`  金額: ${tx.amount}`);
            console.log(`  餘額: ${tx.balance_before} → ${tx.balance_after}`);
            console.log(`  描述: ${tx.description}`);
            console.log(`  時間: ${tx.created_at}`);
            console.log('  ---');
        });
        
        // 檢查是否有多次結算的情況
        console.log('\n🔄 檢查是否有多次結算...\n');
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
            WHERE total_win > total_bet_amount * 2  -- 中獎金額超過下注金額的2倍
            ORDER BY period DESC, total_win DESC
        `);
        
        if (multipleWins.length > 0) {
            console.log(`⚠️ 發現異常高的中獎記錄：`);
            multipleWins.forEach(record => {
                console.log(`  期號: ${record.period}, 用戶: ${record.username}`);
                console.log(`  下注: ${record.bet_count}次, 共${record.total_bet_amount}元`);
                console.log(`  中獎: ${record.win_count}次, 共${record.total_win}元`);
                console.log(`  中獎投注: ${record.winning_bets}`);
                console.log(`  倍率: ${(record.total_win / record.total_bet_amount).toFixed(2)}x`);
                console.log('  ---');
            });
        }
        
    } catch (error) {
        console.error('檢查過程中發生錯誤:', error);
    } finally {
        await db.$pool.end();
    }
}

// 執行檢查
checkWinCalculation();