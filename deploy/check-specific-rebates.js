import db from './db/config.js';

async function checkSpecificRebates() {
    try {
        // 查詢特定期號的退水
        const periods = ['20250715019', '20250715004'];
        
        for (const period of periods) {
            console.log(`\n=== 期號 ${period} 的退水記錄 ===`);
            
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
                console.log(`${r.agent_name} (L${r.agent_level}, ${r.market_type}盤): ${amount} 元`);
                console.log(`  - 記錄的退水比例: ${(parseFloat(r.rebate_percentage || 0) * 100).toFixed(1)}%`);
                console.log(`  - 代理設定的退水比例: ${(parseFloat(r.agent_rebate_percentage || 0) * 100).toFixed(1)}%`);
                console.log(`  - 時間: ${new Date(r.created_at).toLocaleString()}`);
            });
            
            console.log(`總退水: ${total.toFixed(2)} 元 (${(total/1000*100).toFixed(1)}%)`);
            
            if (total > 11) {
                console.log(`❌ 退水異常！應該是 11 元 (1.1%)，實際是 ${total} 元`);
            } else if (total === 11) {
                console.log(`✅ 退水正確`);
            }
        }
        
        // 檢查代理的退水設定
        console.log(`\n=== 代理退水設定 ===`);
        const agents = await db.any(`
            SELECT username, level, market_type, rebate_percentage
            FROM agents
            WHERE username IN ('justin2025A', 'ti2025A')
            ORDER BY level DESC
        `);
        
        agents.forEach(a => {
            console.log(`${a.username} (L${a.level}, ${a.market_type}盤): 退水比例 ${(parseFloat(a.rebate_percentage) * 100).toFixed(1)}%`);
        });
        
        // 檢查會員所屬代理
        console.log(`\n=== 會員代理關係 ===`);
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
            console.log(`會員 ${memberInfo.member} 的直屬代理: ${memberInfo.agent_name} (L${memberInfo.level}, ${memberInfo.market_type}盤)`);
        }
        
    } catch (error) {
        console.error('查詢時發生錯誤:', error);
    } finally {
        process.exit(0);
    }
}

checkSpecificRebates();