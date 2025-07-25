import db from './db/config.js';
import { enhancedSettlement } from './enhanced-settlement-system.js';

async function process073Rebate() {
    try {
        console.log('=== 處理期號 20250715073 的退水 ===\n');
        
        // 1. 確認下注資訊
        const bet = await db.oneOrNone(`
            SELECT * FROM bet_history
            WHERE period = '20250715073'
            AND username = 'justin111'
        `);
        
        if (bet) {
            console.log('找到下注記錄：');
            console.log(`- 用戶: ${bet.username}`);
            console.log(`- 金額: ${bet.amount}`);
            console.log(`- 類型: ${bet.bet_type}/${bet.bet_value}`);
            console.log(`- 已結算: ${bet.settled}`);
            console.log(`- 贏: ${bet.win}`);
            console.log(`- 派彩: ${bet.win_amount}`);
        }
        
        // 2. 檢查是否已有退水
        const existingRebates = await db.any(`
            SELECT * FROM transaction_records
            WHERE transaction_type = 'rebate'
            AND period = '20250715073'
        `);
        
        if (existingRebates.length > 0) {
            console.log('\n已有退水記錄，不需要重複處理');
            return;
        }
        
        // 3. 獲取開獎結果
        const drawResult = await db.oneOrNone(`
            SELECT * FROM result_history
            WHERE period = '20250715073'
        `);
        
        if (!drawResult) {
            console.log('\n❌ 找不到開獎結果');
            return;
        }
        
        // 4. 調用結算系統處理退水
        console.log('\n調用結算系統處理退水...');
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
        
        console.log('開獎號碼:', winResult.positions.join(', '));
        console.log(`亞軍(第2名): ${drawResult.position_2}`);
        
        const result = await enhancedSettlement('20250715073', winResult);
        console.log('\n結算結果:', result);
        
        // 5. 檢查退水結果
        const newRebates = await db.any(`
            SELECT 
                tr.*,
                a.username as agent_name,
                a.rebate_percentage as agent_rebate
            FROM transaction_records tr
            JOIN agents a ON tr.user_id = a.id
            WHERE tr.transaction_type = 'rebate'
            AND tr.period = '20250715073'
            ORDER BY tr.amount DESC
        `);
        
        if (newRebates.length > 0) {
            console.log('\n✅ 成功產生退水記錄：');
            let totalRebate = 0;
            newRebates.forEach(r => {
                console.log(`- ${r.agent_name}: ${r.amount}元 (退水比例: ${(r.agent_rebate * 100).toFixed(1)}%)`);
                totalRebate += parseFloat(r.amount);
            });
            console.log(`總退水金額: ${totalRebate}元`);
            
            // 驗證計算
            const expectedTotal = parseFloat(bet.amount) * 0.011; // A盤總退水 1.1%
            console.log(`\n驗證: 下注${bet.amount}元 × 1.1% = ${expectedTotal}元`);
            if (Math.abs(totalRebate - expectedTotal) < 0.01) {
                console.log('✅ 退水計算正確');
            } else {
                console.log('❌ 退水計算可能有誤差');
            }
        } else {
            console.log('\n❌ 沒有產生新的退水記錄');
        }
        
        // 6. 顯示代理最新餘額
        console.log('\n=== 代理最新餘額 ===');
        const agents = await db.any(`
            SELECT username, balance FROM agents
            WHERE username IN ('justin2025A', 'ti2025A')
            ORDER BY username
        `);
        
        agents.forEach(a => {
            console.log(`${a.username}: ${a.balance}元`);
        });
        
    } catch (error) {
        console.error('處理錯誤:', error);
    } finally {
        process.exit(0);
    }
}

process073Rebate();