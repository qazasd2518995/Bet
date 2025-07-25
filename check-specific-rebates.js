import db from './db/config.js';

async function checkSpecificRebates() {
    try {
        // 查询特定期号的退水
        const periods = ['20250715019', '20250715004'];
        
        for (const period of periods) {
            console.log(`\n=== 期号 ${period} 的退水记录 ===`);
            
            const rebates = await db.any(`
                SELECT 
                    tr.*,
                    a.username as agent_name,
                    a.level as agent_level,
                    a.market_type,
                    a.rebate_percentage as agent_rebate_percentage
                FROM transaction_records tr
                JOIN agents a ON tr.user_id = a.id AND tr.user_type = 'agent'
                WHERE tr.transaction_type = 'rebate'
                AND tr.member_username = 'justin111'
                AND tr.period = $1
                ORDER BY tr.created_at DESC
            `, [period]);
            
            let total = 0;
            rebates.forEach(r => {
                const amount = parseFloat(r.amount);
                total += amount;
                console.log(`${r.agent_name} (L${r.agent_level}, ${r.market_type}盘): ${amount} 元`);
                console.log(`  - 记录的退水比例: ${(parseFloat(r.rebate_percentage || 0) * 100).toFixed(1)}%`);
                console.log(`  - 代理设定的退水比例: ${(parseFloat(r.agent_rebate_percentage || 0) * 100).toFixed(1)}%`);
                console.log(`  - 时间: ${new Date(r.created_at).toLocaleString()}`);
            });
            
            console.log(`总退水: ${total.toFixed(2)} 元 (${(total/1000*100).toFixed(1)}%)`);
            
            if (total > 11) {
                console.log(`❌ 退水异常！应该是 11 元 (1.1%)，实际是 ${total} 元`);
            } else if (total === 11) {
                console.log(`✅ 退水正确`);
            }
        }
        
        // 检查代理的退水设定
        console.log(`\n=== 代理退水设定 ===`);
        const agents = await db.any(`
            SELECT username, level, market_type, rebate_percentage
            FROM agents
            WHERE username IN ('justin2025A', 'ti2025A')
            ORDER BY level DESC
        `);
        
        agents.forEach(a => {
            console.log(`${a.username} (L${a.level}, ${a.market_type}盘): 退水比例 ${(parseFloat(a.rebate_percentage) * 100).toFixed(1)}%`);
        });
        
        // 检查会员所属代理
        console.log(`\n=== 会员代理关系 ===`);
        const memberInfo = await db.oneOrNone(`
            SELECT 
                m.username as member,
                m.agent_id,
                a.username as agent_name,
                a.market_type,
                a.level
            FROM members m
            JOIN agents a ON m.agent_id = a.id
            WHERE m.username = 'justin111'
        `);
        
        if (memberInfo) {
            console.log(`会员 ${memberInfo.member} 的直属代理: ${memberInfo.agent_name} (L${memberInfo.level}, ${memberInfo.market_type}盘)`);
        }
        
    } catch (error) {
        console.error('查询时发生错误:', error);
    } finally {
        process.exit(0);
    }
}

checkSpecificRebates();