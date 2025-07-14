require('dotenv').config();
const { Client } = require('pg');

// 確保使用 Render PostgreSQL
const dbConfig = {
    host: 'dpg-d0e2imc9c44c73che3kg-a.oregon-postgres.render.com',
    port: 5432,
    database: 'bet_game',
    user: 'bet_game_user',
    password: 'Vm4J5g1gymwPfBNcgYfGCe4GEZqCjoIy',
    ssl: {
        rejectUnauthorized: false
    }
};

async function fixDuplicateSettlementIssue() {
    const client = new Client(dbConfig);
    
    try {
        await client.connect();
        console.log('✅ 連接到 Render PostgreSQL 成功');
        
        // 1. 檢查資料庫表結構
        console.log('\n=== 檢查資料庫表結構 ===');
        const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        
        console.log(`數據庫中的表:`);
        tablesResult.rows.forEach(row => {
            console.log(`- ${row.table_name}`);
        });
        
        // 2. 檢查交易記錄表的欄位
        const transactionColumnsResult = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'transactions'
        `);
        
        console.log(`\n交易記錄表(transactions)的欄位:`);
        transactionColumnsResult.rows.forEach(row => {
            console.log(`- ${row.column_name}: ${row.data_type}`);
        });
        
        // 3. 檢查注單表的欄位
        const betColumnsResult = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'bet_history'
        `);
        
        console.log(`\n注單表(bet_history)的欄位:`);
        betColumnsResult.rows.forEach(row => {
            console.log(`- ${row.column_name}: ${row.data_type}`);
        });
        
        // 4. 檢查最近的結算注單和交易
        console.log('\n=== 最近的結算注單和相關交易 ===');
        
        // 獲取最新注單的用戶名和期號
        const recentBetsResult = await client.query(`
            SELECT id, username, period, bet_type, bet_value, position, amount, 
                   win, win_amount, settled, created_at
            FROM bet_history 
            WHERE settled = true
            ORDER BY created_at DESC 
            LIMIT 10
        `);
        
        if (recentBetsResult.rows.length > 0) {
            console.log(`最近的10筆已結算注單:`);
            recentBetsResult.rows.forEach(bet => {
                console.log(`ID: ${bet.id}, 用戶: ${bet.username}, 期號: ${bet.period}`);
                console.log(`  類型: ${bet.bet_type}, 值: ${bet.bet_value}, 位置: ${bet.position || 'N/A'}`);
                console.log(`  金額: ${bet.amount}, 贏: ${bet.win}, 贏金額: ${bet.win_amount}`);
                console.log(`  創建時間: ${bet.created_at}`);
                console.log(`---`);
            });
            
            // 獲取用戶名和期號
            const targetUsername = recentBetsResult.rows[0].username;
            const targetPeriod = recentBetsResult.rows[0].period;
            
            // 檢查這個用戶在此期號的所有交易
            console.log(`\n檢查用戶 ${targetUsername} 在期號 ${targetPeriod} 的所有交易:`);
            
            // 找出這個用戶在這個期號的所有注單
            const userBetsResult = await client.query(`
                SELECT id, username, period, bet_type, bet_value, position, amount, 
                       win, win_amount, settled, created_at
                FROM bet_history 
                WHERE username = $1 AND period = $2
                ORDER BY created_at
            `, [targetUsername, targetPeriod]);
            
            console.log(`找到 ${userBetsResult.rows.length} 筆注單`);
            
            for (const bet of userBetsResult.rows) {
                console.log(`注單ID: ${bet.id}, 金額: ${bet.amount}, 贏金額: ${bet.win_amount}`);
                
                // 查找與此注單相關的交易
                const betTransactionsResult = await client.query(`
                    SELECT id, user_type, user_id, amount, type, description, created_at
                    FROM transactions
                    WHERE description LIKE '%注單ID=${bet.id}%' OR description LIKE '%${bet.period}期%'
                    ORDER BY created_at
                `);
                
                console.log(`  相關交易 (${betTransactionsResult.rows.length} 筆):`);
                betTransactionsResult.rows.forEach(tx => {
                    console.log(`  - ID: ${tx.id}, 用戶ID: ${tx.user_id}, 類型: ${tx.user_type}, 金額: ${tx.amount}`);
                    console.log(`    類型: ${tx.type}, 描述: ${tx.description}`);
                    console.log(`    時間: ${tx.created_at}`);
                });
            }
            
            // 5. 查找可能的重複交易
            console.log('\n=== 檢查可能的重複交易 ===');
            const duplicateTransactionsResult = await client.query(`
                SELECT description, COUNT(*) as count, array_agg(id) as ids, array_agg(created_at) as times
                FROM transactions
                WHERE description LIKE '%中獎%' AND created_at > NOW() - INTERVAL '7 days'
                GROUP BY description
                HAVING COUNT(*) > 1
                ORDER BY count DESC
            `);
            
            if (duplicateTransactionsResult.rows.length > 0) {
                console.log(`找到 ${duplicateTransactionsResult.rows.length} 組可能的重複交易:`);
                
                for (const dup of duplicateTransactionsResult.rows) {
                    console.log(`描述: ${dup.description}`);
                    console.log(`重複次數: ${dup.count}`);
                    console.log(`交易IDs: ${dup.ids.join(', ')}`);
                    console.log(`交易時間: ${dup.times.join(', ')}`);
                    console.log(`---`);
                    
                    // 修復重複交易 (默認不執行，需手動確認後解除註釋)
                    /*
                    // 保留最早的一筆，刪除其他重複交易
                    const txIds = dup.ids.map(id => parseInt(id));
                    const firstTxId = txIds.sort((a, b) => a - b)[0]; // 保留ID最小的交易
                    
                    for (const txId of txIds) {
                        if (txId !== firstTxId) {
                            await client.query(`DELETE FROM transactions WHERE id = $1`, [txId]);
                            console.log(`已刪除重複交易 ID: ${txId}`);
                        }
                    }
                    */
                }
            } else {
                console.log(`未發現重複交易`);
            }
            
            // 6. 檢查餘額是否正確
            console.log('\n=== 檢查用戶餘額 ===');
            const userBalanceResult = await client.query(`
                SELECT username, balance
                FROM members
                WHERE username = $1
            `, [targetUsername]);
            
            if (userBalanceResult.rows.length > 0) {
                console.log(`用戶 ${targetUsername} 當前餘額: ${userBalanceResult.rows[0].balance}`);
                
                // 計算預期餘額
                const userTransactionsResult = await client.query(`
                    SELECT SUM(amount) as total
                    FROM transactions
                    WHERE user_id = (SELECT id FROM members WHERE username = $1) AND user_type = 'member'
                `, [targetUsername]);
                
                if (userTransactionsResult.rows.length > 0 && userTransactionsResult.rows[0].total !== null) {
                    console.log(`根據交易記錄計算的總額: ${userTransactionsResult.rows[0].total}`);
                    const diff = userBalanceResult.rows[0].balance - userTransactionsResult.rows[0].total;
                    console.log(`差額: ${diff}`);
                    
                    if (Math.abs(diff) > 0.01) {
                        console.log(`⚠️ 警告: 餘額不符，可能需要修復`);
                        
                        // 修復餘額 (默認不執行，需手動確認後解除註釋)
                        /*
                        await client.query(`
                            UPDATE members SET balance = $1 WHERE username = $2
                        `, [userTransactionsResult.rows[0].total, targetUsername]);
                        console.log(`已更新用戶 ${targetUsername} 的餘額為 ${userTransactionsResult.rows[0].total}`);
                        */
                    } else {
                        console.log(`✅ 餘額正確`);
                    }
                }
            }
        } else {
            console.log(`沒有找到已結算的注單`);
        }
        
        // 7. 建議修復後端代碼
        console.log('\n=== 後端代碼修復建議 ===');
        console.log(`1. BetModel.updateSettlement: 添加檢查避免重複結算`);
        console.log(`2. settleBets函數: 使用事務處理保證原子性`);
        console.log(`3. 後端主流程: 確保同一期開獎只處理一次`);
        console.log(`4. 監控系統: 添加餘額監控以檢測異常`);
        
    } catch (error) {
        console.error('檢查和修復時發生錯誤:', error.message);
        console.error(error.stack);
    } finally {
        await client.end();
    }
}

fixDuplicateSettlementIssue();
