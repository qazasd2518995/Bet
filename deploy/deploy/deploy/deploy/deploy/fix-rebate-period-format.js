import db from './db/config.js';

async function fixRebatePeriodFormat() {
    try {
        console.log('=== 修復退水記錄的 period 格式 ===\n');
        
        // 開始事務
        await db.tx(async t => {
            // 1. 查找所有格式錯誤的退水記錄
            const wrongFormatRecords = await t.any(`
                SELECT 
                    id,
                    period,
                    CASE 
                        WHEN period LIKE '期號 % 退水分配' 
                        THEN SUBSTRING(period FROM '期號 ([0-9]+) 退水分配')
                        ELSE NULL
                    END as extracted_period
                FROM transaction_records
                WHERE transaction_type = 'rebate'
                AND period LIKE '期號 % 退水分配'
            `);
            
            console.log(`找到 ${wrongFormatRecords.length} 筆需要修正的記錄`);
            
            // 2. 更新每筆記錄
            for (const record of wrongFormatRecords) {
                if (record.extracted_period) {
                    await t.none(`
                        UPDATE transaction_records
                        SET period = $2
                        WHERE id = $1
                    `, [record.id, record.extracted_period]);
                    
                    console.log(`✅ 更新 ID ${record.id}: "${record.period}" → "${record.extracted_period}"`);
                }
            }
            
            // 3. 驗證更新結果
            const verifyResult = await t.any(`
                SELECT 
                    period,
                    COUNT(*) as count
                FROM transaction_records
                WHERE transaction_type = 'rebate'
                AND created_at::date = CURRENT_DATE
                GROUP BY period
                ORDER BY period DESC
            `);
            
            console.log('\n=== 更新後的 period 格式 ===');
            verifyResult.forEach(r => {
                console.log(`"${r.period}" - ${r.count} 筆`);
            });
            
            console.log(`\n✅ 成功修正 ${wrongFormatRecords.length} 筆記錄的 period 格式`);
        });
        
        // 4. 重新檢查 justin111 的退水狀況
        console.log('\n=== 驗證 justin111 的退水狀況 ===');
        const justin111Status = await db.any(`
            SELECT 
                bh.period,
                bh.amount as bet_amount,
                EXISTS (
                    SELECT 1 FROM transaction_records tr
                    WHERE tr.period = bh.period::text
                    AND tr.transaction_type = 'rebate'
                ) as has_rebate,
                (
                    SELECT SUM(amount) FROM transaction_records tr
                    WHERE tr.period = bh.period::text
                    AND tr.transaction_type = 'rebate'
                ) as rebate_total
            FROM bet_history bh
            WHERE bh.username = 'justin111'
            AND bh.settled = true
            AND bh.created_at::date = CURRENT_DATE
            ORDER BY bh.period DESC
            LIMIT 10
        `);
        
        justin111Status.forEach(s => {
            const status = s.has_rebate ? '✅' : '❌';
            console.log(`${status} 期號 ${s.period}: 下注 ${s.bet_amount}元, 退水總額 ${s.rebate_total || 0}元`);
        });
        
    } catch (error) {
        console.error('修復時發生錯誤:', error);
    } finally {
        process.exit(0);
    }
}

fixRebatePeriodFormat();