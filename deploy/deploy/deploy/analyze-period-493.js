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
            
            // 解析開獎結果
            try {
                const positions = JSON.parse(result.result);
                console.log('\n解析後的位置:');
                positions.forEach((num, idx) => {
                    console.log(`第${idx + 1}名: ${num}`);
                });
            } catch (e) {
                console.log('解析開獎結果失敗:', e.message);
            }
        } else {
            console.log('未找到該期開獎結果');
        }

        // 2. 查詢第1名相關投注
        console.log('\n=== 2. 第1名相關投注記錄 ===');
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

        console.log(`找到 ${firstPlaceBets.rows.length} 筆第1名相關投注`);
        if (firstPlaceBets.rows.length > 0) {
            firstPlaceBets.rows.forEach(bet => {
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
                
                // 分析為什麼會中獎或不中獎
                if (bet.bet_type === 'number' && bet.position === 1) {
                    console.log(`分析: 下注第1名號碼${bet.bet_value}，開獎第1名號碼是2`);
                    if (bet.bet_value === '2' && bet.win) {
                        console.log('✅ 正確中獎');
                    } else if (bet.bet_value !== '2' && !bet.win) {
                        console.log('✅ 正確未中獎');
                    } else {
                        console.log('❌ 結算可能有誤');
                    }
                }
            });
        }

        // 3. 查詢所有投注統計
        console.log('\n=== 3. 所有投注統計 ===');
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

        console.log('各類型投注統計:');
        allBets.rows.forEach(stat => {
            console.log(`\n類型: ${stat.bet_type}, 位置: ${stat.position || 'N/A'}`);
            console.log(`  投注數: ${stat.count}`);
            console.log(`  總金額: ${stat.total_amount}`);
            console.log(`  中獎數: ${stat.win_count}`);
            console.log(`  總派彩: ${stat.total_win_amount || 0}`);
        });

        // 4. 查詢結算日誌
        console.log('\n=== 4. 結算日誌 ===');
        const settlementLogs = await client.query(
            "SELECT * FROM settlement_logs WHERE period = $1 ORDER BY created_at",
            ['20250718493']
        );

        if (settlementLogs.rows.length > 0) {
            console.log(`找到 ${settlementLogs.rows.length} 筆結算日誌`);
            settlementLogs.rows.forEach(log => {
                console.log('\n時間:', log.created_at);
                console.log('操作:', log.action);
                console.log('詳情:', log.details);
            });
        } else {
            console.log('未找到該期結算日誌');
        }

        // 5. 查詢用戶餘額變化
        console.log('\n=== 5. 用戶餘額變化 ===');
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
            console.log('用戶交易統計:');
            userBalance.rows.forEach(user => {
                console.log(`\n用戶: ${user.username}`);
                console.log(`  下注: ${user.bet_amount}`);
                console.log(`  中獎: ${user.win_amount}`);
                console.log(`  退水: ${user.rebate_amount}`);
                console.log(`  淨值: ${parseFloat(user.bet_amount) + parseFloat(user.win_amount) + parseFloat(user.rebate_amount)}`);
            });
        }

    } catch (error) {
        console.error('查詢錯誤:', error);
    } finally {
        await client.end();
    }
}

analyzePeriod493();