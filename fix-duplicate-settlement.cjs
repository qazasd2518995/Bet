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
        
        // 1. 查詢用戶 lala222 的交易記錄，找出可能的重複交易
        const transactionsResult = await client.query(`
            SELECT id, username, amount, type, description, created_at
            FROM transactions
            WHERE username = 'lala222'
            AND created_at > NOW() - INTERVAL '24 hours'
            ORDER BY created_at DESC
        `);
        
        console.log(`\n=== 用戶 lala222 最近24小時的交易記錄 ===`);
        console.log(`找到 ${transactionsResult.rows.length} 筆交易記錄`);
        
        // 檢查是否有重複交易
        const winTransactions = transactionsResult.rows.filter(t => t.description.includes('中獎') && t.amount > 0);
        console.log(`其中 ${winTransactions.length} 筆是中獎交易`);
        
        // 按期號和注單ID分組，找出重複的中獎交易
        const winTransactionsByDescription = {};
        winTransactions.forEach(t => {
            const key = t.description;
            if (!winTransactionsByDescription[key]) {
                winTransactionsByDescription[key] = [];
            }
            winTransactionsByDescription[key].push(t);
        });
        
        console.log(`\n=== 檢查重複中獎交易 ===`);
        let hasDuplicates = false;
        for (const [desc, transactions] of Object.entries(winTransactionsByDescription)) {
            if (transactions.length > 1) {
                hasDuplicates = true;
                console.log(`發現重複交易: ${desc}`);
                transactions.forEach(t => {
                    console.log(`  ID: ${t.id}, 金額: ${t.amount}, 時間: ${t.created_at}`);
                });
                
                // 只保留最早的一筆交易，刪除其他重複的
                const [first, ...duplicates] = transactions.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
                console.log(`保留最早的交易 ID: ${first.id}, 刪除 ${duplicates.length} 筆重複交易`);
                
                // 請確認後再取消以下代碼的註釋來執行刪除操作
                /*
                for (const dup of duplicates) {
                    await client.query(`
                        DELETE FROM transactions WHERE id = $1
                    `, [dup.id]);
                    console.log(`已刪除重複交易 ID: ${dup.id}`);
                }
                */
            }
        }
        
        if (!hasDuplicates) {
            console.log(`沒有發現重複的中獎交易`);
        }
        
        // 2. 檢查注單是否有重複結算標記
        const betsResult = await client.query(`
            SELECT id, username, amount, bet_type, bet_value, position, is_settled, win_amount, created_at
            FROM bet_history
            WHERE username = 'lala222'
            AND created_at > NOW() - INTERVAL '24 hours'
            ORDER BY created_at DESC
        `);
        
        console.log(`\n=== 用戶 lala222 最近24小時的注單記錄 ===`);
        console.log(`找到 ${betsResult.rows.length} 筆注單記錄`);
        
        // 3. 檢查餘額是否正確
        const balanceResult = await client.query(`
            SELECT username, balance
            FROM members
            WHERE username = 'lala222'
        `);
        
        if (balanceResult.rows.length > 0) {
            console.log(`\n=== 用戶 lala222 當前餘額 ===`);
            console.log(`餘額: ${balanceResult.rows[0].balance}`);
            
            // 計算預期餘額
            let expectedBalance = 0;
            const allTransactions = transactionsResult.rows.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            
            // 假設初始餘額為0
            for (const t of allTransactions) {
                expectedBalance += parseFloat(t.amount);
            }
            
            console.log(`根據交易記錄計算的預期餘額: ${expectedBalance}`);
            console.log(`實際餘額與預期餘額的差額: ${balanceResult.rows[0].balance - expectedBalance}`);
            
            // 如果差額過大，建議修復
            if (Math.abs(balanceResult.rows[0].balance - expectedBalance) > 1) {
                console.log(`\n⚠️ 警告: 餘額差異過大，建議修復`);
                // 請確認後再取消以下代碼的註釋來執行更新操作
                /*
                await client.query(`
                    UPDATE members SET balance = $1 WHERE username = 'lala222'
                `, [expectedBalance]);
                console.log(`已更新用戶 lala222 的餘額為 ${expectedBalance}`);
                */
            }
        }
        
        // 4. 提供後端代碼修復建議
        console.log(`\n=== 後端代碼修復建議 ===`);
        console.log(`1. 在 settleBets 函數中，添加避免重複結算的邏輯`);
        console.log(`2. 使用事務處理保證結算過程的原子性`);
        console.log(`3. 檢查可能的並發問題，確保同一期開獎只會處理一次`);
        console.log(`4. 修改 BetModel.updateSettlement 添加檢查機制，防止已結算的注單再次被更新`);
        
    } catch (error) {
        console.error('檢查和修復時發生錯誤:', error.message);
    } finally {
        await client.end();
    }
}

fixDuplicateSettlementIssue();
