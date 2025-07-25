// fix-duplicate-adjustments.js - 修復重複的 adjustment 交易
import db from './db/config.js';

async function fixDuplicateAdjustments() {
    console.log('🔧 修復重複的 adjustment 交易...\n');
    
    try {
        // 1. 找出重複的 adjustment 交易
        const duplicates = await db.manyOrNone(`
            WITH duplicate_adjustments AS (
                SELECT 
                    tr.user_id,
                    tr.amount,
                    tr.description,
                    DATE_TRUNC('minute', tr.created_at) as minute_bucket,
                    COUNT(*) as count,
                    array_agg(tr.id ORDER BY tr.id) as ids,
                    array_agg(tr.created_at ORDER BY tr.id) as times,
                    array_agg(tr.balance_after ORDER BY tr.id) as balances,
                    m.username
                FROM transaction_records tr
                JOIN members m ON tr.user_id = m.id AND tr.user_type = 'member'
                WHERE tr.transaction_type = 'adjustment'
                AND tr.description = '會員點數設置'
                AND tr.amount > 0
                AND tr.created_at > NOW() - INTERVAL '24 hours'
                GROUP BY tr.user_id, tr.amount, tr.description, DATE_TRUNC('minute', tr.created_at), m.username
                HAVING COUNT(*) > 1
            )
            SELECT * FROM duplicate_adjustments
            ORDER BY minute_bucket DESC
        `);
        
        if (duplicates.length === 0) {
            console.log('沒有找到重複的 adjustment 交易');
            return;
        }
        
        console.log(`找到 ${duplicates.length} 組重複的 adjustment 交易：\n`);
        
        let totalAmountToFix = 0;
        const fixCommands = [];
        
        for (const group of duplicates) {
            console.log(`用戶: ${group.username}`);
            console.log(`時間: ${new Date(group.minute_bucket).toLocaleString()}`);
            console.log(`金額: ${group.amount}`);
            console.log(`重複次數: ${group.count}`);
            console.log(`交易ID: ${group.ids.join(', ')}`);
            
            // 計算需要修正的金額（保留第一筆，刪除其他）
            const duplicateCount = group.count - 1;
            const amountToDeduct = parseFloat(group.amount) * duplicateCount;
            totalAmountToFix += amountToDeduct;
            
            console.log(`需要扣除: ${amountToDeduct} 元\n`);
            
            // 準備修復命令
            fixCommands.push({
                username: group.username,
                userId: group.user_id,
                amountToDeduct: amountToDeduct,
                idsToDelete: group.ids.slice(1), // 保留第一筆，刪除其他
                currentBalance: parseFloat(group.balances[group.balances.length - 1])
            });
        }
        
        console.log(`\n總計需要修復金額: ${totalAmountToFix} 元`);
        
        // 2. 執行修復
        console.log('\n執行修復...');
        
        for (const fix of fixCommands) {
            console.log(`\n修復用戶 ${fix.username}...`);
            
            await db.tx(async t => {
                // 刪除重複的交易記錄
                if (fix.idsToDelete.length > 0) {
                    await t.none(`
                        DELETE FROM transaction_records 
                        WHERE id = ANY($1)
                    `, [fix.idsToDelete]);
                    console.log(`  ✅ 已刪除 ${fix.idsToDelete.length} 筆重複交易`);
                }
                
                // 修正用戶餘額
                const newBalance = fix.currentBalance - fix.amountToDeduct;
                await t.none(`
                    UPDATE members 
                    SET balance = $1,
                        updated_at = NOW()
                    WHERE id = $2
                `, [newBalance, fix.userId]);
                console.log(`  ✅ 餘額已從 ${fix.currentBalance} 修正為 ${newBalance}`);
                
                // 記錄修正交易
                await t.none(`
                    INSERT INTO transaction_records 
                    (user_type, user_id, transaction_type, amount, balance_before, balance_after, description, created_at)
                    VALUES ('member', $1, 'adjustment', $2, $3, $4, $5, NOW())
                `, [fix.userId, -fix.amountToDeduct, fix.currentBalance, newBalance, '修正重複結算']);
                console.log(`  ✅ 已記錄修正交易`);
            });
        }
        
        console.log('\n✅ 修復完成！');
        
        // 3. 顯示修復 SQL（手動執行）
        console.log('\n或者，您可以手動執行以下 SQL：\n');
        for (const fix of fixCommands) {
            console.log(`-- 修復用戶 ${fix.username}`);
            if (fix.idsToDelete.length > 0) {
                console.log(`DELETE FROM transaction_records WHERE id IN (${fix.idsToDelete.join(', ')});`);
            }
            console.log(`UPDATE members SET balance = ${fix.currentBalance - fix.amountToDeduct} WHERE id = ${fix.userId};`);
            console.log(`INSERT INTO transaction_records (user_type, user_id, transaction_type, amount, balance_before, balance_after, description) VALUES ('member', ${fix.userId}, 'adjustment', ${-fix.amountToDeduct}, ${fix.currentBalance}, ${fix.currentBalance - fix.amountToDeduct}, '修正重複結算');`);
            console.log('');
        }
        
    } catch (error) {
        console.error('❌ 修復過程中發生錯誤:', error);
    }
}

// 執行
fixDuplicateAdjustments()
    .then(() => {
        console.log('\n分析完成');
        process.exit(0);
    })
    .catch(error => {
        console.error('執行失敗:', error);
        process.exit(1);
    });