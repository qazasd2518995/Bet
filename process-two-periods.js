import { enhancedSettlement } from './enhanced-settlement-system.js';
import db from './db/config.js';

async function processTwoPeriods() {
    try {
        const periods = ['20250715058', '20250715059'];
        
        for (const period of periods) {
            console.log(`\n=== 处理期号 ${period} ===`);
            
            // 获取开奖结果
            const drawResult = await db.oneOrNone(`
                SELECT * FROM result_history 
                WHERE period = $1
            `, [period]);
            
            if (!drawResult) {
                console.log('找不到开奖结果');
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
            
            console.log('开奖结果:', winResult.positions);
            console.log('调用结算系统...');
            
            const result = await enhancedSettlement(period, winResult);
            console.log('结算结果:', result);
            
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // 检查余额
        const agents = await db.any(`
            SELECT username, balance FROM agents
            WHERE username IN ('justin2025A', 'ti2025A')
        `);
        
        console.log('\n=== 代理余额 ===');
        agents.forEach(a => {
            console.log(`${a.username}: ${a.balance}`);
        });
        
        // 检查退水记录
        const rebates = await db.any(`
            SELECT COUNT(*) as count, SUM(amount) as total
            FROM transaction_records
            WHERE transaction_type = 'rebate'
            AND created_at > NOW() - INTERVAL '2 minutes'
        `);
        
        console.log(`\n新增退水记录: ${rebates[0].count} 笔, 总金额: ${rebates[0].total || 0}`);
        
    } catch (error) {
        console.error('错误:', error);
    } finally {
        process.exit(0);
    }
}

processTwoPeriods();