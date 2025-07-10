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

async function checkAgentMembers() {
    let client;
    try {
        client = await pool.connect();
        console.log('已連接到數據庫...');

        // 查詢 A01agent 的資訊
        console.log('\n=== A01agent 代理資訊 ===');
        const agentResult = await client.query('SELECT * FROM agents WHERE username = $1', ['A01agent']);
        if (agentResult.rows.length > 0) {
            const agent = agentResult.rows[0];
            console.log('代理資訊:', agent);
            
            // 查詢此代理的下線會員
            console.log('\n=== A01agent 的下線會員 ===');
            const membersResult = await client.query('SELECT * FROM members WHERE agent_id = $1', [agent.id]);
            console.log('找到', membersResult.rows.length, '個下線會員：');
            membersResult.rows.forEach(member => {
                console.log(`會員 ID: ${member.id}, 用戶名: ${member.username}, 餘額: ${member.balance}, 狀態: ${member.status}`);
            });

            // 檢查是否有下注紀錄
            if (membersResult.rows.length > 0) {
                console.log('\n=== 檢查 bet_history 表結構 ===');
                const betColumnsResult = await client.query(`
                    SELECT column_name, data_type 
                    FROM information_schema.columns 
                    WHERE table_name = 'bet_history' 
                    ORDER BY ordinal_position
                `);
                console.log('bet_history 表欄位：');
                betColumnsResult.rows.forEach(col => {
                    console.log(`- ${col.column_name}: ${col.data_type}`);
                });

                console.log('\n=== 檢查會員下注紀錄 ===');
                for (const member of membersResult.rows) {
                    const betResult = await client.query('SELECT COUNT(*) FROM bet_history WHERE username = $1', [member.username]);
                    const bets = betResult.rows[0];
                    console.log(`會員 ${member.username} (ID: ${member.id}): ${bets.count} 筆下注`);
                    
                    if (parseInt(bets.count) > 0) {
                        // 顯示最近的下注紀錄
                        const recentBetsResult = await client.query(
                            'SELECT * FROM bet_history WHERE username = $1 ORDER BY created_at DESC LIMIT 2', 
                            [member.username]
                        );
                        console.log('  最近的下注紀錄:');
                        recentBetsResult.rows.forEach(bet => {
                            console.log('    下注紀錄:', bet);
                        });
                    }
                }
            }

            // 查詢此代理的下線代理
            console.log('\n=== A01agent 的下線代理 ===');
            const subAgentsResult = await client.query('SELECT * FROM agents WHERE parent_id = $1', [agent.id]);
            console.log('找到', subAgentsResult.rows.length, '個下線代理：');
            subAgentsResult.rows.forEach(subAgent => {
                console.log(`代理 ID: ${subAgent.id}, 用戶名: ${subAgent.username}, 級別: ${subAgent.level}`);
            });

            // 檢查下線代理的會員
            if (subAgentsResult.rows.length > 0) {
                console.log('\n=== 下線代理的會員 ===');
                for (const subAgent of subAgentsResult.rows) {
                    const subMembersResult = await client.query('SELECT * FROM members WHERE agent_id = $1', [subAgent.id]);
                    console.log(`代理 ${subAgent.username} 的會員 (${subMembersResult.rows.length} 個):`);
                    subMembersResult.rows.forEach(member => {
                        console.log(`  會員: ${member.username} (ID: ${member.id})`);
                    });
                }
            }
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

checkAgentMembers();
