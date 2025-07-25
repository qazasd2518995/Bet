import db from './db/config.js';

async function checkTodayRebates() {
    try {
        console.log('=== 检查今日所有退水状况 ===\n');
        
        // 找出今天所有已结算的下注和对应的退水状况
        const todayBets = await db.any(`
            SELECT 
                bh.period,
                bh.username,
                COUNT(DISTINCT bh.id) as bet_count,
                SUM(bh.amount) as total_amount,
                COALESCE(tr.rebate_count, 0) as rebate_count,
                COALESCE(tr.rebate_total, 0) as rebate_total,
                MIN(bh.created_at) as first_bet_time,
                MAX(bh.created_at) as last_bet_time
            FROM bet_history bh
            LEFT JOIN (
                SELECT 
                    period,
                    COUNT(*) as rebate_count,
                    SUM(amount) as rebate_total
                FROM transaction_records
                WHERE transaction_type = 'rebate'
                GROUP BY period
            ) tr ON bh.period::text = tr.period
            WHERE bh.settled = true
            AND bh.created_at::date = CURRENT_DATE
            GROUP BY bh.period, bh.username, tr.rebate_count, tr.rebate_total
            ORDER BY bh.period DESC
        `);
        
        console.log(`今日共有 ${todayBets.length} 笔结算记录\n`);
        
        // 分析退水状况
        let totalBets = 0;
        let totalWithRebates = 0;
        let totalMissingRebates = 0;
        
        const missingPeriods = new Set();
        
        todayBets.forEach(bet => {
            totalBets++;
            if (bet.rebate_count > 0) {
                totalWithRebates++;
                console.log(`✅ 期号 ${bet.period} - ${bet.username}: ${bet.bet_count} 笔下注 (${bet.total_amount}元), ${bet.rebate_count} 笔退水 (${bet.rebate_total}元)`);
            } else {
                totalMissingRebates++;
                missingPeriods.add(bet.period);
                console.log(`❌ 期号 ${bet.period} - ${bet.username}: ${bet.bet_count} 笔下注 (${bet.total_amount}元), 无退水记录`);
            }
        });
        
        console.log(`\n=== 统计摘要 ===`);
        console.log(`总结算记录: ${totalBets}`);
        console.log(`有退水: ${totalWithRebates}`);
        console.log(`无退水: ${totalMissingRebates}`);
        console.log(`缺少退水的期号数: ${missingPeriods.size}`);
        
        if (missingPeriods.size > 0) {
            console.log(`\n缺少退水的期号列表:`);
            Array.from(missingPeriods).sort().forEach(period => {
                console.log(`  - ${period}`);
            });
        }
        
        // 检查退水记录的 period 栏位格式
        console.log(`\n=== 检查退水记录格式 ===`);
        const sampleRebates = await db.any(`
            SELECT DISTINCT 
                period,
                COUNT(*) as count
            FROM transaction_records
            WHERE transaction_type = 'rebate'
            AND created_at::date = CURRENT_DATE
            GROUP BY period
            ORDER BY period DESC
            LIMIT 10
        `);
        
        console.log(`今日退水记录的 period 格式范例:`);
        sampleRebates.forEach(r => {
            console.log(`  "${r.period}" - ${r.count} 笔`);
        });
        
        // 检查 justin111 的下注和退水状况
        console.log(`\n=== justin111 今日下注和退水详情 ===`);
        const justin111Details = await db.any(`
            SELECT 
                bh.period,
                bh.amount as bet_amount,
                bh.created_at as bet_time,
                tr1.amount as justin2025A_rebate,
                tr2.amount as ti2025A_rebate
            FROM bet_history bh
            LEFT JOIN transaction_records tr1 ON 
                tr1.period = bh.period::text 
                AND tr1.transaction_type = 'rebate'
                AND tr1.user_id = (SELECT id FROM agents WHERE username = 'justin2025A')
            LEFT JOIN transaction_records tr2 ON 
                tr2.period = bh.period::text 
                AND tr2.transaction_type = 'rebate'
                AND tr2.user_id = (SELECT id FROM agents WHERE username = 'ti2025A')
            WHERE bh.username = 'justin111'
            AND bh.settled = true
            AND bh.created_at::date = CURRENT_DATE
            ORDER BY bh.period DESC
            LIMIT 20
        `);
        
        justin111Details.forEach(d => {
            const status = (d.justin2025a_rebate || d.ti2025a_rebate) ? '✅' : '❌';
            console.log(`${status} 期号 ${d.period}: 下注 ${d.bet_amount}元`);
            if (d.justin2025a_rebate || d.ti2025a_rebate) {
                console.log(`   退水: justin2025A=${d.justin2025a_rebate || 0}元, ti2025A=${d.ti2025a_rebate || 0}元`);
            }
        });
        
    } catch (error) {
        console.error('检查时发生错误:', error);
    } finally {
        process.exit(0);
    }
}

checkTodayRebates();