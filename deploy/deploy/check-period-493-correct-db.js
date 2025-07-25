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

        // 1. 查詢開獎結果
        console.log('\n=== 1. 期號 20250718493 開獎結果 ===');
        const resultQuery = await client.query(
            "SELECT * FROM result_history WHERE period = $1",
            ['20250718493']
        );
        
        if (resultQuery.rows.length > 0) {
            const result = resultQuery.rows[0];
            console.log('期號:', result.period);
            console.log('開獎時間:', result.created_at);
            console.log('開獎結果:', result.result);
            
            // 解析開獎結果
            try {
                const positions = JSON.parse(result.result);
                console.log('\n解析後的開獎位置:');
                positions.forEach((num, idx) => {
                    console.log(`第${idx + 1}名: ${num}`);
                });
                console.log('\n重點: 第1名開獎號碼是', positions[0]);
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
                (bet_type = 'position' AND position = 1)
            )
            ORDER BY id
        `, ['20250718493']);

        console.log(`\n找到 ${firstPlaceBets.rows.length} 筆第1名相關投注:`);
        
        firstPlaceBets.rows.forEach(bet => {
            console.log('\n------------------------');
            console.log('投注ID:', bet.id);
            console.log('用戶:', bet.username);
            console.log('投注類型:', bet.bet_type);
            console.log('投注值:', bet.bet_value);
            console.log('位置:', bet.position);
            console.log('金額:', bet.amount);
            console.log('賠率:', bet.odds);
            console.log('是否中獎:', bet.win ? '✅ 中獎' : '❌ 未中獎');
            console.log('中獎金額:', bet.win_amount || 0);
            console.log('是否結算:', bet.settled ? '已結算' : '未結算');
        });

        // 3. 查詢所有投注記錄
        console.log('\n=== 3. 該期所有投注記錄 ===');
        const allBets = await client.query(`
            SELECT id, username, bet_type, bet_value, position, amount, odds, win, win_amount, settled
            FROM bet_history 
            WHERE period = $1
            ORDER BY id
        `, ['20250718493']);

        console.log(`\n該期共有 ${allBets.rows.length} 筆投注`);
        
        // 統計
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
        
        console.log('\n投注統計:');
        console.log('總投注金額:', totalBetAmount);
        console.log('中獎注數:', winCount);
        console.log('總派彩金額:', totalWinAmount);
        
        // 顯示每筆投注詳情
        console.log('\n所有投注詳情:');
        allBets.rows.forEach(bet => {
            console.log(`\nID: ${bet.id}, 用戶: ${bet.username}, 類型: ${bet.bet_type}, 值: ${bet.bet_value}, 位置: ${bet.position || '-'}, 金額: ${bet.amount}, 中獎: ${bet.win ? '✅' : '❌'}, 派彩: ${bet.win_amount || 0}`);
        });

        // 4. 查詢結算日誌
        console.log('\n=== 4. 結算日誌 ===');
        const settlementLogs = await client.query(
            "SELECT * FROM settlement_logs WHERE period = $1 ORDER BY created_at",
            ['20250718493']
        );

        if (settlementLogs.rows.length > 0) {
            console.log(`\n找到 ${settlementLogs.rows.length} 筆結算日誌:`);
            settlementLogs.rows.forEach(log => {
                console.log('\n時間:', log.created_at);
                console.log('操作:', log.action);
                console.log('詳情:', log.details);
            });
        } else {
            console.log('未找到該期結算日誌');
        }

        // 5. 查詢交易記錄
        console.log('\n=== 5. 交易記錄 ===');
        const transactions = await client.query(`
            SELECT * FROM transaction_records 
            WHERE period = $1
            ORDER BY created_at
        `, ['20250718493']);

        if (transactions.rows.length > 0) {
            console.log(`\n找到 ${transactions.rows.length} 筆交易記錄:`);
            transactions.rows.forEach(tx => {
                console.log(`\n類型: ${tx.transaction_type}, 用戶: ${tx.username}, 金額: ${tx.amount}, 時間: ${tx.created_at}`);
            });
        }

    } catch (error) {
        console.error('查詢錯誤:', error.message);
        console.error('錯誤詳情:', error);
    } finally {
        await client.end();
        console.log('\n資料庫連接已關閉');
    }
}

checkPeriod493();