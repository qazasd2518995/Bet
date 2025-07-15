import db from './db/config.js';

async function checkRebateDetails() {
    try {
        // 查詢 justin111 最近的 1000 元下注
        const recentBets = await db.any(`
            SELECT * FROM bet_history
            WHERE username = 'justin111'
            AND amount = 1000
            ORDER BY created_at DESC
            LIMIT 5
        `);
        
        console.log('=== justin111 最近的 1000 元下注 ===');
        recentBets.forEach((bet, i) => {
            console.log(`${i+1}. 期號: ${bet.period}, 時間: ${new Date(bet.created_at).toLocaleString()}, 已結算: ${bet.settled ? '是' : '否'}`);
        });
        
        // 查詢最新的退水記錄
        const recentRebates = await db.any(`
            SELECT 
                tr.*,
                a.username as agent_name,
                a.level as agent_level,
                a.market_type
            FROM transaction_records tr
            JOIN agents a ON tr.user_id = a.id AND tr.user_type = 'agent'
            WHERE tr.transaction_type = 'rebate'
            AND tr.member_username = 'justin111'
            AND tr.created_at > NOW() - INTERVAL '2 hours'
            ORDER BY tr.created_at DESC
        `);
        
        console.log('\n=== 最近2小時的退水記錄 ===');
        recentRebates.forEach(r => {
            console.log(`代理: ${r.agent_name} (L${r.agent_level}, ${r.market_type}盤)`);
            console.log(`  金額: ${r.amount} 元`);
            console.log(`  下注金額: ${r.bet_amount || 'N/A'}`);
            console.log(`  退水比例: ${r.rebate_percentage ? (parseFloat(r.rebate_percentage) * 100).toFixed(1) + '%' : 'N/A'}`);
            console.log(`  描述: ${r.description}`);
            console.log(`  時間: ${new Date(r.created_at).toLocaleString()}`);
            console.log('---');
        });
        
        // 找出總退水超過 11 元的情況
        const problemPeriods = {};
        recentRebates.forEach(r => {
            const periodMatch = r.description.match(/期號 (\d+)/);
            const period = periodMatch ? periodMatch[1] : null;
            
            if (period && r.bet_amount === '1000.00') {
                if (!problemPeriods[period]) {
                    problemPeriods[period] = { 
                        total: 0, 
                        records: [],
                        betAmount: parseFloat(r.bet_amount)
                    };
                }
                problemPeriods[period].total += parseFloat(r.amount);
                problemPeriods[period].records.push({
                    agent: r.agent_name,
                    amount: parseFloat(r.amount),
                    percentage: r.rebate_percentage ? parseFloat(r.rebate_percentage) * 100 : null
                });
            }
        });
        
        console.log('\n=== 問題期號分析 ===');
        Object.entries(problemPeriods).forEach(([period, data]) => {
            const expectedTotal = data.betAmount * 0.011; // A盤應該是 1.1%
            console.log(`\n期號 ${period}:`);
            console.log(`  下注金額: ${data.betAmount} 元`);
            console.log(`  預期總退水: ${expectedTotal.toFixed(2)} 元 (1.1%)`);
            console.log(`  實際總退水: ${data.total.toFixed(2)} 元 (${(data.total / data.betAmount * 100).toFixed(1)}%)`);
            
            if (data.total > expectedTotal * 1.1) { // 如果超過預期10%以上
                console.log(`  ❌ 退水異常！超出預期 ${(data.total - expectedTotal).toFixed(2)} 元`);
            }
            
            console.log(`  退水分配:`);
            data.records.forEach(r => {
                console.log(`    - ${r.agent}: ${r.amount.toFixed(2)} 元 (${r.percentage ? r.percentage.toFixed(1) + '%' : 'N/A'})`);
            });
        });
        
    } catch (error) {
        console.error('查詢時發生錯誤:', error);
    } finally {
        process.exit(0);
    }
}

checkRebateDetails();