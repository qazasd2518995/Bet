import db from './db/config.js';

async function analyzeDuplicatePattern() {
    try {
        // 查询最近2小时的退水记录，包括期号信息
        const recentRebates = await db.any(`
            SELECT 
                tr.*,
                a.username as agent_name,
                a.level as agent_level
            FROM transaction_records tr
            JOIN agents a ON tr.user_id = a.id
            WHERE tr.transaction_type = 'rebate'
            AND tr.member_username = 'justin111'
            AND tr.created_at > NOW() - INTERVAL '2 hours'
            ORDER BY tr.created_at DESC
        `);
        
        console.log('=== 退水记录分析（按时间分组）===\n');
        
        // 按秒分组
        const timeGroups = {};
        recentRebates.forEach(r => {
            const timeKey = new Date(r.created_at).toISOString().substring(0, 19);
            if (!timeGroups[timeKey]) {
                timeGroups[timeKey] = {
                    time: new Date(r.created_at),
                    records: [],
                    period: r.period || 'N/A'
                };
            }
            timeGroups[timeKey].records.push({
                agent: r.agent_name,
                amount: parseFloat(r.amount),
                id: r.id
            });
        });
        
        // 分析每个时间组
        Object.values(timeGroups).forEach(group => {
            const total = group.records.reduce((sum, r) => sum + r.amount, 0);
            const agentSummary = {};
            
            group.records.forEach(r => {
                if (!agentSummary[r.agent]) {
                    agentSummary[r.agent] = { count: 0, total: 0 };
                }
                agentSummary[r.agent].count++;
                agentSummary[r.agent].total += r.amount;
            });
            
            console.log(`时间: ${group.time.toLocaleString()}`);
            console.log(`期号: ${group.period}`);
            console.log(`记录数: ${group.records.length}`);
            console.log(`总金额: ${total.toFixed(2)} 元`);
            
            Object.entries(agentSummary).forEach(([agent, data]) => {
                console.log(`  ${agent}: ${data.count} 笔, 共 ${data.total.toFixed(2)} 元`);
                if (data.count > 1) {
                    console.log(`    ⚠️ 该代理在同一秒内收到 ${data.count} 笔退水！`);
                }
            });
            
            if (Math.abs(total - 11) < 0.01) {
                console.log(`✅ 金额正确 (A盘 1.1%)`);
            } else if (Math.abs(total - 22) < 0.01) {
                console.log(`❌ 退水重复！应该是 11 元，实际是 22 元`);
            } else if (total > 11) {
                console.log(`❌ 金额异常！应该是 11 元，实际是 ${total.toFixed(2)} 元`);
            }
            
            console.log('---\n');
        });
        
        // 统计问题
        console.log('=== 问题统计 ===');
        let duplicateCount = 0;
        let correctCount = 0;
        
        Object.values(timeGroups).forEach(group => {
            const total = group.records.reduce((sum, r) => sum + r.amount, 0);
            if (Math.abs(total - 11) < 0.01) {
                correctCount++;
            } else if (total > 11) {
                duplicateCount++;
            }
        });
        
        console.log(`正确的退水: ${correctCount} 次`);
        console.log(`异常的退水: ${duplicateCount} 次`);
        
        if (duplicateCount > 0) {
            console.log('\n可能的原因:');
            console.log('1. 结算系统被并发调用（多个定时器或多次手动触发）');
            console.log('2. 退水检查逻辑失效，导致重复处理');
            console.log('3. 代理系统API重复处理了请求');
        }
        
    } catch (error) {
        console.error('分析时发生错误:', error);
    } finally {
        process.exit(0);
    }
}

analyzeDuplicatePattern();