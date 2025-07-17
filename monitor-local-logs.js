import db from './db/config.js';

async function monitorLocalLogs() {
    console.log('=== 監控本地後端日誌 ===\n');
    console.log('請在另一個終端執行下注，然後觀察這裡的輸出\n');
    
    let lastBetId = 0;
    let lastTransactionId = 0;
    
    // 獲取最新ID
    const latestBet = await db.oneOrNone(`SELECT MAX(id) as max_id FROM bet_history`);
    if (latestBet?.max_id) lastBetId = latestBet.max_id;
    
    const latestTransaction = await db.oneOrNone(`
        SELECT MAX(id) as max_id FROM transaction_records 
        WHERE transaction_type = 'rebate'
    `);
    if (latestTransaction?.max_id) lastTransactionId = latestTransaction.max_id;
    
    console.log(`開始監控... (初始: 下注ID=${lastBetId}, 退水ID=${lastTransactionId})\n`);
    
    // 每2秒檢查一次
    setInterval(async () => {
        try {
            // 檢查新下注
            const newBets = await db.any(`
                SELECT * FROM bet_history 
                WHERE id > $1 
                ORDER BY id ASC
            `, [lastBetId]);
            
            if (newBets.length > 0) {
                console.log(`\n[${new Date().toLocaleTimeString()}] 🎲 發現新下注：`);
                newBets.forEach(bet => {
                    console.log(`  ID=${bet.id}, 用戶=${bet.username}, 期號=${bet.period}, 金額=${bet.amount}, 已結算=${bet.settled}`);
                    lastBetId = bet.id;
                });
            }
            
            // 檢查結算狀態變化
            const recentSettled = await db.any(`
                SELECT id, period, username, settled, settled_at 
                FROM bet_history 
                WHERE settled = true 
                AND settled_at > NOW() - INTERVAL '10 seconds'
                ORDER BY settled_at DESC
                LIMIT 5
            `);
            
            if (recentSettled.length > 0) {
                console.log(`\n[${new Date().toLocaleTimeString()}] ✅ 最近結算：`);
                recentSettled.forEach(bet => {
                    console.log(`  期號=${bet.period}, 用戶=${bet.username}, 結算時間=${new Date(bet.settled_at).toLocaleTimeString()}`);
                });
            }
            
            // 檢查新退水
            const newRebates = await db.any(`
                SELECT tr.*, a.username as agent_name
                FROM transaction_records tr
                JOIN agents a ON tr.user_id = a.id
                WHERE tr.id > $1 
                AND tr.transaction_type = 'rebate'
                ORDER BY tr.id ASC
            `, [lastTransactionId]);
            
            if (newRebates.length > 0) {
                console.log(`\n[${new Date().toLocaleTimeString()}] 💰 發現新退水：`);
                newRebates.forEach(rebate => {
                    console.log(`  ID=${rebate.id}, 代理=${rebate.agent_name}, 金額=${rebate.amount}, 期號=${rebate.period}`);
                    lastTransactionId = rebate.id;
                });
            }
            
        } catch (error) {
            console.error('監控錯誤:', error.message);
        }
    }, 2000);
}

// 優雅退出
process.on('SIGINT', () => {
    console.log('\n\n監控結束');
    process.exit(0);
});

monitorLocalLogs();