import pg from 'pg';
const { Client } = pg;

async function checkPeriod() {
    const client = new Client({
        host: 'dpg-cs7bom08fa8c73e4osjg-a.oregon-postgres.render.com',
        port: 5432,
        database: 'bet_db',
        user: 'bet_db_user',
        password: '2yvPbNmh4E6EhTYGvBHgQlPrJFMX58Oa',
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected to database');

        // 1. 查詢開獎結果
        console.log('\n=== 1. 開獎結果 ===');
        const resultQuery = await client.query(
            "SELECT * FROM result_history WHERE period = $1",
            ['20250718493']
        );
        
        if (resultQuery.rows.length > 0) {
            const result = resultQuery.rows[0];
            console.log('期號:', result.period);
            console.log('開獎時間:', result.created_at);
            console.log('開獎結果:', result.result);
            console.log('完整記錄:', JSON.stringify(result, null, 2));
        } else {
            console.log('未找到該期開獎結果');
        }

        // 2. 查詢投注記錄（特別是第1名相關）
        console.log('\n=== 2. 投注記錄（第1名相關） ===');
        const betQuery = await client.query(`
            SELECT id, username, bet_type, bet_value, position, amount, odds, win, win_amount, settled, created_at
            FROM bet_history 
            WHERE period = $1 
            AND (bet_type = 'number' OR bet_type = 'champion' OR bet_type LIKE '%第1名%' OR position = 1)
            ORDER BY id
        `, ['20250718493']);

        console.log(`找到 ${betQuery.rows.length} 筆相關投注`);
        if (betQuery.rows.length > 0) {
            betQuery.rows.forEach(bet => {
                console.log('\n投注ID:', bet.id);
                console.log('用戶:', bet.username);
                console.log('投注類型:', bet.bet_type);
                console.log('投注值:', bet.bet_value);
                console.log('位置:', bet.position);
                console.log('金額:', bet.amount);
                console.log('賠率:', bet.odds);
                console.log('是否中獎:', bet.win);
                console.log('中獎金額:', bet.win_amount);
                console.log('是否結算:', bet.settled);
                console.log('投注時間:', bet.created_at);
            });
        }

        // 3. 查詢結算日誌
        console.log('\n=== 3. 結算日誌 ===');
        const settlementQuery = await client.query(
            "SELECT * FROM settlement_logs WHERE period = $1",
            ['20250718493']
        );

        if (settlementQuery.rows.length > 0) {
            console.log(`找到 ${settlementQuery.rows.length} 筆結算日誌`);
            settlementQuery.rows.forEach(log => {
                console.log('\n日誌ID:', log.id);
                console.log('期號:', log.period);
                console.log('操作:', log.action);
                console.log('詳情:', log.details);
                console.log('時間:', log.created_at);
            });
        } else {
            console.log('未找到該期結算日誌');
        }

        // 4. 查詢所有該期投注（完整列表）
        console.log('\n=== 4. 該期所有投注記錄 ===');
        const allBetsQuery = await client.query(`
            SELECT id, username, bet_type, bet_value, position, amount, odds, win, win_amount, settled
            FROM bet_history 
            WHERE period = $1 
            ORDER BY id
        `, ['20250718493']);

        console.log(`該期共有 ${allBetsQuery.rows.length} 筆投注`);
        
        // 統計各類型投注
        const betStats = {};
        allBetsQuery.rows.forEach(bet => {
            const key = `${bet.bet_type}-${bet.position || 'N/A'}`;
            if (!betStats[key]) {
                betStats[key] = { count: 0, totalAmount: 0, wins: 0, totalWinAmount: 0 };
            }
            betStats[key].count++;
            betStats[key].totalAmount += parseFloat(bet.amount);
            if (bet.win) {
                betStats[key].wins++;
                betStats[key].totalWinAmount += parseFloat(bet.win_amount || 0);
            }
        });

        console.log('\n投注統計:');
        Object.entries(betStats).forEach(([key, stats]) => {
            console.log(`${key}: ${stats.count} 筆, 總金額: ${stats.totalAmount}, 中獎: ${stats.wins} 筆, 總中獎金額: ${stats.totalWinAmount}`);
        });

    } catch (error) {
        console.error('查詢錯誤:', error);
    } finally {
        await client.end();
    }
}

checkPeriod();