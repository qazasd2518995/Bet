import db from './db/config.js';

async function fixRebatePeriodFormat() {
    try {
        console.log('=== 修复退水记录的 period 格式 ===\n');
        
        // 开始事务
        await db.tx(async t => {
            // 1. 查找所有格式错误的退水记录
            const wrongFormatRecords = await t.any(`
                SELECT 
                    id,
                    period,
                    CASE 
                        WHEN period LIKE '期号 % 退水分配' 
                        THEN SUBSTRING(period FROM '期号 ([0-9]+) 退水分配')
                        ELSE NULL
                    END as extracted_period
                FROM transaction_records
                WHERE transaction_type = 'rebate'
                AND period LIKE '期号 % 退水分配'
            `);
            
            console.log(`找到 ${wrongFormatRecords.length} 笔需要修正的记录`);
            
            // 2. 更新每笔记录
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
            
            // 3. 验证更新结果
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
            
            console.log('\n=== 更新后的 period 格式 ===');
            verifyResult.forEach(r => {
                console.log(`"${r.period}" - ${r.count} 笔`);
            });
            
            console.log(`\n✅ 成功修正 ${wrongFormatRecords.length} 笔记录的 period 格式`);
        });
        
        // 4. 重新检查 justin111 的退水状况
        console.log('\n=== 验证 justin111 的退水状况 ===');
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
            console.log(`${status} 期号 ${s.period}: 下注 ${s.bet_amount}元, 退水总额 ${s.rebate_total || 0}元`);
        });
        
    } catch (error) {
        console.error('修复时发生错误:', error);
    } finally {
        process.exit(0);
    }
}

fixRebatePeriodFormat();