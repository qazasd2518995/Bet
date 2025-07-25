import db from './db/config.js';

async function diagnoseRebateTrigger() {
    try {
        console.log('=== 診斷退水觸發問題 ===\n');
        
        // 1. 檢查 period 欄位的值
        console.log('1. 檢查 transaction_records 的 period 欄位:');
        const samplePeriods = await db.any(`
            SELECT DISTINCT period, COUNT(*) as count
            FROM transaction_records
            WHERE transaction_type = 'rebate'
            AND created_at > NOW() - INTERVAL '2 hours'
            GROUP BY period
            LIMIT 10
        `);
        
        samplePeriods.forEach(p => {
            console.log(`  "${p.period}" - ${p.count} 筆`);
        });
        
        // 2. 檢查退水檢查邏輯
        console.log('\n2. 模擬退水檢查邏輯:');
        const testPeriod = '20250715059';
        
        // 模擬 enhanced-settlement-system.js 的檢查
        const hasRebates = await db.oneOrNone(`
            SELECT COUNT(*) as count FROM transaction_records
            WHERE transaction_type = 'rebate' 
            AND period = $1
        `, [testPeriod]);
        
        console.log(`  期號 ${testPeriod} 的退水記錄數 (period = '${testPeriod}'): ${hasRebates.count}`);
        
        // 使用 LIKE 檢查
        const hasRebatesLike = await db.oneOrNone(`
            SELECT COUNT(*) as count FROM transaction_records
            WHERE transaction_type = 'rebate' 
            AND period LIKE $1
        `, [`%${testPeriod}%`]);
        
        console.log(`  期號 ${testPeriod} 的退水記錄數 (period LIKE '%${testPeriod}%'): ${hasRebatesLike.count}`);
        
        // 3. 檢查最近的結算和退水狀況
        console.log('\n3. 最近的結算和退水對比:');
        const recentStatus = await db.any(`
            SELECT 
                bh.period,
                COUNT(DISTINCT bh.id) as bet_count,
                SUM(bh.amount) as bet_total,
                COUNT(DISTINCT tr.id) as rebate_count
            FROM bet_history bh
            LEFT JOIN transaction_records tr ON 
                tr.member_username = bh.username 
                AND tr.transaction_type = 'rebate'
                AND (tr.period = bh.period::text OR tr.period LIKE '%' || bh.period || '%')
            WHERE bh.username = 'justin111'
            AND bh.settled = true
            AND bh.created_at > NOW() - INTERVAL '1 hour'
            GROUP BY bh.period
            ORDER BY bh.period DESC
            LIMIT 10
        `);
        
        recentStatus.forEach(s => {
            const status = s.rebate_count > 0 ? '✅' : '❌';
            console.log(`  ${status} 期號 ${s.period}: ${s.bet_count} 筆下注 (${s.bet_total}元), ${s.rebate_count} 筆退水`);
        });
        
        // 4. 檢查退水觸發的時機
        console.log('\n4. 分析問題原因:');
        console.log('  可能的原因:');
        console.log('  a) period 欄位存儲的是 "期號 20250715059 退水分配" 而不是 "20250715059"');
        console.log('  b) 退水檢查使用 period = $1 無法匹配到記錄');
        console.log('  c) 導致系統認為沒有處理過退水，可能會重複處理');
        console.log('  d) 或者退水處理在 API 調用時失敗但沒有錯誤處理');
        
    } catch (error) {
        console.error('診斷錯誤:', error);
    } finally {
        process.exit(0);
    }
}

diagnoseRebateTrigger();