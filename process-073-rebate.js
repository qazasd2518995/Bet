import db from './db/config.js';
import { enhancedSettlement } from './enhanced-settlement-system.js';

async function process073Rebate() {
    try {
        console.log('=== 处理期号 20250715073 的退水 ===\n');
        
        // 1. 确认下注资讯
        const bet = await db.oneOrNone(`
            SELECT * FROM bet_history
            WHERE period = '20250715073'
            AND username = 'justin111'
        `);
        
        if (bet) {
            console.log('找到下注记录：');
            console.log(`- 用户: ${bet.username}`);
            console.log(`- 金额: ${bet.amount}`);
            console.log(`- 类型: ${bet.bet_type}/${bet.bet_value}`);
            console.log(`- 已结算: ${bet.settled}`);
            console.log(`- 赢: ${bet.win}`);
            console.log(`- 派彩: ${bet.win_amount}`);
        }
        
        // 2. 检查是否已有退水
        const existingRebates = await db.any(`
            SELECT * FROM transaction_records
            WHERE transaction_type = 'rebate'
            AND period = '20250715073'
        `);
        
        if (existingRebates.length > 0) {
            console.log('\n已有退水记录，不需要重复处理');
            return;
        }
        
        // 3. 获取开奖结果
        const drawResult = await db.oneOrNone(`
            SELECT * FROM result_history
            WHERE period = '20250715073'
        `);
        
        if (!drawResult) {
            console.log('\n❌ 找不到开奖结果');
            return;
        }
        
        // 4. 调用结算系统处理退水
        console.log('\n调用结算系统处理退水...');
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
        
        console.log('开奖号码:', winResult.positions.join(', '));
        console.log(`亚军(第2名): ${drawResult.position_2}`);
        
        const result = await enhancedSettlement('20250715073', winResult);
        console.log('\n结算结果:', result);
        
        // 5. 检查退水结果
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
            console.log('\n✅ 成功产生退水记录：');
            let totalRebate = 0;
            newRebates.forEach(r => {
                console.log(`- ${r.agent_name}: ${r.amount}元 (退水比例: ${(r.agent_rebate * 100).toFixed(1)}%)`);
                totalRebate += parseFloat(r.amount);
            });
            console.log(`总退水金额: ${totalRebate}元`);
            
            // 验证计算
            const expectedTotal = parseFloat(bet.amount) * 0.011; // A盘总退水 1.1%
            console.log(`\n验证: 下注${bet.amount}元 × 1.1% = ${expectedTotal}元`);
            if (Math.abs(totalRebate - expectedTotal) < 0.01) {
                console.log('✅ 退水计算正确');
            } else {
                console.log('❌ 退水计算可能有误差');
            }
        } else {
            console.log('\n❌ 没有产生新的退水记录');
        }
        
        // 6. 显示代理最新余额
        console.log('\n=== 代理最新余额 ===');
        const agents = await db.any(`
            SELECT username, balance FROM agents
            WHERE username IN ('justin2025A', 'ti2025A')
            ORDER BY username
        `);
        
        agents.forEach(a => {
            console.log(`${a.username}: ${a.balance}元`);
        });
        
    } catch (error) {
        console.error('处理错误:', error);
    } finally {
        process.exit(0);
    }
}

process073Rebate();