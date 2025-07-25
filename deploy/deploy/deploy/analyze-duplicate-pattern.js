import db from './db/config.js';

async function analyzeDuplicatePattern() {
    try {
        // 查詢最近2小時的退水記錄，包括期號信息
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
        
        console.log('=== 退水記錄分析（按時間分組）===\n');
        
        // 按秒分組
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
        
        // 分析每個時間組
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
            
            console.log(`時間: ${group.time.toLocaleString()}`);
            console.log(`期號: ${group.period}`);
            console.log(`記錄數: ${group.records.length}`);
            console.log(`總金額: ${total.toFixed(2)} 元`);
            
            Object.entries(agentSummary).forEach(([agent, data]) => {
                console.log(`  ${agent}: ${data.count} 筆, 共 ${data.total.toFixed(2)} 元`);
                if (data.count > 1) {
                    console.log(`    ⚠️ 該代理在同一秒內收到 ${data.count} 筆退水！`);
                }
            });
            
            if (Math.abs(total - 11) < 0.01) {
                console.log(`✅ 金額正確 (A盤 1.1%)`);
            } else if (Math.abs(total - 22) < 0.01) {
                console.log(`❌ 退水重複！應該是 11 元，實際是 22 元`);
            } else if (total > 11) {
                console.log(`❌ 金額異常！應該是 11 元，實際是 ${total.toFixed(2)} 元`);
            }
            
            console.log('---\n');
        });
        
        // 統計問題
        console.log('=== 問題統計 ===');
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
        
        console.log(`正確的退水: ${correctCount} 次`);
        console.log(`異常的退水: ${duplicateCount} 次`);
        
        if (duplicateCount > 0) {
            console.log('\n可能的原因:');
            console.log('1. 結算系統被並發調用（多個定時器或多次手動觸發）');
            console.log('2. 退水檢查邏輯失效，導致重複處理');
            console.log('3. 代理系統API重複處理了請求');
        }
        
    } catch (error) {
        console.error('分析時發生錯誤:', error);
    } finally {
        process.exit(0);
    }
}

analyzeDuplicatePattern();