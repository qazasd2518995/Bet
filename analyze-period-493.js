import pg from 'pg';
const { Client } = pg;

async function analyzePeriod493() {
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
            
            // 解析开奖结果
            try {
                const positions = JSON.parse(result.result);
                console.log('\n解析后的位置:');
                positions.forEach((num, idx) => {
                    console.log(`第${idx + 1}名: ${num}`);
                });
            } catch (e) {
                console.log('解析开奖结果失败:', e.message);
            }
        } else {
            console.log('未找到该期开奖结果');
        }

        // 2. 查询第1名相关投注
        console.log('\n=== 2. 第1名相关投注记录 ===');
        const firstPlaceBets = await client.query(`
            SELECT id, username, bet_type, bet_value, position, amount, odds, win, win_amount, settled, created_at
            FROM bet_history 
            WHERE period = $1 
            AND (
                (bet_type = 'number' AND position = 1) OR 
                (bet_type = 'champion') OR 
                (bet_type LIKE '%第1名%') OR
                (bet_type = 'position' AND position = 1)
            )
            ORDER BY id
        `, ['20250718493']);

        console.log(`找到 ${firstPlaceBets.rows.length} 笔第1名相关投注`);
        if (firstPlaceBets.rows.length > 0) {
            firstPlaceBets.rows.forEach(bet => {
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
                
                // 分析为什么会中奖或不中奖
                if (bet.bet_type === 'number' && bet.position === 1) {
                    console.log(`分析: 下注第1名号码${bet.bet_value}，开奖第1名号码是2`);
                    if (bet.bet_value === '2' && bet.win) {
                        console.log('✅ 正确中奖');
                    } else if (bet.bet_value !== '2' && !bet.win) {
                        console.log('✅ 正确未中奖');
                    } else {
                        console.log('❌ 结算可能有误');
                    }
                }
            });
        }

        // 3. 查询所有投注统计
        console.log('\n=== 3. 所有投注统计 ===');
        const allBets = await client.query(`
            SELECT bet_type, position, COUNT(*) as count, 
                   SUM(amount) as total_amount,
                   SUM(CASE WHEN win THEN 1 ELSE 0 END) as win_count,
                   SUM(win_amount) as total_win_amount
            FROM bet_history 
            WHERE period = $1
            GROUP BY bet_type, position
            ORDER BY bet_type, position
        `, ['20250718493']);

        console.log('各类型投注统计:');
        allBets.rows.forEach(stat => {
            console.log(`\n类型: ${stat.bet_type}, 位置: ${stat.position || 'N/A'}`);
            console.log(`  投注数: ${stat.count}`);
            console.log(`  总金额: ${stat.total_amount}`);
            console.log(`  中奖数: ${stat.win_count}`);
            console.log(`  总派彩: ${stat.total_win_amount || 0}`);
        });

        // 4. 查询结算日志
        console.log('\n=== 4. 结算日志 ===');
        const settlementLogs = await client.query(
            "SELECT * FROM settlement_logs WHERE period = $1 ORDER BY created_at",
            ['20250718493']
        );

        if (settlementLogs.rows.length > 0) {
            console.log(`找到 ${settlementLogs.rows.length} 笔结算日志`);
            settlementLogs.rows.forEach(log => {
                console.log('\n时间:', log.created_at);
                console.log('操作:', log.action);
                console.log('详情:', log.details);
            });
        } else {
            console.log('未找到该期结算日志');
        }

        // 5. 查询用户余额变化
        console.log('\n=== 5. 用户余额变化 ===');
        const userBalance = await client.query(`
            SELECT username, 
                   SUM(CASE WHEN transaction_type = 'bet' THEN -amount ELSE 0 END) as bet_amount,
                   SUM(CASE WHEN transaction_type = 'win' THEN amount ELSE 0 END) as win_amount,
                   SUM(CASE WHEN transaction_type = 'rebate' THEN amount ELSE 0 END) as rebate_amount
            FROM transaction_records 
            WHERE period = $1
            GROUP BY username
        `, ['20250718493']);

        if (userBalance.rows.length > 0) {
            console.log('用户交易统计:');
            userBalance.rows.forEach(user => {
                console.log(`\n用户: ${user.username}`);
                console.log(`  下注: ${user.bet_amount}`);
                console.log(`  中奖: ${user.win_amount}`);
                console.log(`  退水: ${user.rebate_amount}`);
                console.log(`  净值: ${parseFloat(user.bet_amount) + parseFloat(user.win_amount) + parseFloat(user.rebate_amount)}`);
            });
        }

    } catch (error) {
        console.error('查询错误:', error);
    } finally {
        await client.end();
    }
}

analyzePeriod493();