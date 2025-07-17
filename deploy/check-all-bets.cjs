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

async function checkAllBets() {
    let client;
    try {
        client = await pool.connect();
        console.log('已連接到數據庫...');

        // 檢查所有下注紀錄
        console.log('\n=== 系統中的所有下注紀錄 ===');
        const allBetsResult = await client.query('SELECT COUNT(*) FROM bet_history');
        console.log('總下注紀錄數:', allBetsResult.rows[0].count);

        if (parseInt(allBetsResult.rows[0].count) > 0) {
            // 顯示最近的一些下注紀錄
            const recentBetsResult = await client.query('SELECT * FROM bet_history ORDER BY created_at DESC LIMIT 10');
            console.log('最近 10 筆下注紀錄:');
            recentBetsResult.rows.forEach((bet, index) => {
                console.log(`${index + 1}. 用戶: ${bet.username}, 金額: ${bet.amount}, 遊戲: ${bet.bet_type}, 時間: ${bet.created_at}`);
            });

            // 找出有下注的用戶
            const usersWithBetsResult = await client.query(`
                SELECT username, COUNT(*) as bet_count, SUM(amount) as total_amount 
                FROM bet_history 
                GROUP BY username 
                ORDER BY bet_count DESC
            `);
            console.log('\n=== 有下注的用戶 ===');
            usersWithBetsResult.rows.forEach(user => {
                console.log(`用戶: ${user.username}, 下注次數: ${user.bet_count}, 總金額: ${user.total_amount}`);
            });

            // 檢查這些用戶是否為會員，以及對應的代理
            console.log('\n=== 會員與代理對應關係 ===');
            for (const userBet of usersWithBetsResult.rows) {
                const memberResult = await client.query('SELECT id, agent_id FROM members WHERE username = $1', [userBet.username]);
                if (memberResult.rows.length > 0) {
                    const member = memberResult.rows[0];
                    const agentResult = await client.query('SELECT username, level FROM agents WHERE id = $1', [member.agent_id]);
                    if (agentResult.rows.length > 0) {
                        const agent = agentResult.rows[0];
                        console.log(`會員 ${userBet.username} -> 代理 ${agent.username} (級別 ${agent.level})`);
                    }
                } else {
                    console.log(`用戶 ${userBet.username} 不在會員表中`);
                }
            }
        } else {
            console.log('系統中沒有下注紀錄');
            
            // 創建一些測試下注紀錄
            console.log('\n=== 創建測試下注紀錄 ===');
            const testBets = [
                {
                    username: 'A01member',
                    bet_type: '牛牛',
                    bet_value: '大',
                    position: 1,
                    amount: 100,
                    odds: 1.95,
                    period: 20250707001,
                    win: true,
                    win_amount: 195
                },
                {
                    username: 'TestMemberA01',
                    bet_type: '牛牛',
                    bet_value: '小',
                    position: 2,
                    amount: 50,
                    odds: 1.95,
                    period: 20250707001,
                    win: false,
                    win_amount: 0
                }
            ];

            for (const bet of testBets) {
                await client.query(`
                    INSERT INTO bet_history 
                    (username, bet_type, bet_value, position, amount, odds, period, win, win_amount, settled, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW())
                `, [
                    bet.username, bet.bet_type, bet.bet_value, bet.position, 
                    bet.amount, bet.odds, bet.period, bet.win, bet.win_amount
                ]);
                console.log(`創建測試下注紀錄: ${bet.username} 下注 ${bet.amount} 元`);
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

checkAllBets();
