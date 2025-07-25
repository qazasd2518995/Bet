import pg from 'pg';
const { Client } = pg;

async function checkPeriod493() {
    const client = new Client({
        host: 'dpg-d0e2imc9c44c73che3kg-a.oregon-postgres.render.com',
        port: 5432,
        database: 'bet_game',
        user: 'bet_game_user',
        password: 'Vm4J5g1gymwPfBNcgYfGCe4GEZqCjoIy',
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected to database');

        // 1. 查询开奖结果
        console.log('\n=== 1. 期号 20250718493 开奖结果 ===');
        const resultQuery = await client.query(
            "SELECT * FROM result_history WHERE period = $1",
            ['20250718493']
        );
        
        if (resultQuery.rows.length > 0) {
            const result = resultQuery.rows[0];
            console.log('期号:', result.period);
            console.log('开奖时间:', result.created_at);
            console.log('开奖结果:', result.result);
            
            // 解析开奖结果
            try {
                const positions = JSON.parse(result.result);
                console.log('\n解析后的开奖位置:');
                positions.forEach((num, idx) => {
                    console.log(`第${idx + 1}名: ${num}`);
                });
                console.log('\n重点: 第1名开奖号码是', positions[0]);
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
                (bet_type = 'position' AND position = 1)
            )
            ORDER BY id
        `, ['20250718493']);

        console.log(`\n找到 ${firstPlaceBets.rows.length} 笔第1名相关投注:`);
        
        firstPlaceBets.rows.forEach(bet => {
            console.log('\n------------------------');
            console.log('投注ID:', bet.id);
            console.log('用户:', bet.username);
            console.log('投注类型:', bet.bet_type);
            console.log('投注值:', bet.bet_value);
            console.log('位置:', bet.position);
            console.log('金额:', bet.amount);
            console.log('赔率:', bet.odds);
            console.log('是否中奖:', bet.win ? '✅ 中奖' : '❌ 未中奖');
            console.log('中奖金额:', bet.win_amount || 0);
            console.log('是否结算:', bet.settled ? '已结算' : '未结算');
        });

        // 3. 查询所有投注记录
        console.log('\n=== 3. 该期所有投注记录 ===');
        const allBets = await client.query(`
            SELECT id, username, bet_type, bet_value, position, amount, odds, win, win_amount, settled
            FROM bet_history 
            WHERE period = $1
            ORDER BY id
        `, ['20250718493']);

        console.log(`\n该期共有 ${allBets.rows.length} 笔投注`);
        
        // 统计
        let totalBetAmount = 0;
        let totalWinAmount = 0;
        let winCount = 0;
        
        allBets.rows.forEach(bet => {
            totalBetAmount += parseFloat(bet.amount);
            if (bet.win) {
                winCount++;
                totalWinAmount += parseFloat(bet.win_amount || 0);
            }
        });
        
        console.log('\n投注统计:');
        console.log('总投注金额:', totalBetAmount);
        console.log('中奖注数:', winCount);
        console.log('总派彩金额:', totalWinAmount);
        
        // 显示每笔投注详情
        console.log('\n所有投注详情:');
        allBets.rows.forEach(bet => {
            console.log(`\nID: ${bet.id}, 用户: ${bet.username}, 类型: ${bet.bet_type}, 值: ${bet.bet_value}, 位置: ${bet.position || '-'}, 金额: ${bet.amount}, 中奖: ${bet.win ? '✅' : '❌'}, 派彩: ${bet.win_amount || 0}`);
        });

        // 4. 查询结算日志
        console.log('\n=== 4. 结算日志 ===');
        const settlementLogs = await client.query(
            "SELECT * FROM settlement_logs WHERE period = $1 ORDER BY created_at",
            ['20250718493']
        );

        if (settlementLogs.rows.length > 0) {
            console.log(`\n找到 ${settlementLogs.rows.length} 笔结算日志:`);
            settlementLogs.rows.forEach(log => {
                console.log('\n时间:', log.created_at);
                console.log('操作:', log.action);
                console.log('详情:', log.details);
            });
        } else {
            console.log('未找到该期结算日志');
        }

        // 5. 查询交易记录
        console.log('\n=== 5. 交易记录 ===');
        const transactions = await client.query(`
            SELECT * FROM transaction_records 
            WHERE period = $1
            ORDER BY created_at
        `, ['20250718493']);

        if (transactions.rows.length > 0) {
            console.log(`\n找到 ${transactions.rows.length} 笔交易记录:`);
            transactions.rows.forEach(tx => {
                console.log(`\n类型: ${tx.transaction_type}, 用户: ${tx.username}, 金额: ${tx.amount}, 时间: ${tx.created_at}`);
            });
        }

    } catch (error) {
        console.error('查询错误:', error.message);
        console.error('错误详情:', error);
    } finally {
        await client.end();
        console.log('\n资料库连接已关闭');
    }
}

checkPeriod493();