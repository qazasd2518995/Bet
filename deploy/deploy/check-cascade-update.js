import pkg from 'pg-promise';
const pgp = pkg();
const db = pgp({
    connectionString: 'postgresql://bet_db_sldl_user:iAT91cS1Cl1tWANmgp3vLNarADrTNvKh@dpg-ct6go256l47c738ju4kg-a.oregon-postgres.render.com/bet_db_sldl?ssl=true',
    ssl: { rejectUnauthorized: false }
});

async function checkCascadeUpdate() {
    console.log('=== 檢查級聯更新結果 ===\n');
    
    try {
        // 查找退水為 0.0012 (0.12%) 的代理及其下級
        const agents = await db.any(`
            WITH RECURSIVE agent_tree AS (
                -- 找到退水為 0.12% 的代理
                SELECT 
                    id, username, level, parent_id, 
                    rebate_percentage, max_rebate_percentage,
                    0 as depth
                FROM agents
                WHERE rebate_percentage = 0.0012 AND status = 1
                
                UNION ALL
                
                -- 找到其所有下級
                SELECT 
                    a.id, a.username, a.level, a.parent_id,
                    a.rebate_percentage, a.max_rebate_percentage,
                    at.depth + 1
                FROM agents a
                INNER JOIN agent_tree at ON a.parent_id = at.id
                WHERE a.status = 1
            )
            SELECT * FROM agent_tree
            ORDER BY depth, id
        `);
        
        if (agents.length === 0) {
            console.log('未找到退水為 0.12% 的代理');
            return;
        }
        
        console.log(`找到 ${agents.length} 個相關代理：\n`);
        
        let parentAgent = null;
        agents.forEach(agent => {
            const prefix = '  '.repeat(agent.depth);
            const rebatePercent = agent.rebate_percentage * 100;
            const maxRebatePercent = agent.max_rebate_percentage * 100;
            
            console.log(`${prefix}${agent.username} (Level ${agent.level}):`);
            console.log(`${prefix}  退水: ${rebatePercent}% (${agent.rebate_percentage})`);
            console.log(`${prefix}  最大退水: ${maxRebatePercent}% (${agent.max_rebate_percentage})`);
            
            if (agent.depth === 0) {
                parentAgent = agent;
            } else {
                // 檢查下級的 max_rebate_percentage 是否等於上級的 rebate_percentage
                if (parentAgent && agent.max_rebate_percentage !== parentAgent.rebate_percentage) {
                    console.log(`${prefix}  ❌ 錯誤：最大退水應該是 ${parentAgent.rebate_percentage * 100}%`);
                } else {
                    console.log(`${prefix}  ✅ 正確`);
                }
            }
            console.log('');
        });
        
    } catch (error) {
        console.error('檢查過程中發生錯誤:', error);
    } finally {
        await db.$pool.end();
    }
}

checkCascadeUpdate();