import db from './db/config.js';

async function checkDuplicateRebates() {
    try {
        // 查詢最新的退水記錄
        const latestRebates = await db.any(`
            SELECT 
                tr.*,
                a.username as agent_name,
                a.level as agent_level
            FROM transaction_records tr
            JOIN agents a ON tr.user_id = a.id AND tr.user_type = 'agent'
            WHERE tr.transaction_type = 'rebate'
            AND tr.member_username = 'justin111'
            AND tr.created_at > NOW() - INTERVAL '1 hour'
            ORDER BY tr.created_at DESC
        `);
        
        console.log('=== 最近1小時的退水記錄 ===\n');
        
        // 按期號和時間分組
        const periodGroups = {};
        latestRebates.forEach(r => {
            // 從描述中提取期號
            const periodMatch = r.description.match(/期號 (\d+)/);
            const period = periodMatch ? periodMatch[1] : 'unknown';
            const timeKey = new Date(r.created_at).toISOString().substring(0, 19); // 精確到秒
            const key = `${period}_${timeKey}`;
            
            if (!periodGroups[key]) {
                periodGroups[key] = {
                    period: period,
                    time: new Date(r.created_at).toLocaleString(),
                    records: []
                };
            }
            
            periodGroups[key].records.push({
                agent: r.agent_name,
                amount: parseFloat(r.amount),
                id: r.id
            });
        });
        
        // 分析每個期號的退水
        Object.values(periodGroups).forEach(group => {
            console.log(`期號: ${group.period}`);
            console.log(`時間: ${group.time}`);
            
            const agentTotals = {};
            let total = 0;
            
            group.records.forEach(r => {
                console.log(`  ${r.agent}: ${r.amount} 元 (ID: ${r.id})`);
                total += r.amount;
                
                if (!agentTotals[r.agent]) {
                    agentTotals[r.agent] = 0;
                }
                agentTotals[r.agent] += r.amount;
            });
            
            console.log(`  總計: ${total} 元`);
            
            // 檢查是否正確
            if (Math.abs(total - 11) < 0.01) {
                console.log(`  ✅ 退水正確 (A盤 1.1%)`);
            } else if (Math.abs(total - 22) < 0.01) {
                console.log(`  ❌ 退水重複！應該是 11 元，實際是 22 元`);
                Object.entries(agentTotals).forEach(([agent, amount]) => {
                    if (agent === 'justin2025A') {
                        console.log(`     ${agent}: ${amount} 元 (應該是 5 元)`);
                    } else if (agent === 'ti2025A') {
                        console.log(`     ${agent}: ${amount} 元 (應該是 6 元)`);
                    }
                });
            } else {
                console.log(`  ❓ 異常金額`);
            }
            
            console.log('---');
        });
        
        // 檢查是否有同一秒內的多筆記錄
        console.log('\n=== 檢查同時間重複記錄 ===');
        const duplicateCheck = await db.any(`
            SELECT 
                date_trunc('second', created_at) as second_time,
                member_username,
                COUNT(*) as record_count,
                SUM(amount) as total_amount,
                array_agg(user_id || ':' || amount) as details
            FROM transaction_records
            WHERE transaction_type = 'rebate'
            AND member_username = 'justin111'
            AND created_at > NOW() - INTERVAL '1 hour'
            GROUP BY date_trunc('second', created_at), member_username
            HAVING COUNT(*) > 2
            ORDER BY second_time DESC
        `);
        
        if (duplicateCheck.length > 0) {
            console.log('發現同一秒內有多筆退水記錄:');
            duplicateCheck.forEach(d => {
                console.log(`\n時間: ${new Date(d.second_time).toLocaleString()}`);
                console.log(`記錄數: ${d.record_count}`);
                console.log(`總金額: ${d.total_amount}`);
                console.log(`詳情: ${d.details}`);
            });
        } else {
            console.log('沒有發現同一秒內的重複記錄');
        }
        
    } catch (error) {
        console.error('檢查時發生錯誤:', error);
    } finally {
        process.exit(0);
    }
}

checkDuplicateRebates();