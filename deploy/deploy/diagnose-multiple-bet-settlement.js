// diagnose-multiple-bet-settlement.js - 診斷多筆下注結算問題
import db from './db/config.js';

async function diagnoseMultipleBetSettlement() {
    console.log('🔍 診斷多筆下注結算問題...\n');
    
    try {
        // 1. 查找 justin111 最近的下注記錄
        console.log('📊 查找 justin111 最近的下注記錄：');
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
            console.log(`找到 ${recentBets.length} 筆最近的下注記錄：`);
            
            // 按期號分組
            const betsByPeriod = {};
            recentBets.forEach(bet => {
                if (!betsByPeriod[bet.period]) {
                    betsByPeriod[bet.period] = [];
                }
                betsByPeriod[bet.period].push(bet);
            });
            
            // 顯示每期的下注詳情
            for (const [period, bets] of Object.entries(betsByPeriod)) {
                console.log(`\n期號 ${period}：`);
                console.log(`  下注數量：${bets.length}`);
                
                let totalBetAmount = 0;
                let totalWinAmount = 0;
                let winCount = 0;
                
                bets.forEach(bet => {
                    totalBetAmount += parseFloat(bet.amount);
                    if (bet.win) {
                        winCount++;
                        totalWinAmount += parseFloat(bet.win_amount || 0);
                    }
                    
                    console.log(`  - ID: ${bet.id}, 類型: ${bet.bet_type}, 值: ${bet.bet_value}, 金額: ${bet.amount}, 中獎: ${bet.win ? '是' : '否'}, 獎金: ${bet.win_amount || 0}`);
                });
                
                console.log(`  總下注: ${totalBetAmount}, 中獎數: ${winCount}, 總獎金: ${totalWinAmount}`);
                
                // 檢查是否有異常
                if (winCount === 1 && bets.length > 1 && totalWinAmount > 1000) {
                    console.log(`  ⚠️ 可能的異常：只有1個中獎但總獎金過高`);
                }
            }
        } else {
            console.log('沒有找到最近的下注記錄');
        }
        
        // 2. 查看最近的交易記錄
        console.log('\n📊 查看 justin111 最近的交易記錄：');
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
            console.log(`找到 ${recentTransactions.length} 筆交易記錄：`);
            recentTransactions.forEach(tx => {
                console.log(`  - ${tx.created_at}: ${tx.transaction_type} ${tx.amount}, 餘額: ${tx.balance_before} → ${tx.balance_after}, 說明: ${tx.description}`);
            });
        }
        
        // 3. 檢查結算日誌
        console.log('\n📊 檢查最近的結算日誌：');
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
            console.log(`找到 ${settlementLogs.length} 筆結算日誌：`);
            settlementLogs.forEach(log => {
                console.log(`\n  期號 ${log.period}：`);
                console.log(`  - 結算數量: ${log.settled_count}`);
                console.log(`  - 總獎金: ${log.total_win_amount}`);
                console.log(`  - 時間: ${log.created_at}`);
                
                // 解析詳細信息
                if (log.settlement_details) {
                    const details = log.settlement_details;
                    const justinBets = details.filter(d => d.username === 'justin111');
                    if (justinBets.length > 0) {
                        console.log(`  - justin111 的注單：`);
                        justinBets.forEach(d => {
                            console.log(`    ID: ${d.betId}, 中獎: ${d.isWin}, 獎金: ${d.winAmount}`);
                        });
                    }
                }
            });
        }
        
        // 4. 分析可能的問題
        console.log('\n🔍 分析可能的問題：');
        
        // 檢查是否有重複的中獎記錄
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
            console.log('發現多筆下注的期號：');
            duplicateWins.forEach(record => {
                console.log(`  期號 ${record.period}: ${record.bet_count} 筆下注, ${record.win_count} 筆中獎, 總下注 ${record.total_bet}, 總獎金 ${record.total_win}`);
                
                // 計算預期獎金
                const expectedWin = parseFloat(record.total_bet) * 0.89; // 假設賠率是 0.89
                const actualWin = parseFloat(record.total_win || 0);
                
                if (Math.abs(actualWin - expectedWin) > 100 && record.win_count === 1) {
                    console.log(`  ⚠️ 獎金異常：預期 ${expectedWin.toFixed(2)}, 實際 ${actualWin.toFixed(2)}`);
                }
            });
        }
        
        console.log('\n💡 建議：');
        console.log('1. 檢查 calculateWinAmount 函數是否正確處理號碼投注的賠率');
        console.log('2. 確認結算時是否正確識別中獎注單');
        console.log('3. 檢查是否有重複執行結算的情況');
        
    } catch (error) {
        console.error('❌ 診斷過程中發生錯誤:', error);
    }
}

// 如果直接執行此文件
if (process.argv[1] === new URL(import.meta.url).pathname) {
    diagnoseMultipleBetSettlement()
        .then(() => {
            console.log('\n診斷完成');
            process.exit(0);
        })
        .catch(error => {
            console.error('診斷失敗:', error);
            process.exit(1);
        });
}

export default diagnoseMultipleBetSettlement;