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

async function fixLala222BalanceIssue() {
    const client = new Client(dbConfig);
    
    try {
        await client.connect();
        console.log('✅ 連接到 Render PostgreSQL 成功');
        
        // 1. 確認用戶lala222當前餘額
        const currentBalanceResult = await client.query(`
            SELECT username, balance
            FROM members
            WHERE username = 'lala222'
        `);
        
        if (currentBalanceResult.rows.length === 0) {
            console.log('❌ 找不到用戶 lala222');
            return;
        }
        
        const currentBalance = parseFloat(currentBalanceResult.rows[0].balance);
        console.log(`用戶 lala222 當前餘額: ${currentBalance}`);
        
        // 2. 查看最近的交易記錄
        console.log('\n=== lala222 最近的交易記錄 ===');
        const recentTransactionsResult = await client.query(`
            SELECT id, user_id, user_type, amount, type, description, created_at,
                   before_balance, after_balance
            FROM transactions
            WHERE user_id = (SELECT id FROM members WHERE username = 'lala222')
                AND user_type = 'member'
            ORDER BY created_at DESC
            LIMIT 20
        `);
        
        // 檢查是否有異常交易
        let suspiciousTransactions = [];
        let totalWinAmount = 0;
        let duplicateWin = false;
        
        console.log(`找到 ${recentTransactionsResult.rows.length} 筆交易記錄`);
        
        // 3. 檢查所有與注單ID 1417相關的交易
        console.log('\n=== 注單ID 1417 相關交易 ===');
        const bet1417Transactions = await client.query(`
            SELECT id, user_id, user_type, amount, type, description, created_at,
                   before_balance, after_balance
            FROM transactions
            WHERE description LIKE '%注單ID=1417%' OR description LIKE '%第20250710381期中獎%'
            ORDER BY created_at
        `);
        
        if (bet1417Transactions.rows.length > 0) {
            console.log(`找到 ${bet1417Transactions.rows.length} 筆相關交易`);
            
            let i = 0;
            for (const tx of bet1417Transactions.rows) {
                i++;
                console.log(`交易 ${i}:`);
                console.log(`  ID: ${tx.id}`);
                console.log(`  用戶ID: ${tx.user_id}`);
                console.log(`  金額: ${tx.amount}`);
                console.log(`  類型: ${tx.type}`);
                console.log(`  描述: ${tx.description}`);
                console.log(`  時間: ${tx.created_at}`);
                console.log(`  交易前餘額: ${tx.before_balance}`);
                console.log(`  交易後餘額: ${tx.after_balance}`);
                
                // 如果是第二筆或以上的交易，標記為可疑
                if (i > 1 && tx.amount > 0 && tx.description.includes('中獎')) {
                    suspiciousTransactions.push(tx);
                    totalWinAmount += parseFloat(tx.amount);
                    duplicateWin = true;
                }
            }
        } else {
            console.log('未找到與注單ID 1417相關的交易');
            
            // 使用更廣泛的搜索
            console.log('\n=== 搜索所有中獎交易 ===');
            const winTransactions = await client.query(`
                SELECT id, user_id, user_type, amount, type, description, created_at,
                       before_balance, after_balance
                FROM transactions
                WHERE user_id = (SELECT id FROM members WHERE username = 'lala222')
                    AND user_type = 'member'
                    AND description LIKE '%中獎%'
                    AND amount > 0
                ORDER BY created_at DESC
                LIMIT 10
            `);
            
            if (winTransactions.rows.length > 0) {
                console.log(`找到 ${winTransactions.rows.length} 筆中獎交易`);
                
                // 收集中獎交易描述以識別重複的
                const winDescriptions = {};
                
                for (const tx of winTransactions.rows) {
                    console.log(`ID: ${tx.id}, 金額: ${tx.amount}`);
                    console.log(`描述: ${tx.description}`);
                    console.log(`時間: ${tx.created_at}`);
                    
                    // 提取期號和投注類型
                    const periodMatch = tx.description.match(/第(\d+)期/);
                    const typeMatch = tx.description.match(/(\w+):(\w+)/);
                    
                    if (periodMatch && typeMatch) {
                        const key = `${periodMatch[1]}-${typeMatch[1]}-${typeMatch[2]}`;
                        
                        if (!winDescriptions[key]) {
                            winDescriptions[key] = [];
                        }
                        
                        winDescriptions[key].push(tx);
                    }
                }
                
                // 檢查重複中獎交易
                console.log('\n=== 檢查重複中獎交易 ===');
                for (const [key, transactions] of Object.entries(winDescriptions)) {
                    if (transactions.length > 1) {
                        console.log(`發現重複中獎交易 (${key}):`);
                        transactions.forEach((tx, i) => {
                            console.log(`${i+1}. ID: ${tx.id}, 金額: ${tx.amount}, 時間: ${tx.created_at}`);
                            
                            // 第一筆以外都標記為可疑交易
                            if (i > 0) {
                                suspiciousTransactions.push(tx);
                                totalWinAmount += parseFloat(tx.amount);
                                duplicateWin = true;
                            }
                        });
                    }
                }
            }
        }
        
        // 4. 如果發現重複結算，計算正確的餘額
        if (duplicateWin) {
            console.log('\n=== 發現重複中獎 ===');
            console.log(`重複的中獎金額總計: ${totalWinAmount}`);
            
            // 計算正確的餘額
            const correctBalance = currentBalance - totalWinAmount;
            console.log(`當前餘額: ${currentBalance}`);
            console.log(`正確餘額應為: ${correctBalance}`);
            
            // 詢問是否修復
            console.log('\n您想要修復這個問題嗎？如果是，請解除下面代碼的註釋。');
            
            /*
            // 修復餘額
            await client.query(`
                UPDATE members 
                SET balance = $1 
                WHERE username = 'lala222'
            `, [correctBalance]);
            
            console.log(`✅ 已修復用戶 lala222 的餘額從 ${currentBalance} 改為 ${correctBalance}`);
            
            // 添加修復記錄
            const now = new Date();
            await client.query(`
                INSERT INTO transactions (
                    user_id, user_type, amount, type, description, 
                    before_balance, after_balance, created_at
                )
                VALUES (
                    (SELECT id FROM members WHERE username = 'lala222'),
                    'member',
                    $1,
                    'adjustment',
                    '修復重複結算問題，扣除重複獲得的中獎金額',
                    $2,
                    $3,
                    $4
                )
            `, [-totalWinAmount, currentBalance, correctBalance, now]);
            
            console.log(`✅ 已添加餘額調整記錄`);
            */
            
            // 標記可疑交易以便後續檢查
            if (suspiciousTransactions.length > 0) {
                console.log('\n可能需要刪除的重複交易:');
                suspiciousTransactions.forEach(tx => {
                    console.log(`- ID: ${tx.id}, 金額: ${tx.amount}, 時間: ${tx.created_at}`);
                    console.log(`  描述: ${tx.description}`);
                });
                
                /*
                // 刪除可疑交易
                for (const tx of suspiciousTransactions) {
                    await client.query(`DELETE FROM transactions WHERE id = $1`, [tx.id]);
                    console.log(`✅ 已刪除重複交易 ID: ${tx.id}`);
                }
                */
            }
        } else {
            console.log('\n未發現明確的重複中獎問題');
            
            // 檢查是否有異常的餘額增加
            if (currentBalance > 20000) {
                console.log('⚠️ 警告: 用戶餘額異常高，但未找到明確的重複中獎交易');
                console.log('建議進一步檢查交易記錄');
            }
        }
        
        // 5. 添加修復建議
        console.log('\n=== 修復建議 ===');
        console.log('1. 確保已修改 bet.js 中的 updateSettlement 方法，添加重複結算檢查');
        console.log('2. 重啟後端服務以應用修復');
        console.log('3. 添加監控系統以檢測用戶餘額異常');
        
    } catch (error) {
        console.error('修復過程中發生錯誤:', error.message);
    } finally {
        await client.end();
    }
}

fixLala222BalanceIssue();
