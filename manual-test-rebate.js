import db from './db/config.js';
import { enhancedSettlement } from './enhanced-settlement-system.js';

async function manualTestRebate() {
    try {
        console.log('=== 手动测试退水分配 ===\n');

        // 选择一个最近的已开奖期号
        const testPeriod = '20250714546';
        
        // 获取该期的开奖结果
        const drawResult = await db.oneOrNone(`
            SELECT * FROM result_history 
            WHERE period = $1
        `, [testPeriod]);

        if (!drawResult) {
            console.log(`期号 ${testPeriod} 没有开奖结果`);
            return;
        }

        console.log(`测试期号: ${testPeriod}`);
        console.log(`开奖结果: ${drawResult.result}\n`);

        // 先检查该期是否有未结算的注单
        const unsettledBets = await db.any(`
            SELECT * FROM bet_history 
            WHERE period = $1 AND settled = false
        `, [testPeriod]);

        if (unsettledBets.length > 0) {
            console.log(`发现 ${unsettledBets.length} 笔未结算注单，将进行结算...`);
            
            // 将注单标记为未结算以便测试
            await db.none(`
                UPDATE bet_history 
                SET settled = false, win = null, win_amount = null, settled_at = null
                WHERE period = $1
            `, [testPeriod]);
            
            console.log('已将注单重置为未结算状态\n');
        }

        // 调用增强结算系统
        console.log('开始结算并处理退水...\n');
        const result = await enhancedSettlement(testPeriod, {
            period: testPeriod,
            result: drawResult.result,
            drawnAt: new Date()
        });

        console.log('\n结算结果:', result);

        // 检查退水记录
        console.log('\n\n=== 检查退水记录 ===');
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
            ORDER BY tr.created_at DESC
        `, [testPeriod]);

        if (rebateRecords.length > 0) {
            console.log(`找到 ${rebateRecords.length} 笔退水记录：`);
            for (const record of rebateRecords) {
                console.log(`\n代理: ${record.username}`);
                console.log(`金额: ${record.amount}`);
                console.log(`余额变化: ${record.balance_before} -> ${record.balance_after}`);
                console.log(`描述: ${record.description}`);
                console.log(`时间: ${record.created_at}`);
            }
        } else {
            console.log('没有找到退水记录');
        }

        // 检查代理余额
        console.log('\n\n=== 检查代理余额 ===');
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
    } finally {
        process.exit(0);
    }
}

manualTestRebate();