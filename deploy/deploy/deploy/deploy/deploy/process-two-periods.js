import { enhancedSettlement } from './enhanced-settlement-system.js';
import db from './db/config.js';

async function processTwoPeriods() {
    try {
        const periods = ['20250715058', '20250715059'];
        
        for (const period of periods) {
            console.log(`\n=== 處理期號 ${period} ===`);
            
            // 獲取開獎結果
            const drawResult = await db.oneOrNone(`
                SELECT * FROM result_history 
                WHERE period = $1
            `, [period]);
            
            if (!drawResult) {
                console.log('找不到開獎結果');
                continue;
            }
            
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
            
            console.log('開獎結果:', winResult.positions);
            console.log('調用結算系統...');
            
            const result = await enhancedSettlement(period, winResult);
            console.log('結算結果:', result);
            
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // 檢查餘額
        const agents = await db.any(`
            SELECT username, balance FROM agents
            WHERE username IN ('justin2025A', 'ti2025A')
        `);
        
        console.log('\n=== 代理餘額 ===');
        agents.forEach(a => {
            console.log(`${a.username}: ${a.balance}`);
        });
        
        // 檢查退水記錄
        const rebates = await db.any(`
            SELECT COUNT(*) as count, SUM(amount) as total
            FROM transaction_records
            WHERE transaction_type = 'rebate'
            AND created_at > NOW() - INTERVAL '2 minutes'
        `);
        
        console.log(`\n新增退水記錄: ${rebates[0].count} 筆, 總金額: ${rebates[0].total || 0}`);
        
    } catch (error) {
        console.error('錯誤:', error);
    } finally {
        process.exit(0);
    }
}

processTwoPeriods();