import db from './db/config.js';

async function checkDuplicateRebates() {
    try {
        // 查询最新的退水记录
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
        
        console.log('=== 最近1小时的退水记录 ===\n');
        
        // 按期号和时间分组
        const periodGroups = {};
        latestRebates.forEach(r => {
            // 从描述中提取期号
            const periodMatch = r.description.match(/期号 (\d+)/);
            const period = periodMatch ? periodMatch[1] : 'unknown';
            const timeKey = new Date(r.created_at).toISOString().substring(0, 19); // 精确到秒
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
        
        // 分析每个期号的退水
        Object.values(periodGroups).forEach(group => {
            console.log(`期号: ${group.period}`);
            console.log(`时间: ${group.time}`);
            
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
            
            console.log(`  总计: ${total} 元`);
            
            // 检查是否正确
            if (Math.abs(total - 11) < 0.01) {
                console.log(`  ✅ 退水正确 (A盘 1.1%)`);
            } else if (Math.abs(total - 22) < 0.01) {
                console.log(`  ❌ 退水重复！应该是 11 元，实际是 22 元`);
                Object.entries(agentTotals).forEach(([agent, amount]) => {
                    if (agent === 'justin2025A') {
                        console.log(`     ${agent}: ${amount} 元 (应该是 5 元)`);
                    } else if (agent === 'ti2025A') {
                        console.log(`     ${agent}: ${amount} 元 (应该是 6 元)`);
                    }
                });
            } else {
                console.log(`  ❓ 异常金额`);
            }
            
            console.log('---');
        });
        
        // 检查是否有同一秒内的多笔记录
        console.log('\n=== 检查同时间重复记录 ===');
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
            console.log('发现同一秒内有多笔退水记录:');
            duplicateCheck.forEach(d => {
                console.log(`\n时间: ${new Date(d.second_time).toLocaleString()}`);
                console.log(`记录数: ${d.record_count}`);
                console.log(`总金额: ${d.total_amount}`);
                console.log(`详情: ${d.details}`);
            });
        } else {
            console.log('没有发现同一秒内的重复记录');
        }
        
    } catch (error) {
        console.error('检查时发生错误:', error);
    } finally {
        process.exit(0);
    }
}

checkDuplicateRebates();