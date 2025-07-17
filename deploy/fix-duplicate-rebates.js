import db from './db/config.js';

// 修正退水處理機制，避免重複計算
async function fixRebateSystem() {
    try {
        console.log('=== 開始修正退水系統 ===');
        
        // 1. 首先檢查並清理重複的退水記錄
        console.log('\n1. 檢查重複退水記錄...');
        const duplicates = await db.any(`
            WITH duplicate_rebates AS (
                SELECT 
                    period,
                    user_id,
                    user_type,
                    COUNT(*) as count,
                    MIN(id) as keep_id,
                    SUM(amount) as total_amount,
                    MAX(amount) as correct_amount
                FROM transaction_records
                WHERE transaction_type = 'rebate'
                    AND created_at > NOW() - INTERVAL '24 hours'
                    AND period IS NOT NULL
                GROUP BY period, user_id, user_type
                HAVING COUNT(*) > 1
            )
            SELECT * FROM duplicate_rebates
            ORDER BY period DESC
        `);
        
        console.log(`發現 ${duplicates.length} 組重複退水記錄`);
        
        if (duplicates.length > 0) {
            console.log('\n開始清理重複記錄...');
            
            for (const dup of duplicates) {
                // 獲取該用戶名稱
                const user = await db.oneOrNone(
                    dup.user_type === 'agent' 
                        ? 'SELECT username FROM agents WHERE id = $1'
                        : 'SELECT username FROM members WHERE id = $1',
                    [dup.user_id]
                );
                
                console.log(`\n處理 ${user?.username || '未知'} 在期號 ${dup.period} 的重複退水`);
                console.log(`  - 重複次數: ${dup.count}`);
                console.log(`  - 總金額: ${dup.total_amount}`);
                console.log(`  - 正確金額: ${dup.correct_amount}`);
                
                // 刪除重複記錄，只保留一筆
                const deleteResult = await db.result(`
                    DELETE FROM transaction_records
                    WHERE transaction_type = 'rebate'
                        AND period = $1
                        AND user_id = $2
                        AND user_type = $3
                        AND id != $4
                `, [dup.period, dup.user_id, dup.user_type, dup.keep_id]);
                
                console.log(`  - 刪除了 ${deleteResult.rowCount} 筆重複記錄`);
                
                // 修正餘額（如果有多收的退水）
                if (dup.count > 1) {
                    const excessAmount = dup.total_amount - dup.correct_amount;
                    if (excessAmount > 0) {
                        if (dup.user_type === 'agent') {
                            await db.none(`
                                UPDATE agents 
                                SET balance = balance - $1
                                WHERE id = $2
                            `, [excessAmount, dup.user_id]);
                        } else {
                            await db.none(`
                                UPDATE members 
                                SET balance = balance - $1
                                WHERE id = $2
                            `, [excessAmount, dup.user_id]);
                        }
                        console.log(`  - 已扣除多餘的退水金額: ${excessAmount}`);
                    }
                }
            }
        }
        
        // 2. 創建防重複的約束
        console.log('\n2. 創建防重複約束...');
        try {
            // 先檢查約束是否已存在
            const constraintExists = await db.oneOrNone(`
                SELECT constraint_name 
                FROM information_schema.table_constraints 
                WHERE table_name = 'transaction_records' 
                AND constraint_name = 'unique_rebate_per_period_user'
            `);
            
            if (!constraintExists) {
                await db.none(`
                    CREATE UNIQUE INDEX CONCURRENTLY unique_rebate_per_period_user 
                    ON transaction_records (period, user_id, user_type, transaction_type)
                    WHERE transaction_type = 'rebate' AND period IS NOT NULL
                `);
                console.log('✅ 已創建唯一索引防止重複退水');
            } else {
                console.log('唯一約束已存在');
            }
        } catch (err) {
            console.error('創建約束時出錯:', err.message);
        }
        
        // 3. 更新退水處理邏輯文件
        console.log('\n3. 生成修復後的退水處理邏輯...');
        const fixedRebateLogic = `
// 修復後的退水處理邏輯
async function processRebates(period) {
    try {
        settlementLog.info(\`💰 開始處理期號 \${period} 的退水\`);
        
        // 使用事務和鎖來防止重複處理
        await db.tx(async t => {
            // 先檢查是否已經處理過
            const existingRebates = await t.oneOrNone(\`
                SELECT COUNT(*) as count 
                FROM transaction_records 
                WHERE period = $1 
                AND transaction_type = 'rebate'
                LIMIT 1
            \`, [period]);
            
            if (existingRebates && parseInt(existingRebates.count) > 0) {
                settlementLog.info(\`期號 \${period} 的退水已經處理過，跳過\`);
                return;
            }
            
            // 獲取該期所有已結算的注單
            const settledBets = await t.manyOrNone(\`
                SELECT DISTINCT username, SUM(amount) as total_amount
                FROM bet_history
                WHERE period = $1 AND settled = true
                GROUP BY username
                FOR UPDATE SKIP LOCKED
            \`, [period]);
            
            settlementLog.info(\`找到 \${settledBets.length} 位會員需要處理退水\`);
            
            for (const record of settledBets) {
                try {
                    // 調用退水分配邏輯
                    await distributeRebate(record.username, parseFloat(record.total_amount), period, t);
                    settlementLog.info(\`✅ 已為會員 \${record.username} 分配退水，下注金額: \${record.total_amount}\`);
                } catch (rebateError) {
                    settlementLog.error(\`❌ 為會員 \${record.username} 分配退水失敗:\`, rebateError);
                }
            }
        });
        
    } catch (error) {
        settlementLog.error(\`處理退水時發生錯誤:\`, error);
        throw error;
    }
}`;
        
        console.log('修復邏輯已生成');
        
        // 4. 驗證修復結果
        console.log('\n4. 驗證修復結果...');
        const currentRebates = await db.any(`
            SELECT 
                period,
                COUNT(DISTINCT CONCAT(user_id, '-', user_type)) as unique_users,
                COUNT(*) as total_records
            FROM transaction_records
            WHERE transaction_type = 'rebate'
                AND created_at > NOW() - INTERVAL '1 hour'
            GROUP BY period
            HAVING COUNT(*) > COUNT(DISTINCT CONCAT(user_id, '-', user_type))
        `);
        
        if (currentRebates.length === 0) {
            console.log('✅ 沒有發現新的重複退水記錄');
        } else {
            console.log('⚠️ 仍有重複退水記錄，需要進一步檢查');
        }
        
        console.log('\n=== 修復完成 ===');
        
    } catch (error) {
        console.error('修復過程中發生錯誤:', error);
    } finally {
        process.exit(0);
    }
}

// 執行修復
fixRebateSystem();