// verify-settlement-fix.js - 驗證結算修復是否生效
import db from './db/config.js';

async function verifySettlementFix() {
    console.log('🔍 驗證結算修復是否生效...\n');
    
    try {
        // 1. 檢查最近是否還有新的 adjustment 交易
        console.log('1️⃣ 檢查最近的 adjustment 交易...');
        const recentAdjustments = await db.any(`
            SELECT 
                tr.id,
                tr.amount,
                tr.balance_before,
                tr.balance_after,
                tr.description,
                tr.created_at,
                m.username
            FROM transaction_records tr
            JOIN members m ON tr.user_id = m.id AND tr.user_type = 'member'
            WHERE tr.transaction_type = 'adjustment'
            AND tr.amount = 989
            AND tr.description = '會員點數設置'
            AND tr.created_at >= NOW() - INTERVAL '30 minutes'
            ORDER BY tr.created_at DESC
        `);
        
        if (recentAdjustments.length > 0) {
            console.log(`⚠️ 警告：發現 ${recentAdjustments.length} 筆新的 989 元 adjustment 交易！`);
            recentAdjustments.forEach(adj => {
                console.log(`  - ${adj.username} 在 ${new Date(adj.created_at).toLocaleString()}`);
            });
            console.log('\n修復可能未生效，請檢查：');
            console.log('1. backend.js 是否已重啟');
            console.log('2. 是否有其他進程在運行舊版本');
        } else {
            console.log('✅ 最近 30 分鐘沒有新的可疑 adjustment 交易');
        }
        
        // 2. 檢查最近的中獎記錄是否有對應的 win 交易
        console.log('\n2️⃣ 檢查最近的中獎記錄...');
        const recentWins = await db.any(`
            SELECT 
                bh.id,
                bh.period,
                bh.username,
                bh.win_amount,
                bh.created_at as bet_time,
                m.id as member_id,
                (SELECT COUNT(*) FROM transaction_records tr 
                 WHERE tr.user_id = m.id 
                 AND tr.user_type = 'member'
                 AND tr.transaction_type = 'win'
                 AND tr.amount = bh.win_amount
                 AND tr.created_at >= bh.created_at
                 AND tr.created_at <= bh.created_at + INTERVAL '5 minutes'
                ) as win_tx_count
            FROM bet_history bh
            JOIN members m ON bh.username = m.username
            WHERE bh.win = true
            AND bh.settled = true
            AND bh.created_at >= NOW() - INTERVAL '30 minutes'
            ORDER BY bh.created_at DESC
        `);
        
        if (recentWins.length > 0) {
            console.log(`找到 ${recentWins.length} 筆最近的中獎記錄`);
            let hasProperWinTx = 0;
            let missingWinTx = 0;
            
            recentWins.forEach(win => {
                if (win.win_tx_count > 0) {
                    hasProperWinTx++;
                    console.log(`  ✅ ${win.username} 期號 ${win.period}: 有正確的 win 交易`);
                } else {
                    missingWinTx++;
                    console.log(`  ❌ ${win.username} 期號 ${win.period}: 缺少 win 交易`);
                }
            });
            
            if (missingWinTx > 0) {
                console.log(`\n⚠️ 有 ${missingWinTx} 筆中獎缺少正確的 win 交易記錄`);
                console.log('這表示可能仍在使用舊的結算邏輯');
            } else {
                console.log('\n✅ 所有中獎都有正確的 win 交易記錄');
            }
        } else {
            console.log('最近 30 分鐘沒有中獎記錄');
        }
        
        // 3. 檢查用戶餘額是否正常
        console.log('\n3️⃣ 檢查用戶餘額狀態...');
        const userBalance = await db.oneOrNone(`
            SELECT username, balance FROM members WHERE username = 'justin111'
        `);
        
        if (userBalance) {
            console.log(`用戶 justin111 當前餘額: ${userBalance.balance}`);
            console.log('（應該是 141,773.49 或根據後續投注有所變化）');
        }
        
        console.log('\n📋 總結：');
        console.log('修復已完成，請進行以下測試：');
        console.log('1. 重啟 backend.js 服務');
        console.log('2. 進行新的投注並等待中獎');
        console.log('3. 確認中獎後餘額只增加正確的金額（989-900=89）');
        console.log('4. 檢查交易記錄應該只有 win 類型，沒有 adjustment');
        
    } catch (error) {
        console.error('驗證過程中發生錯誤:', error);
    } finally {
        await db.$pool.end();
    }
}

// 執行驗證
verifySettlementFix();