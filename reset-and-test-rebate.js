import db from './db/config.js';
import { enhancedSettlement } from './enhanced-settlement-system.js';

async function resetAndTestRebate() {
    try {
        console.log('=== 重置并测试退水分配 ===\n');

        // 选择一个最近的已开奖期号
        const testPeriod = '20250714546';
        
        // 1. 先将该期的注单重置为未结算
        console.log(`1. 重置期号 ${testPeriod} 的注单为未结算状态...`);
        const updateResult = await db.result(`
            UPDATE bet_history 
            SET settled = false, win = null, win_amount = null, settled_at = null
            WHERE period = $1
        `, [testPeriod]);
        
        console.log(`已重置 ${updateResult.rowCount} 笔注单\n`);

        // 2. 获取该期的开奖结果
        const drawResult = await db.oneOrNone(`
            SELECT * FROM result_history 
            WHERE period = $1
        `, [testPeriod]);

        if (!drawResult) {
            console.log(`期号 ${testPeriod} 没有开奖结果`);
            return;
        }

        console.log(`2. 开奖结果: ${drawResult.result}\n`);

        // 3. 检查注单状态
        const bets = await db.any(`
            SELECT * FROM bet_history 
            WHERE period = $1
        `, [testPeriod]);
        
        console.log(`3. 该期共有 ${bets.length} 笔注单`);
        for (const bet of bets) {
            console.log(`   - ID ${bet.id}: ${bet.username}, 金额 ${bet.amount}, 已结算: ${bet.settled}`);
        }

        // 4. 调用增强结算系统
        console.log('\n4. 开始结算并处理退水...\n');
        const result = await enhancedSettlement(testPeriod, {
            period: testPeriod,
            result: drawResult.result,
            drawnAt: new Date()
        });

        console.log('\n结算结果:', result);

        // 5. 检查退水记录
        console.log('\n\n5. 检查退水记录...');
        const rebateRecords = await db.any(`
            SELECT 
                tr.*,
                CASE 
                    WHEN tr.user_type = 'agent' THEN a.username
                END as username
            FROM transaction_records tr
            LEFT JOIN agents a ON tr.user_type = 'agent' AND tr.user_id = a.id
            WHERE tr.period = $1::text
                AND tr.transaction_type = 'rebate'
                AND tr.created_at >= NOW() - INTERVAL '1 minute'
            ORDER BY tr.created_at DESC
        `, [testPeriod]);

        if (rebateRecords.length > 0) {
            console.log(`找到 ${rebateRecords.length} 笔新的退水记录：`);
            for (const record of rebateRecords) {
                console.log(`\n代理: ${record.username}`);
                console.log(`金额: ${record.amount}`);
                console.log(`余额变化: ${record.balance_before} -> ${record.balance_after}`);
                console.log(`描述: ${record.description}`);
                console.log(`时间: ${record.created_at}`);
            }
        } else {
            console.log('没有找到新的退水记录');
        }

        // 6. 检查代理余额变化
        console.log('\n\n6. 检查代理余额...');
        const agents = await db.any(`
            SELECT username, balance, rebate_percentage
            FROM agents
            WHERE username IN ('justin2025A', 'ti2025A')
        `);

        for (const agent of agents) {
            console.log(`${agent.username}: 余额 ${agent.balance}, 退水率 ${agent.rebate_percentage}%`);
        }

    } catch (error) {
        console.error('错误:', error);
        console.error('错误详情:', error.stack);
    } finally {
        process.exit(0);
    }
}

resetAndTestRebate();