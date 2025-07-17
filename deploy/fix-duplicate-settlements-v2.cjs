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

async function checkAndFixDuplicateSettlements() {
    const client = new Client(dbConfig);
    
    try {
        await client.connect();
        console.log('✅ 連接到 Render PostgreSQL 成功');
        
        // 檢查交易記錄表結構
        const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        
        console.log(`\n=== 數據庫表結構 ===`);
        const tables = tablesResult.rows.map(row => row.table_name);
        console.log(tables.join(', '));
        
        // 檢查交易記錄表
        if (tables.includes('transaction_records') || tables.includes('transactions')) {
            const transactionTable = tables.includes('transaction_records') ? 'transaction_records' : 'transactions';
            console.log(`\n使用交易記錄表: ${transactionTable}`);
            
            // 獲取交易記錄表結構
            const transactionColumns = await client.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = '${transactionTable}'
            `);
            
            console.log(`\n=== ${transactionTable} 表欄位 ===`);
            const columns = transactionColumns.rows.map(row => row.column_name);
            console.log(columns.join(', '));
            
            // 確定用戶名欄位
            const usernameField = columns.includes('username') ? 'username' : 
                                  columns.includes('member_name') ? 'member_name' : 'user_id';
            
            // 確定描述欄位
            const descriptionField = columns.includes('description') ? 'description' : 
                                    columns.includes('remarks') ? 'remarks' : 'memo';
            
            // 查詢可能的重複交易
            const duplicateCheckQuery = `
                SELECT t1.id as id1, t2.id as id2, 
                       t1.${usernameField}, t1.amount, 
                       t1.${descriptionField}, t1.created_at
                FROM ${transactionTable} t1
                JOIN ${transactionTable} t2 ON 
                    t1.${usernameField} = t2.${usernameField} AND
                    t1.amount = t2.amount AND
                    t1.${descriptionField} = t2.${descriptionField} AND
                    t1.id < t2.id AND
                    t1.created_at > NOW() - INTERVAL '24 hours' AND
                    t2.created_at > NOW() - INTERVAL '24 hours' AND
                    t1.created_at <= t2.created_at + INTERVAL '1 minute'
                ORDER BY t1.created_at DESC
            `;
            
            const duplicateResult = await client.query(duplicateCheckQuery);
            
            console.log(`\n=== 檢測到的可能重複交易 ===`);
            console.log(`找到 ${duplicateResult.rows.length} 組可能的重複交易`);
            
            if (duplicateResult.rows.length > 0) {
                // 顯示詳細信息
                for (const dup of duplicateResult.rows) {
                    console.log(`\n重複交易組：`);
                    console.log(`  交易1 ID: ${dup.id1}`);
                    console.log(`  交易2 ID: ${dup.id2}`);
                    console.log(`  用戶: ${dup[usernameField]}`);
                    console.log(`  金額: ${dup.amount}`);
                    console.log(`  描述: ${dup[descriptionField]}`);
                    console.log(`  時間: ${dup.created_at}`);
                    
                    // 提供修復選項
                    console.log(`  推薦操作: 刪除交易ID ${dup.id2} (較新的重複交易)`);
                }
                
                console.log(`\n要修復這些重複交易，請執行以下SQL(請先備份數據!)：`);
                for (const dup of duplicateResult.rows) {
                    console.log(`DELETE FROM ${transactionTable} WHERE id = ${dup.id2};`);
                }
            } else {
                console.log(`沒有發現可能的重複交易，系統運行正常。`);
            }
        } else {
            console.log(`\n⚠️ 找不到交易記錄表！`);
        }
        
        // 檢查 bet_history 表中已結算的注單
        if (tables.includes('bet_history')) {
            console.log(`\n=== 檢查注單結算狀態 ===`);
            
            // 獲取 bet_history 表結構
            const betColumns = await client.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'bet_history'
            `);
            
            const betCols = betColumns.rows.map(row => row.column_name);
            const settledField = betCols.includes('settled') ? 'settled' : 'is_settled';
            
            // 查詢最近24小時的已結算注單
            const recentSettledQuery = `
                SELECT id, username, period, bet_type, bet_value, position, amount, win_amount, ${settledField}, created_at
                FROM bet_history
                WHERE ${settledField} = true
                AND created_at > NOW() - INTERVAL '24 hours'
                ORDER BY created_at DESC
            `;
            
            const settledResult = await client.query(recentSettledQuery);
            
            console.log(`最近24小時內有 ${settledResult.rows.length} 筆已結算注單`);
            
            // 按用戶和期數分組檢查異常
            const betsByUserAndPeriod = {};
            settledResult.rows.forEach(bet => {
                const key = `${bet.username}_${bet.period}_${bet.bet_type}_${bet.bet_value}_${bet.position}`;
                if (!betsByUserAndPeriod[key]) {
                    betsByUserAndPeriod[key] = [];
                }
                betsByUserAndPeriod[key].push(bet);
            });
            
            console.log(`\n=== 檢查異常結算 ===`);
            let abnormalCount = 0;
            
            for (const [key, bets] of Object.entries(betsByUserAndPeriod)) {
                // 如果同一用戶在同一期內相同類型和值的注單有多筆，可能存在異常
                if (bets.length > 1) {
                    const totalWinAmount = bets.reduce((sum, bet) => sum + parseFloat(bet.win_amount || 0), 0);
                    const totalBetAmount = bets.reduce((sum, bet) => sum + parseFloat(bet.amount || 0), 0);
                    
                    // 如果總贏額與總下注額比例異常，可能存在重複結算
                    const winRatio = totalWinAmount / totalBetAmount;
                    
                    if (winRatio > 20) { // 贏額超過下注額20倍，可能有問題
                        abnormalCount++;
                        console.log(`\n可能的異常結算：`);
                        console.log(`  用戶: ${bets[0].username}`);
                        console.log(`  期數: ${bets[0].period}`);
                        console.log(`  注單數: ${bets.length}`);
                        console.log(`  總下注額: ${totalBetAmount}`);
                        console.log(`  總贏額: ${totalWinAmount}`);
                        console.log(`  贏率: ${winRatio.toFixed(2)}倍`);
                        
                        bets.forEach(bet => {
                            console.log(`  - ID: ${bet.id}, 下注額: ${bet.amount}, 贏額: ${bet.win_amount}, 時間: ${bet.created_at}`);
                        });
                    }
                }
            }
            
            if (abnormalCount === 0) {
                console.log(`沒有發現異常的注單結算。`);
            } else {
                console.log(`\n發現 ${abnormalCount} 組可能的異常結算，請檢查並修復。`);
            }
        }
        
        // 提供後端優化建議
        console.log(`\n=== 後端代碼優化建議 ===`);
        console.log(`1. 已修改 BetModel.updateSettlement 方法，增加檢查邏輯防止重複結算`);
        console.log(`2. 建議在 settleBets 函數中添加事務處理，確保批量結算的原子性`);
        console.log(`3. 考慮添加分佈式鎖或標記機制，確保同一期號的開獎和結算只執行一次`);
        console.log(`4. 在會員和代理的餘額變更操作中，添加更詳細的日誌記錄，便於問題追蹤`);
        console.log(`5. 定期運行自動化檢查腳本，及時發現並修復異常數據`);
        
    } catch (error) {
        console.error('檢查和修復時發生錯誤:', error.message);
    } finally {
        await client.end();
    }
}

checkAndFixDuplicateSettlements();
