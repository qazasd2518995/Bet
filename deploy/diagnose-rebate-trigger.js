import db from './db/config.js';

async function diagnoseRebateTrigger() {
    try {
        console.log('=== 诊断退水触发问题 ===\n');
        
        // 1. 检查 period 栏位的值
        console.log('1. 检查 transaction_records 的 period 栏位:');
        const samplePeriods = await db.any(`
            SELECT DISTINCT period, COUNT(*) as count
            FROM transaction_records
            WHERE transaction_type = 'rebate'
            AND created_at > NOW() - INTERVAL '2 hours'
            GROUP BY period
            LIMIT 10
        `);
        
        samplePeriods.forEach(p => {
            console.log(`  "${p.period}" - ${p.count} 笔`);
        });
        
        // 2. 检查退水检查逻辑
        console.log('\n2. 模拟退水检查逻辑:');
        const testPeriod = '20250715059';
        
        // 模拟 enhanced-settlement-system.js 的检查
        const hasRebates = await db.oneOrNone(`
            SELECT COUNT(*) as count FROM transaction_records
            WHERE transaction_type = 'rebate' 
            AND period = $1
        `, [testPeriod]);
        
        console.log(`  期号 ${testPeriod} 的退水记录数 (period = '${testPeriod}'): ${hasRebates.count}`);
        
        // 使用 LIKE 检查
        const hasRebatesLike = await db.oneOrNone(`
            SELECT COUNT(*) as count FROM transaction_records
            WHERE transaction_type = 'rebate' 
            AND period LIKE $1
        `, [`%${testPeriod}%`]);
        
        console.log(`  期号 ${testPeriod} 的退水记录数 (period LIKE '%${testPeriod}%'): ${hasRebatesLike.count}`);
        
        // 3. 检查最近的结算和退水状况
        console.log('\n3. 最近的结算和退水对比:');
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
            console.log(`  ${status} 期号 ${s.period}: ${s.bet_count} 笔下注 (${s.bet_total}元), ${s.rebate_count} 笔退水`);
        });
        
        // 4. 检查退水触发的时机
        console.log('\n4. 分析问题原因:');
        console.log('  可能的原因:');
        console.log('  a) period 栏位存储的是 "期号 20250715059 退水分配" 而不是 "20250715059"');
        console.log('  b) 退水检查使用 period = $1 无法匹配到记录');
        console.log('  c) 导致系统认为没有处理过退水，可能会重复处理');
        console.log('  d) 或者退水处理在 API 调用时失败但没有错误处理');
        
    } catch (error) {
        console.error('诊断错误:', error);
    } finally {
        process.exit(0);
    }
}

diagnoseRebateTrigger();