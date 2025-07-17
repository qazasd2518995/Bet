const { Pool } = require('pg');

// 直接使用資料庫配置
const dbConfig = {
    host: 'dpg-d0e2imc9c44c73che3kg-a.oregon-postgres.render.com',
    port: 5432,
    database: 'bet_game',
    user: 'bet_game_user',
    password: 'Vm4J5g1gymwPfBNcgYfGCe4GEZqCjoIy',
    ssl: { rejectUnauthorized: false }
};

const pool = new Pool(dbConfig);

async function checkAgentStructure() {
    console.log('===== 檢查代理相關表結構 =====\n');
    
    try {
        // 1. 檢查 agents 表結構
        console.log('1. agents 表結構：');
        const agentStructureQuery = `
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'agents'
            ORDER BY ordinal_position
        `;
        
        const agentStructure = await pool.query(agentStructureQuery);
        if (agentStructure.rows.length > 0) {
            console.log('Agents 表欄位：');
            agentStructure.rows.forEach(col => {
                console.log(`  - ${col.column_name} (${col.data_type})`);
            });
        } else {
            console.log('Agents 表不存在');
        }
        
        // 2. 檢查 justin111 的會員和代理資訊
        console.log('\n\n2. 查詢 justin111 的會員資訊：');
        const memberQuery = `
            SELECT * FROM members WHERE username = 'justin111'
        `;
        
        const memberResult = await pool.query(memberQuery);
        if (memberResult.rows.length > 0) {
            const member = memberResult.rows[0];
            console.log('會員資料：');
            Object.keys(member).forEach(key => {
                console.log(`  ${key}: ${member[key]}`);
            });
            
            // 如果有 agent_id，查詢代理資訊
            if (member.agent_id) {
                console.log(`\n3. 查詢代理 ID ${member.agent_id} 的資訊：`);
                const agentQuery = `
                    SELECT * FROM agents WHERE id = $1
                `;
                
                const agentResult = await pool.query(agentQuery, [member.agent_id]);
                if (agentResult.rows.length > 0) {
                    const agent = agentResult.rows[0];
                    console.log('代理資料：');
                    Object.keys(agent).forEach(key => {
                        console.log(`  ${key}: ${agent[key]}`);
                    });
                } else {
                    console.log('找不到對應的代理');
                }
            }
        } else {
            console.log('找不到會員 justin111');
        }
        
        // 3. 檢查代理階層關係
        console.log('\n\n4. 檢查代理階層關係：');
        const hierarchyQuery = `
            SELECT 
                a1.id as agent_id,
                a1.username as agent_username,
                a1.parent_id,
                a2.username as parent_username,
                a1.rebate_percentage
            FROM agents a1
            LEFT JOIN agents a2 ON a1.parent_id = a2.id
            WHERE EXISTS (
                SELECT 1 FROM members m 
                WHERE m.username = 'justin111' 
                AND m.agent_id = a1.id
            )
        `;
        
        const hierarchyResult = await pool.query(hierarchyQuery);
        if (hierarchyResult.rows.length > 0) {
            console.log('代理階層：');
            hierarchyResult.rows.forEach(row => {
                console.log(`  代理: ${row.agent_username} (ID: ${row.agent_id})`);
                console.log(`  上級: ${row.parent_username || '無'} (ID: ${row.parent_id || '無'})`);
                console.log(`  退水比例: ${row.rebate_percentage}%`);
            });
        }
        
    } catch (error) {
        console.error('檢查過程中發生錯誤:', error);
    } finally {
        await pool.end();
    }
}

// 執行檢查
checkAgentStructure();