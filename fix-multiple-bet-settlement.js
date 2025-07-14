// fix-multiple-bet-settlement.js - 修復多筆下注結算問題
import db from './db/config.js';

// 修復重複的交易記錄
async function fixDuplicateTransactions() {
    console.log('🔧 開始修復重複的交易記錄...\n');
    
    try {
        // 1. 查找可能的重複交易
        const duplicates = await db.manyOrNone(`
            WITH duplicate_groups AS (
                SELECT 
                    user_id,
                    user_type,
                    transaction_type,
                    description,
                    created_at,
                    COUNT(*) as count,
                    array_agg(id ORDER BY id) as ids,
                    array_agg(amount ORDER BY id) as amounts,
                    array_agg(balance_after ORDER BY id) as balances
                FROM transaction_records
                WHERE transaction_type IN ('win', 'adjustment')
                AND created_at > NOW() - INTERVAL '24 hours'
                GROUP BY user_id, user_type, transaction_type, description, 
                         DATE_TRUNC('second', created_at)
                HAVING COUNT(*) > 1
            )
            SELECT * FROM duplicate_groups
            ORDER BY created_at DESC
        `);
        
        if (duplicates && duplicates.length > 0) {
            console.log(`找到 ${duplicates.length} 組重複交易`);
            
            for (const group of duplicates) {
                console.log(`\n用戶ID: ${group.user_id}, 類型: ${group.transaction_type}`);
                console.log(`描述: ${group.description}`);
                console.log(`時間: ${group.created_at}`);
                console.log(`交易ID: ${group.ids.join(', ')}`);
                console.log(`金額: ${group.amounts.join(', ')}`);
                
                // 只保留第一筆，刪除其他
                const idsToDelete = group.ids.slice(1);
                if (idsToDelete.length > 0) {
                    console.log(`將刪除交易ID: ${idsToDelete.join(', ')}`);
                    
                    // 取消註釋以執行刪除
                    /*
                    await db.none(`
                        DELETE FROM transaction_records 
                        WHERE id = ANY($1)
                    `, [idsToDelete]);
                    */
                }
            }
        } else {
            console.log('沒有找到重複的交易記錄');
        }
        
        // 2. 修正用戶餘額
        console.log('\n🔧 檢查並修正用戶餘額...');
        
        const balanceCheck = await db.manyOrNone(`
            WITH balance_calc AS (
                SELECT 
                    m.id,
                    m.username,
                    m.balance as current_balance,
                    COALESCE(
                        (SELECT balance_after 
                         FROM transaction_records 
                         WHERE user_id = m.id AND user_type = 'member'
                         ORDER BY created_at DESC, id DESC
                         LIMIT 1), 
                        m.balance
                    ) as last_transaction_balance
                FROM members m
                WHERE m.username IN ('justin111')
            )
            SELECT * FROM balance_calc
            WHERE current_balance != last_transaction_balance
        `);
        
        if (balanceCheck && balanceCheck.length > 0) {
            console.log('發現餘額不一致的用戶：');
            for (const user of balanceCheck) {
                console.log(`\n用戶: ${user.username}`);
                console.log(`當前餘額: ${user.current_balance}`);
                console.log(`最後交易餘額: ${user.last_transaction_balance}`);
                
                // 取消註釋以修正餘額
                /*
                await db.none(`
                    UPDATE members 
                    SET balance = $1 
                    WHERE id = $2
                `, [user.last_transaction_balance, user.id]);
                console.log('✅ 餘額已修正');
                */
            }
        } else {
            console.log('所有用戶餘額正常');
        }
        
    } catch (error) {
        console.error('❌ 修復過程中發生錯誤:', error);
    }
}

// 防止未來的重複結算
async function preventFutureDoubleSettlement() {
    console.log('\n🛡️ 加強防重複結算機制...');
    
    try {
        // 創建唯一索引防止重複
        await db.none(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_transaction_unique_win
            ON transaction_records(user_id, user_type, transaction_type, description, DATE_TRUNC('second', created_at))
            WHERE transaction_type = 'win'
        `);
        
        console.log('✅ 已創建防重複交易的唯一索引');
        
    } catch (error) {
        if (error.code === '23505') {
            console.log('⚠️ 唯一索引已存在');
        } else {
            console.error('❌ 創建索引時發生錯誤:', error);
        }
    }
}

// 主函數
async function main() {
    console.log('🚀 開始修復多筆下注結算問題...\n');
    
    await fixDuplicateTransactions();
    await preventFutureDoubleSettlement();
    
    console.log('\n✅ 修復完成！');
    console.log('\n建議：');
    console.log('1. 檢查改進的結算系統是否正確處理多筆下注');
    console.log('2. 確保同步到代理系統時不會重複更新餘額');
    console.log('3. 監控 transaction_records 表確保沒有重複記錄');
}

// 如果直接執行此文件
if (process.argv[1] === new URL(import.meta.url).pathname) {
    main()
        .then(() => {
            process.exit(0);
        })
        .catch(error => {
            console.error('執行失敗:', error);
            process.exit(1);
        });
}

export default main;