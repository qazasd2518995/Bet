// analyze-balance-issue.js - 分析餘額異常問題
import db from './db/config.js';

async function analyzeBalanceIssue() {
    console.log('🔍 分析餘額異常增加問題...\n');
    
    try {
        // 1. 檢查最近的交易記錄
        console.log('1️⃣ 檢查 justin111 的最近交易記錄...');
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
        
        console.log(`找到 ${transactions.length} 筆交易記錄：\n`);
        
        let suspiciousTransactions = [];
        
        transactions.forEach(tx => {
            const balanceChange = tx.balance_after - tx.balance_before;
            console.log(`時間: ${new Date(tx.created_at).toLocaleString()}`);
            console.log(`類型: ${tx.transaction_type}`);
            console.log(`金額: ${tx.amount}`);
            console.log(`餘額: ${tx.balance_before} → ${tx.balance_after}`);
            console.log(`變化: ${balanceChange > 0 ? '+' : ''}${balanceChange.toFixed(2)}`);
            console.log(`描述: ${tx.description}`);
            
            // 檢查中獎交易
            if (tx.transaction_type === 'win') {
                const expectedChange = parseFloat(tx.amount);
                if (Math.abs(balanceChange - expectedChange) > 0.01) {
                    console.log(`⚠️ 異常：預期增加 ${expectedChange}，實際增加 ${balanceChange}`);
                    suspiciousTransactions.push(tx);
                }
                
                // 檢查是否有重複的中獎交易
                const periodMatch = tx.description.match(/期號 (\d+)/);
                if (periodMatch) {
                    console.log(`期號: ${periodMatch[1]}`);
                }
            }
            
            console.log('---\n');
        });
        
        // 2. 檢查特定期號的中獎情況
        console.log('2️⃣ 檢查最近期號的詳細中獎記錄...');
        
        // 獲取最近有中獎的期號
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
            console.log(`\n📋 期號 ${period}:`);
            
            // 獲取該期所有中獎記錄
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
            
            // 統計每個用戶的中獎情況
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
            
            // 顯示統計
            Object.entries(userStats).forEach(([username, stats]) => {
                console.log(`  用戶: ${username}`);
                console.log(`  中獎次數: ${stats.count}`);
                console.log(`  總中獎金額: ${stats.totalWin}`);
                
                if (username === 'justin111') {
                    console.log(`  詳細中獎：`);
                    stats.details.forEach(d => {
                        console.log(`    - ID: ${d.id}, ${d.type}=${d.value}, 下注${d.amount}, 中獎${d.winAmount}`);
                    });
                    
                    if (stats.count > 1) {
                        console.log(`  ⚠️ 警告：同一期有多筆中獎記錄！`);
                    }
                    if (stats.totalWin > 989) {
                        console.log(`  ⚠️ 警告：總中獎金額異常！`);
                    }
                }
            });
            
            // 檢查該期的交易記錄
            const periodTransactions = await db.any(`
                SELECT COUNT(*) as count, SUM(amount) as total
                FROM transaction_records tr
                JOIN members m ON tr.user_id = m.id AND tr.user_type = 'member'
                WHERE m.username = 'justin111'
                AND tr.transaction_type = 'win'
                AND tr.description LIKE '%期號 ' || $1 || '%'
            `, [period]);
            
            if (periodTransactions[0].count > 0) {
                console.log(`  交易記錄: ${periodTransactions[0].count} 筆，總額 ${periodTransactions[0].total}`);
                if (periodTransactions[0].count > 1) {
                    console.log(`  ⚠️ 警告：同一期有多筆中獎交易！可能重複結算！`);
                }
            }
        }
        
        // 3. 分析可能的原因
        console.log('\n\n📊 分析結果：');
        if (suspiciousTransactions.length > 0) {
            console.log(`發現 ${suspiciousTransactions.length} 筆異常交易`);
        }
        
        // 檢查是否有並發結算
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
            console.log('\n⚠️ 發現並發結算問題：');
            concurrentSettlements.forEach(cs => {
                console.log(`  期號 ${cs.period}: ${cs.different_times} 個不同的結算時間`);
            });
        }
        
        // 提供解決方案
        console.log('\n💡 可能的問題和解決方案：');
        console.log('1. 如果餘額從 147,618 → 146,718（下注900）→ 148,696（增加1,978而非89）');
        console.log('   表示中獎金額被加了兩次：989（含本金）+ 989 = 1,978');
        console.log('\n2. 可能的原因：');
        console.log('   - 改進的結算系統和舊的結算系統同時執行');
        console.log('   - 結算時餘額增加了總獎金（989）而不是淨利潤（89）');
        console.log('   - 代理系統也在同步更新餘額');
        console.log('\n3. 建議修復：');
        console.log('   - 確認 backend.js 只調用 improvedSettleBets');
        console.log('   - 檢查是否有其他地方也在更新用戶餘額');
        console.log('   - 確保結算鎖機制正常工作');
        
    } catch (error) {
        console.error('分析過程中發生錯誤:', error);
    } finally {
        await db.$pool.end();
    }
}

// 執行分析
analyzeBalanceIssue();