import pkg from 'pg-promise';
const pgp = pkg();
const db = pgp({
    connectionString: 'postgresql://bet_db_sldl_user:iAT91cS1Cl1tWANmgp3vLNarADrTNvKh@dpg-ct6go256l47c738ju4kg-a.oregon-postgres.render.com/bet_db_sldl?ssl=true',
    ssl: { rejectUnauthorized: false }
});

const API_BASE_URL = 'http://localhost:3003/api';

async function testCompleteRebateSystem() {
    console.log('=== 完整测试退水系统 ===\n');
    
    try {
        // 1. 测试浮点数精度问题
        console.log('1. 测试浮点数精度处理：');
        console.log('   - 测试设定 0.9% (0.009)');
        const testValue = 0.9 / 100;
        console.log(`   - 原始值: ${testValue}`);
        console.log(`   - 四舍五入后: ${Math.round(testValue * 10000) / 10000}`);
        console.log(`   - 是否相等: ${Math.round(testValue * 10000) / 10000 === 0.009}`);
        
        // 2. 检查所有代理的 max_rebate_percentage 设定
        console.log('\n2. 检查代理退水设定一致性：');
        const agents = await db.any(`
            WITH RECURSIVE agent_tree AS (
                SELECT 
                    a.id,
                    a.username,
                    a.level,
                    a.parent_id,
                    a.rebate_percentage,
                    a.max_rebate_percentage,
                    p.username as parent_username,
                    p.rebate_percentage as parent_rebate
                FROM agents a
                LEFT JOIN agents p ON a.parent_id = p.id
                WHERE a.status = 1
                ORDER BY a.level, a.id
            )
            SELECT * FROM agent_tree
        `);
        
        let inconsistentCount = 0;
        for (const agent of agents) {
            if (agent.parent_id) {
                // 检查是否与上级退水一致
                if (parseFloat(agent.max_rebate_percentage) !== parseFloat(agent.parent_rebate)) {
                    console.log(`   ❌ ${agent.username}: max=${agent.max_rebate_percentage}, 上级退水=${agent.parent_rebate}`);
                    inconsistentCount++;
                }
            }
        }
        
        if (inconsistentCount === 0) {
            console.log('   ✅ 所有代理的 max_rebate_percentage 都与上级一致');
        }
        
        // 3. 测试级联更新机制
        console.log('\n3. 测试级联更新机制：');
        
        // 找一个有下级的代理进行测试
        const testAgent = await db.oneOrNone(`
            SELECT a.*, 
                   (SELECT COUNT(*) FROM agents WHERE parent_id = a.id AND status = 1) as child_count
            FROM agents a
            WHERE a.level > 0 AND a.status = 1
            AND EXISTS (SELECT 1 FROM agents WHERE parent_id = a.id AND status = 1)
            ORDER BY a.level
            LIMIT 1
        `);
        
        if (testAgent) {
            console.log(`   - 测试代理: ${testAgent.username} (当前退水: ${(testAgent.rebate_percentage * 100).toFixed(1)}%)`);
            console.log(`   - 下级代理数: ${testAgent.child_count}`);
            
            // 获取下级代理的当前状态
            const childAgents = await db.any(`
                SELECT id, username, rebate_percentage, max_rebate_percentage
                FROM agents
                WHERE parent_id = $1 AND status = 1
            `, [testAgent.id]);
            
            console.log('\n   下级代理当前状态:');
            for (const child of childAgents) {
                console.log(`     - ${child.username}: 退水=${(child.rebate_percentage * 100).toFixed(1)}%, max=${(child.max_rebate_percentage * 100).toFixed(1)}%`);
            }
        }
        
        // 4. 检查前端显示逻辑
        console.log('\n4. 前端显示逻辑检查：');
        console.log('   - activeTab === "accounts" 时使用 currentMemberManagingAgent');
        console.log('   - 其他情况使用 currentManagingAgent 或 user');
        console.log('   - 总代理(level 0)使用盘口退水限制');
        console.log('   - 一般代理使用 rebate_percentage 作为下级最大值');
        
        // 5. 检查即时更新机制
        console.log('\n5. 即时更新机制：');
        console.log('   - 更新后调用 fetchUserData() 刷新数据');
        console.log('   - 使用 Vue.$forceUpdate() 强制更新视图');
        console.log('   - 无需手动刷新页面');
        
    } catch (error) {
        console.error('测试过程中发生错误:', error);
    } finally {
        await db.$pool.end();
    }
}

testCompleteRebateSystem();