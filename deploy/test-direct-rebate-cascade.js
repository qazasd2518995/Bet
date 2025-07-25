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
    console.log('=== 直接測試級聯退水更新 ===\n');
    
    try {
        // 1. 查找有下級的代理
        console.log('1. 查找有下級代理的測試代理...');
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
            console.log('沒有找到有下級的代理');
            return;
        }
        
        const testAgent = agentsWithSubordinates.rows[0];
        console.log(`找到測試代理: ${testAgent.username} (ID: ${testAgent.id}, Level: ${testAgent.level})`);
        console.log(`當前退水: ${(testAgent.rebate_percentage * 100).toFixed(1)}%`);
        
        // 2. 查看其下級代理
        console.log('\n2. 查看下級代理狀態:');
        const subordinates = await pool.query(`
            SELECT id, username, level, rebate_percentage, max_rebate_percentage
            FROM agents
            WHERE parent_id = $1 AND status = 1
            ORDER BY level, id
        `, [testAgent.id]);
        
        console.log('下級代理:');
        subordinates.rows.forEach(sub => {
            console.log(`  ${sub.level}級 ${sub.username}: 退水 ${(sub.rebate_percentage * 100).toFixed(1)}%, max ${(sub.max_rebate_percentage * 100).toFixed(1)}%`);
        });
        
        // 3. 測試降低退水
        console.log('\n3. 降低測試代理退水到 0.1%...');
        await pool.query(`
            UPDATE agents 
            SET rebate_percentage = 0.001, max_rebate_percentage = 0.001 
            WHERE id = $1
        `, [testAgent.id]);
        
        // 觸發級聯更新
        console.log('觸發級聯更新...');
        await adjustDownlineRebateSettings(testAgent.id, 0.001);
        
        // 查看更新後狀態
        const updatedSubs = await pool.query(`
            SELECT id, username, level, rebate_percentage, max_rebate_percentage
            FROM agents
            WHERE parent_id = $1 AND status = 1
            ORDER BY level, id
        `, [testAgent.id]);
        
        console.log('\n降低後的下級代理狀態:');
        updatedSubs.rows.forEach(sub => {
            console.log(`  ${sub.level}級 ${sub.username}: 退水 ${(sub.rebate_percentage * 100).toFixed(1)}%, max ${(sub.max_rebate_percentage * 100).toFixed(1)}%`);
        });
        
        // 4. 測試提高退水
        console.log('\n4. 提高測試代理退水到 0.9%...');
        await pool.query(`
            UPDATE agents 
            SET rebate_percentage = 0.009, max_rebate_percentage = 0.009 
            WHERE id = $1
        `, [testAgent.id]);
        
        // 觸發級聯更新
        console.log('觸發級聯更新...');
        await adjustDownlineRebateSettings(testAgent.id, 0.009);
        
        // 查看更新後狀態
        const increasedSubs = await pool.query(`
            SELECT id, username, level, rebate_percentage, max_rebate_percentage
            FROM agents
            WHERE parent_id = $1 AND status = 1
            ORDER BY level, id
        `, [testAgent.id]);
        
        console.log('\n提高後的下級代理狀態:');
        increasedSubs.rows.forEach(sub => {
            console.log(`  ${sub.level}級 ${sub.username}: 退水 ${(sub.rebate_percentage * 100).toFixed(1)}%, max ${(sub.max_rebate_percentage * 100).toFixed(1)}%`);
            if (sub.max_rebate_percentage === 0.009) {
                console.log(`  ✓ ${sub.username} 的最大退水已正確更新`);
            } else {
                console.log(`  ✗ ${sub.username} 的最大退水未更新`);
            }
        });
        
    } catch (error) {
        console.error('測試失敗:', error);
    } finally {
        await pool.end();
    }
}

// 級聯更新函數
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
        
        // 情況1：退水超過新限制，需要調降
        if (currentRebate > maxRebatePercentage) {
            newRebate = maxRebatePercentage;
            needUpdate = true;
            updateDescription = `退水調降: ${(currentRebate * 100).toFixed(1)}% -> ${(newRebate * 100).toFixed(1)}%`;
        }
        
        // 情況2：最大退水需要更新（不論上調或下調）
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
            
            console.log(`  - 調整下級代理 ${childAgent.username}: ${updateDescription}`);
        }
        
        // 遞迴處理
        await adjustDownlineRebateSettings(childAgent.id, maxRebatePercentage);
    }
}

// 執行測試
testCascadingRebate().then(() => {
    console.log('\n測試完成');
}).catch(error => {
    console.error('執行錯誤:', error);
    process.exit(1);
});