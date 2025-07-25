import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    host: 'dpg-d0e2imc9c44c73che3kg-a.oregon-postgres.render.com',
    port: 5432,
    database: 'bet_game',
    user: 'bet_game_user',
    password: 'Vm4J5g1gymwPfBNcgYfGCe4GEZqCjoIy',
    ssl: { rejectUnauthorized: false }
});

async function fixAllMaxRebate() {
    console.log('=== 修复所有代理的最大退水设定 ===\n');
    
    try {
        // 1. 获取所有代理，按层级排序
        const allAgents = await pool.query(`
            WITH RECURSIVE agent_tree AS (
                -- 总代理
                SELECT id, username, level, parent_id, rebate_percentage, max_rebate_percentage, 
                       market_type, 0 as depth
                FROM agents 
                WHERE level = 0 AND status = 1
                
                UNION ALL
                
                -- 下级代理
                SELECT a.id, a.username, a.level, a.parent_id, a.rebate_percentage, 
                       a.max_rebate_percentage, a.market_type, at.depth + 1
                FROM agents a
                INNER JOIN agent_tree at ON a.parent_id = at.id
                WHERE a.status = 1
            )
            SELECT * FROM agent_tree
            ORDER BY depth, level, id
        `);
        
        console.log(`找到 ${allAgents.rows.length} 个代理需要检查\n`);
        
        let fixedCount = 0;
        const marketDefaults = { 'A': 0.011, 'D': 0.041 }; // A盘1.1%, D盘4.1%
        
        for (const agent of allAgents.rows) {
            // 总代理的最大退水应该是盘口预设值
            if (agent.level === 0) {
                const expectedMax = marketDefaults[agent.market_type] || 0.041;
                if (Math.abs(agent.max_rebate_percentage - expectedMax) > 0.0001) {
                    console.log(`修复总代理 ${agent.username}: ${(agent.max_rebate_percentage * 100).toFixed(1)}% → ${(expectedMax * 100).toFixed(1)}%`);
                    await pool.query(`
                        UPDATE agents 
                        SET max_rebate_percentage = $1, updated_at = CURRENT_TIMESTAMP
                        WHERE id = $2
                    `, [expectedMax, agent.id]);
                    fixedCount++;
                }
            } else {
                // 一般代理的最大退水应该等于其上级的退水
                if (agent.parent_id) {
                    const parentResult = await pool.query(`
                        SELECT rebate_percentage 
                        FROM agents 
                        WHERE id = $1
                    `, [agent.parent_id]);
                    
                    if (parentResult.rows.length > 0) {
                        const parentRebate = parentResult.rows[0].rebate_percentage;
                        if (Math.abs(agent.max_rebate_percentage - parentRebate) > 0.0001) {
                            console.log(`修复 ${agent.level}级代理 ${agent.username}: ${(agent.max_rebate_percentage * 100).toFixed(1)}% → ${(parentRebate * 100).toFixed(1)}%`);
                            await pool.query(`
                                UPDATE agents 
                                SET max_rebate_percentage = $1, updated_at = CURRENT_TIMESTAMP
                                WHERE id = $2
                            `, [parentRebate, agent.id]);
                            fixedCount++;
                        }
                        
                        // 如果代理的退水超过新的最大值，也要调整
                        if (agent.rebate_percentage > parentRebate) {
                            console.log(`  同时调降退水: ${(agent.rebate_percentage * 100).toFixed(1)}% → ${(parentRebate * 100).toFixed(1)}%`);
                            await pool.query(`
                                UPDATE agents 
                                SET rebate_percentage = $1, updated_at = CURRENT_TIMESTAMP
                                WHERE id = $2
                            `, [parentRebate, agent.id]);
                        }
                    }
                }
            }
        }
        
        console.log(`\n修复完成！共修复 ${fixedCount} 个代理的最大退水设定`);
        
        // 2. 验证 A02agent 的状态
        console.log('\n验证 A02agent 的最终状态:');
        const a02Result = await pool.query(`
            SELECT a.*, p.username as parent_username, p.rebate_percentage as parent_rebate
            FROM agents a
            LEFT JOIN agents p ON a.parent_id = p.id
            WHERE a.username = 'A02agent'
        `);
        
        if (a02Result.rows.length > 0) {
            const a02 = a02Result.rows[0];
            console.log(`  上级: ${a02.parent_username}`);
            console.log(`  上级退水: ${(a02.parent_rebate * 100).toFixed(1)}%`);
            console.log(`  A02agent 退水: ${(a02.rebate_percentage * 100).toFixed(1)}%`);
            console.log(`  A02agent 最大退水: ${(a02.max_rebate_percentage * 100).toFixed(1)}%`);
            console.log(`  ✓ 现在可以设定退水范围: 0% - ${(a02.max_rebate_percentage * 100).toFixed(1)}%`);
        }
        
    } catch (error) {
        console.error('修复失败:', error);
    } finally {
        await pool.end();
    }
}

fixAllMaxRebate();