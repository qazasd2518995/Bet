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

async function testCascadingRebate() {
    console.log('=== 直接测试级联退水更新 ===\n');
    
    try {
        // 1. 查找有下级的代理
        console.log('1. 查找有下级代理的测试代理...');
        const agentsWithSubordinates = await pool.query(`
            SELECT DISTINCT p.id, p.username, p.level, p.rebate_percentage, p.max_rebate_percentage
            FROM agents p
            INNER JOIN agents c ON c.parent_id = p.id
            WHERE p.status = 1 AND c.status = 1
            AND p.level <= 2
            ORDER BY p.level, p.id
            LIMIT 5
        `);
        
        if (agentsWithSubordinates.rows.length === 0) {
            console.log('没有找到有下级的代理');
            return;
        }
        
        const testAgent = agentsWithSubordinates.rows[0];
        console.log(`找到测试代理: ${testAgent.username} (ID: ${testAgent.id}, Level: ${testAgent.level})`);
        console.log(`当前退水: ${(testAgent.rebate_percentage * 100).toFixed(1)}%`);
        
        // 2. 查看其下级代理
        console.log('\n2. 查看下级代理状态:');
        const subordinates = await pool.query(`
            SELECT id, username, level, rebate_percentage, max_rebate_percentage
            FROM agents
            WHERE parent_id = $1 AND status = 1
            ORDER BY level, id
        `, [testAgent.id]);
        
        console.log('下级代理:');
        subordinates.rows.forEach(sub => {
            console.log(`  ${sub.level}级 ${sub.username}: 退水 ${(sub.rebate_percentage * 100).toFixed(1)}%, max ${(sub.max_rebate_percentage * 100).toFixed(1)}%`);
        });
        
        // 3. 测试降低退水
        console.log('\n3. 降低测试代理退水到 0.1%...');
        await pool.query(`
            UPDATE agents 
            SET rebate_percentage = 0.001, max_rebate_percentage = 0.001 
            WHERE id = $1
        `, [testAgent.id]);
        
        // 触发级联更新
        console.log('触发级联更新...');
        await adjustDownlineRebateSettings(testAgent.id, 0.001);
        
        // 查看更新后状态
        const updatedSubs = await pool.query(`
            SELECT id, username, level, rebate_percentage, max_rebate_percentage
            FROM agents
            WHERE parent_id = $1 AND status = 1
            ORDER BY level, id
        `, [testAgent.id]);
        
        console.log('\n降低后的下级代理状态:');
        updatedSubs.rows.forEach(sub => {
            console.log(`  ${sub.level}级 ${sub.username}: 退水 ${(sub.rebate_percentage * 100).toFixed(1)}%, max ${(sub.max_rebate_percentage * 100).toFixed(1)}%`);
        });
        
        // 4. 测试提高退水
        console.log('\n4. 提高测试代理退水到 0.9%...');
        await pool.query(`
            UPDATE agents 
            SET rebate_percentage = 0.009, max_rebate_percentage = 0.009 
            WHERE id = $1
        `, [testAgent.id]);
        
        // 触发级联更新
        console.log('触发级联更新...');
        await adjustDownlineRebateSettings(testAgent.id, 0.009);
        
        // 查看更新后状态
        const increasedSubs = await pool.query(`
            SELECT id, username, level, rebate_percentage, max_rebate_percentage
            FROM agents
            WHERE parent_id = $1 AND status = 1
            ORDER BY level, id
        `, [testAgent.id]);
        
        console.log('\n提高后的下级代理状态:');
        increasedSubs.rows.forEach(sub => {
            console.log(`  ${sub.level}级 ${sub.username}: 退水 ${(sub.rebate_percentage * 100).toFixed(1)}%, max ${(sub.max_rebate_percentage * 100).toFixed(1)}%`);
            if (sub.max_rebate_percentage === 0.009) {
                console.log(`  ✓ ${sub.username} 的最大退水已正确更新`);
            } else {
                console.log(`  ✗ ${sub.username} 的最大退水未更新`);
            }
        });
        
    } catch (error) {
        console.error('测试失败:', error);
    } finally {
        await pool.end();
    }
}

// 级联更新函数
async function adjustDownlineRebateSettings(parentAgentId, maxRebatePercentage) {
    const childAgents = await pool.query(`
        SELECT id, username, rebate_percentage, max_rebate_percentage 
        FROM agents 
        WHERE parent_id = $1 AND status = 1
    `, [parentAgentId]);
    
    for (const childAgent of childAgents.rows) {
        const currentRebate = parseFloat(childAgent.rebate_percentage);
        const currentMaxRebate = parseFloat(childAgent.max_rebate_percentage);
        
        let needUpdate = false;
        let newRebate = currentRebate;
        let updateDescription = '';
        
        // 情况1：退水超过新限制，需要调降
        if (currentRebate > maxRebatePercentage) {
            newRebate = maxRebatePercentage;
            needUpdate = true;
            updateDescription = `退水调降: ${(currentRebate * 100).toFixed(1)}% -> ${(newRebate * 100).toFixed(1)}%`;
        }
        
        // 情况2：最大退水需要更新（不论上调或下调）
        if (currentMaxRebate !== maxRebatePercentage) {
            needUpdate = true;
            if (updateDescription) {
                updateDescription += `，最大退水更新: ${(currentMaxRebate * 100).toFixed(1)}% -> ${(maxRebatePercentage * 100).toFixed(1)}%`;
            } else {
                updateDescription = `最大退水更新: ${(currentMaxRebate * 100).toFixed(1)}% -> ${(maxRebatePercentage * 100).toFixed(1)}%`;
            }
        }
        
        if (needUpdate) {
            await pool.query(`
                UPDATE agents 
                SET rebate_percentage = $1, max_rebate_percentage = $2, updated_at = CURRENT_TIMESTAMP 
                WHERE id = $3
            `, [newRebate, maxRebatePercentage, childAgent.id]);
            
            console.log(`  - 调整下级代理 ${childAgent.username}: ${updateDescription}`);
        }
        
        // 递回处理
        await adjustDownlineRebateSettings(childAgent.id, maxRebatePercentage);
    }
}

// 执行测试
testCascadingRebate().then(() => {
    console.log('\n测试完成');
}).catch(error => {
    console.error('执行错误:', error);
    process.exit(1);
});