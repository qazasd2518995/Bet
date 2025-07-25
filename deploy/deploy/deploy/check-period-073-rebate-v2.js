import db from './db/config.js';

async function checkPeriod073Rebate() {
    try {
        console.log('=== 檢查期號 20250715073 的退水情況 ===\n');
        
        // 1. 檢查這期的下注記錄
        const bets = await db.any(`
            SELECT 
                id,
                username,
                amount,
                bet_type,
                bet_value,
                settled,
                result,
                payout,
                created_at
            FROM bet_history
            WHERE period = '20250715073'
            ORDER BY created_at DESC
        `);
        
        console.log(`期號 20250715073 共有 ${bets.length} 筆下注：`);
        bets.forEach(bet => {
            const winLoss = bet.payout > 0 ? bet.payout - bet.amount : -bet.amount;
            console.log(`- ${bet.username}: ${bet.amount}元, ${bet.bet_type}/${bet.bet_value}, ${bet.settled ? '已結算' : '未結算'}, 結果: ${bet.result || '待定'}, 輸贏: ${winLoss}`);
        });
        
        // 2. 檢查退水記錄
        console.log('\n檢查退水記錄：');
        const rebates = await db.any(`
            SELECT 
                tr.*,
                a.username as agent_name
            FROM transaction_records tr
            JOIN agents a ON tr.user_id = a.id
            WHERE tr.transaction_type = 'rebate'
            AND (tr.period = '20250715073' OR tr.period LIKE '%20250715073%')
            ORDER BY tr.created_at DESC
        `);
        
        if (rebates.length > 0) {
            console.log(`找到 ${rebates.length} 筆退水記錄：`);
            rebates.forEach(r => {
                console.log(`- ${r.agent_name}: ${r.amount}元, period: "${r.period}", 會員: ${r.member_username}`);
            });
        } else {
            console.log('❌ 沒有找到任何退水記錄');
        }
        
        // 3. 檢查是否有其他格式的退水記錄
        console.log('\n檢查其他可能的退水記錄格式：');
        const recentRebates = await db.any(`
            SELECT 
                tr.period,
                COUNT(*) as count,
                SUM(tr.amount) as total
            FROM transaction_records tr
            WHERE tr.transaction_type = 'rebate'
            AND tr.created_at > NOW() - INTERVAL '1 hour'
            GROUP BY tr.period
            ORDER BY tr.period DESC
            LIMIT 10
        `);
        
        console.log('最近1小時的退水記錄：');
        recentRebates.forEach(r => {
            console.log(`- period: "${r.period}", ${r.count}筆, 總額: ${r.total}`);
        });
        
        // 4. 手動觸發這期的退水
        console.log('\n嘗試手動觸發退水...');
        const drawResult = await db.oneOrNone(`
            SELECT * FROM result_history
            WHERE period = '20250715073'
        `);
        
        if (drawResult) {
            console.log('✅ 找到開獎結果');
            
            // 檢查是否需要處理退水
            const needRebate = await db.oneOrNone(`
                SELECT COUNT(*) as count
                FROM bet_history
                WHERE period = '20250715073'
                AND settled = true
                AND NOT EXISTS (
                    SELECT 1 FROM transaction_records
                    WHERE transaction_type = 'rebate'
                    AND period = '20250715073'
                )
            `);
            
            if (needRebate && needRebate.count > 0) {
                console.log(`需要處理 ${needRebate.count} 筆下注的退水`);
                
                // 導入並執行結算
                const { enhancedSettlement } = await import('./enhanced-settlement-system.js');
                const winResult = {
                    positions: [
                        drawResult.position_1,
                        drawResult.position_2,
                        drawResult.position_3,
                        drawResult.position_4,
                        drawResult.position_5,
                        drawResult.position_6,
                        drawResult.position_7,
                        drawResult.position_8,
                        drawResult.position_9,
                        drawResult.position_10
                    ]
                };
                
                console.log('調用結算系統...');
                const result = await enhancedSettlement('20250715073', winResult);
                console.log('結算結果:', result);
                
                // 再次檢查退水
                const newRebates = await db.any(`
                    SELECT 
                        tr.*,
                        a.username as agent_name
                    FROM transaction_records tr
                    JOIN agents a ON tr.user_id = a.id
                    WHERE tr.transaction_type = 'rebate'
                    AND tr.period = '20250715073'
                    ORDER BY tr.created_at DESC
                `);
                
                if (newRebates.length > 0) {
                    console.log(`\n✅ 成功產生 ${newRebates.length} 筆退水：`);
                    newRebates.forEach(r => {
                        console.log(`- ${r.agent_name}: ${r.amount}元`);
                    });
                }
            }
        } else {
            console.log('❌ 沒有找到開獎結果');
        }
        
        // 5. 檢查代理餘額變化
        console.log('\n檢查代理餘額：');
        const agents = await db.any(`
            SELECT username, balance
            FROM agents
            WHERE username IN ('justin2025A', 'ti2025A')
            ORDER BY username
        `);
        
        agents.forEach(a => {
            console.log(`${a.username}: ${a.balance}元`);
        });
        
    } catch (error) {
        console.error('檢查錯誤:', error);
    } finally {
        process.exit(0);
    }
}

checkPeriod073Rebate();