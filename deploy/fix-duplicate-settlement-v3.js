// fix-duplicate-settlement-v3.js - 修復重複結算問題
import db from './db/config.js';

async function fixDuplicateSettlement() {
    console.log('🔧 開始修復重複結算問題...\n');
    
    try {
        // 1. 檢查並移除重複的 adjustment 交易
        console.log('1️⃣ 查找重複的會員點數設置交易...');
        
        const duplicateAdjustments = await db.any(`
            WITH duplicate_adjustments AS (
                SELECT 
                    tr.id,
                    tr.user_id,
                    tr.amount,
                    tr.balance_before,
                    tr.balance_after,
                    tr.created_at,
                    m.username,
                    ROW_NUMBER() OVER (
                        PARTITION BY tr.user_id, tr.amount, DATE_TRUNC('minute', tr.created_at)
                        ORDER BY tr.id
                    ) as rn
                FROM transaction_records tr
                JOIN members m ON tr.user_id = m.id AND tr.user_type = 'member'
                WHERE tr.transaction_type = 'adjustment'
                AND tr.amount = 989
                AND tr.description = '會員點數設置'
                AND tr.created_at >= NOW() - INTERVAL '24 hours'
            )
            SELECT * FROM duplicate_adjustments
            WHERE rn > 1
            ORDER BY created_at DESC
        `);
        
        if (duplicateAdjustments.length > 0) {
            console.log(`發現 ${duplicateAdjustments.length} 筆重複的 adjustment 交易`);
            
            // 計算需要調整的總金額
            const adjustmentsByUser = {};
            duplicateAdjustments.forEach(adj => {
                if (!adjustmentsByUser[adj.username]) {
                    adjustmentsByUser[adj.username] = {
                        count: 0,
                        totalAmount: 0,
                        transactions: []
                    };
                }
                adjustmentsByUser[adj.username].count++;
                adjustmentsByUser[adj.username].totalAmount += parseFloat(adj.amount);
                adjustmentsByUser[adj.username].transactions.push(adj.id);
            });
            
            // 修正每個用戶的餘額
            for (const [username, data] of Object.entries(adjustmentsByUser)) {
                console.log(`\n修正用戶 ${username}:`);
                console.log(`  重複交易數: ${data.count}`);
                console.log(`  需要扣除: ${data.totalAmount}`);
                
                // 獲取當前餘額
                const member = await db.one(`
                    SELECT id, balance FROM members WHERE username = $1
                `, [username]);
                
                const currentBalance = parseFloat(member.balance);
                const newBalance = currentBalance - data.totalAmount;
                
                console.log(`  當前餘額: ${currentBalance}`);
                console.log(`  修正後餘額: ${newBalance}`);
                
                // 更新餘額
                await db.none(`
                    UPDATE members 
                    SET balance = $1, updated_at = NOW()
                    WHERE username = $2
                `, [newBalance, username]);
                
                // 記錄修正交易
                await db.none(`
                    INSERT INTO transaction_records 
                    (user_type, user_id, transaction_type, amount, balance_before, balance_after, description, created_at)
                    VALUES ('member', $1, 'adjustment', $2, $3, $4, '修正重複結算', NOW())
                `, [member.id, -data.totalAmount, currentBalance, newBalance]);
                
                // 標記重複的交易（可選）
                await db.none(`
                    UPDATE transaction_records 
                    SET description = description || ' (重複-已修正)'
                    WHERE id = ANY($1)
                `, [data.transactions]);
                
                console.log(`✅ 用戶 ${username} 餘額已修正`);
            }
        } else {
            console.log('✅ 沒有發現重複的 adjustment 交易');
        }
        
        // 2. 檢查是否有缺少 win 類型交易的中獎記錄
        console.log('\n2️⃣ 檢查缺少正常中獎交易的記錄...');
        
        const missingWinTransactions = await db.any(`
            SELECT 
                bh.id,
                bh.period,
                bh.username,
                bh.bet_type,
                bh.bet_value,
                bh.amount,
                bh.win_amount,
                m.id as member_id
            FROM bet_history bh
            JOIN members m ON bh.username = m.username
            WHERE bh.win = true
            AND bh.settled = true
            AND bh.created_at >= NOW() - INTERVAL '24 hours'
            AND NOT EXISTS (
                SELECT 1 FROM transaction_records tr
                WHERE tr.user_id = m.id
                AND tr.user_type = 'member'
                AND tr.transaction_type = 'win'
                AND tr.amount = bh.win_amount
                AND tr.created_at >= bh.created_at
                AND tr.created_at <= bh.created_at + INTERVAL '5 minutes'
            )
            ORDER BY bh.created_at DESC
        `);
        
        if (missingWinTransactions.length > 0) {
            console.log(`發現 ${missingWinTransactions.length} 筆缺少 win 交易的中獎記錄`);
            console.log('這些記錄可能是通過 adjustment 而不是正常的 win 交易處理的');
        }
        
        // 3. 提供修復建議
        console.log('\n📋 修復建議：');
        console.log('1. 修改 backend.js，移除舊的結算邏輯（legacySettleBets）');
        console.log('2. 確保 settleBets 函數只調用 improvedSettleBets');
        console.log('3. 移除結算後同步餘額到代理系統的代碼（sync-member-balance）');
        console.log('4. 讓 improved-settlement-system.js 統一處理所有結算邏輯');
        console.log('\n具體修改：');
        console.log('- 刪除 backend.js 第 2920-2939 行的餘額更新和同步代碼');
        console.log('- 確保結算只在 improved-settlement-system.js 中進行');
        console.log('- 代理系統不應該再接收結算相關的餘額同步請求');
        
    } catch (error) {
        console.error('修復過程中發生錯誤:', error);
    } finally {
        await db.$pool.end();
    }
}

// 執行修復
fixDuplicateSettlement();