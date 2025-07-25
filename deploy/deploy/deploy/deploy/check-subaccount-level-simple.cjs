const { Client } = require('pg');

const config = {
    host: 'dpg-d0e2imc9c44c73che3kg-a.oregon-postgres.render.com',
    port: 5432,
    database: 'bet_game',
    user: 'bet_game_user',
    password: 'Vm4J5g1gymwPfBNcgYfGCe4GEZqCjoIy',
    ssl: { rejectUnauthorized: false }
};

async function checkSubAccountLevel() {
    const client = new Client(config);
    
    try {
        await client.connect();
        console.log('已連接到數據庫\n');
        
        // 查詢子帳號 justin2025Ab
        const subAccountResult = await client.query(`
            SELECT sa.*, a.username as parent_agent_username, a.id as parent_agent_id, a.level as parent_agent_level
            FROM sub_accounts sa
            JOIN agents a ON sa.parent_agent_id = a.id
            WHERE sa.username = $1
        `, ['justin2025Ab']);
        
        if (subAccountResult.rows.length > 0) {
            const subAccount = subAccountResult.rows[0];
            console.log('子帳號信息:');
            console.log('- 子帳號用戶名:', subAccount.username);
            console.log('- 父代理ID:', subAccount.parent_agent_id);
            console.log('- 父代理用戶名:', subAccount.parent_agent_username);
            console.log('- 父代理級別:', subAccount.parent_agent_level);
            console.log('\n');
            
            // 直接查詢父代理
            const parentResult = await client.query(`
                SELECT id, username, level
                FROM agents
                WHERE username = $1
            `, ['ti2025A']);
            
            if (parentResult.rows.length > 0) {
                const parentAgent = parentResult.rows[0];
                console.log('直接查詢父代理 ti2025A:');
                console.log('- ID:', parentAgent.id);
                console.log('- 用戶名:', parentAgent.username);
                console.log('- 級別:', parentAgent.level);
                console.log('\n');
            }
            
            // 查詢 ID 28 的代理
            const agent28Result = await client.query(`
                SELECT id, username, level
                FROM agents
                WHERE id = 28
            `);
            
            if (agent28Result.rows.length > 0) {
                const agent28 = agent28Result.rows[0];
                console.log('ID 28 的代理信息:');
                console.log('- ID:', agent28.id);
                console.log('- 用戶名:', agent28.username);
                console.log('- 級別:', agent28.level);
            }
        } else {
            console.log('找不到子帳號 justin2025Ab');
        }
        
    } catch (error) {
        console.error('錯誤:', error);
    } finally {
        await client.end();
        console.log('\n數據庫連接已關閉');
    }
}

checkSubAccountLevel();