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

        // 1. 查询开奖结果
        console.log('\n=== 1. 开奖结果 ===');
        const resultQuery = await client.query(
            "SELECT * FROM result_history WHERE period = $1",
            ['20250718493']
        );
        
        if (resultQuery.rows.length > 0) {
            const result = resultQuery.rows[0];
            console.log('期号:', result.period);
            console.log('开奖时间:', result.created_at);
            console.log('开奖结果:', result.result);
            console.log('完整记录:', JSON.stringify(result, null, 2));
        } else {
            console.log('未找到该期开奖结果');
        }

        // 2. 查询投注记录（特别是第1名相关）
        console.log('\n=== 2. 投注记录（第1名相关） ===');
        const betQuery = await client.query(`
            SELECT id, username, bet_type, bet_value, position, amount, odds, win, win_amount, settled, created_at
            FROM bet_history 
            WHERE period = $1 
            AND (bet_type = 'number' OR bet_type = 'champion' OR bet_type LIKE '%第1名%' OR position = 1)
            ORDER BY id
        `, ['20250718493']);

        console.log(`找到 ${betQuery.rows.length} 笔相关投注`);
        if (betQuery.rows.length > 0) {
            betQuery.rows.forEach(bet => {
                console.log('\n投注ID:', bet.id);
                console.log('用户:', bet.username);
                console.log('投注类型:', bet.bet_type);
                console.log('投注值:', bet.bet_value);
                console.log('位置:', bet.position);
                console.log('金额:', bet.amount);
                console.log('赔率:', bet.odds);
                console.log('是否中奖:', bet.win);
                console.log('中奖金额:', bet.win_amount);
                console.log('是否结算:', bet.settled);
                console.log('投注时间:', bet.created_at);
            });
        }

        // 3. 查询结算日志
        console.log('\n=== 3. 结算日志 ===');
        const settlementQuery = await client.query(
            "SELECT * FROM settlement_logs WHERE period = $1",
            ['20250718493']
        );

        if (settlementQuery.rows.length > 0) {
            console.log(`找到 ${settlementQuery.rows.length} 笔结算日志`);
            settlementQuery.rows.forEach(log => {
                console.log('\n日志ID:', log.id);
                console.log('期号:', log.period);
                console.log('操作:', log.action);
                console.log('详情:', log.details);
                console.log('时间:', log.created_at);
            });
        } else {
            console.log('未找到该期结算日志');
        }

        // 4. 查询所有该期投注（完整列表）
        console.log('\n=== 4. 该期所有投注记录 ===');
        const allBetsQuery = await client.query(`
            SELECT id, username, bet_type, bet_value, position, amount, odds, win, win_amount, settled
            FROM bet_history 
            WHERE period = $1 
            ORDER BY id
        `, ['20250718493']);

        console.log(`该期共有 ${allBetsQuery.rows.length} 笔投注`);
        
        // 统计各类型投注
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

        console.log('\n投注统计:');
        Object.entries(betStats).forEach(([key, stats]) => {
            console.log(`${key}: ${stats.count} 笔, 总金额: ${stats.totalAmount}, 中奖: ${stats.wins} 笔, 总中奖金额: ${stats.totalWinAmount}`);
        });

    } catch (error) {
        console.error('查询错误:', error);
    } finally {
        await client.end();
    }
}

checkPeriod();