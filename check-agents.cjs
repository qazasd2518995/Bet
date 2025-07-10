const { Pool } = require('pg');

// 資料庫連接配置 - 使用 Render PostgreSQL
const pool = new Pool({
    host: 'dpg-d0e2imc9c44c73che3kg-a.oregon-postgres.render.com',
    port: 5432,
    database: 'bet_game',
    user: 'bet_game_user',
    password: 'Vm4J5g1gymwPfBNcgYfGCe4GEZqCjoIy',
    ssl: true
});

async function checkAgents() {
    let client;
    try {
        client = await pool.connect();
        console.log('已連接到數據庫...');

        // 首先檢查表結構
        console.log('\n=== 檢查表結構 ===');
        const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `);
        console.log('資料庫中的表：', tablesResult.rows.map(row => row.table_name));

        // 檢查 agents 表的欄位
        if (tablesResult.rows.some(row => row.table_name === 'agents')) {
            console.log('\n=== agents 表欄位 ===');
            const agentColumnsResult = await client.query(`
                SELECT column_name, data_type, is_nullable 
                FROM information_schema.columns 
                WHERE table_name = 'agents' 
                ORDER BY ordinal_position
            `);
            console.log('agents 表欄位：');
            agentColumnsResult.rows.forEach(col => {
                console.log(`- ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
            });

            // 查詢代理資料
            console.log('\n=== 代理帳號列表 ===');
            const agentsResult = await client.query('SELECT * FROM agents LIMIT 10');
            console.log('找到', agentsResult.rows.length, '個代理帳號：');
            agentsResult.rows.forEach(agent => {
                console.log('代理資料:', agent);
            });
        }

        // 檢查 members 表的欄位
        if (tablesResult.rows.some(row => row.table_name === 'members')) {
            console.log('\n=== members 表欄位 ===');
            const memberColumnsResult = await client.query(`
                SELECT column_name, data_type, is_nullable 
                FROM information_schema.columns 
                WHERE table_name = 'members' 
                ORDER BY ordinal_position
            `);
            console.log('members 表欄位：');
            memberColumnsResult.rows.forEach(col => {
                console.log(`- ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
            });

            // 查詢會員資料
            console.log('\n=== 會員帳號列表 ===');
            const membersResult = await client.query('SELECT * FROM members LIMIT 5');
            console.log('找到', membersResult.rows.length, '個會員帳號：');
            membersResult.rows.forEach(member => {
                console.log('會員資料:', member);
            });
        }

    } catch (error) {
        console.error('檢查失敗:', error);
    } finally {
        if (client) {
            client.release();
        }
        await pool.end();
    }
}

checkAgents();
