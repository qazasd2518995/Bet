import { enhancedSettlement } from './enhanced-settlement-system.js';
import db from './db/config.js';

async function processRecentMissingRebates() {
    try {
        console.log('=== 寻找最近30分钟内需要处理退水的期号 ===\n');
        
        // 找出最近30分钟内已结算但没有退水的下注
        const missingRebates = await db.any(`
            SELECT DISTINCT 
                bh.period,
                COUNT(DISTINCT bh.id) as bet_count,
                SUM(bh.amount) as total_amount,
                MAX(bh.created_at) as latest_bet_time
            FROM bet_history bh
            WHERE bh.settled = true
            AND bh.created_at > NOW() - INTERVAL '30 minutes'
            AND NOT EXISTS (
                SELECT 1 
                FROM transaction_records tr 
                WHERE tr.transaction_type = 'rebate' 
                AND tr.period = bh.period::text
            )
            GROUP BY bh.period
            ORDER BY bh.period DESC
        `);
        
        console.log(`找到 ${missingRebates.length} 个期号需要处理退水`);
        
        for (const item of missingRebates) {
            console.log(`\n=== 处理期号 ${item.period} ===`);
            console.log(`下注数: ${item.bet_count}, 总金额: ${item.total_amount}`);
            console.log(`最后下注时间: ${item.latest_bet_time}`);
            
            // 获取开奖结果
            const drawResult = await db.oneOrNone(`
                SELECT * FROM result_history 
                WHERE period = $1
            `, [item.period]);
            
            if (!drawResult) {
                console.log(`❌ 期号 ${item.period} 找不到开奖结果，跳过`);
                continue;
            }
            
            // 构建结果物件
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
            
            console.log('开奖结果:', winResult.positions.join(', '));
            
            // 调用结算系统处理退水
            console.log('呼叫结算系统...');
            const result = await enhancedSettlement(item.period, winResult);
            console.log('结算结果:', result);
            
            // 检查退水是否成功
            const newRebates = await db.any(`
                SELECT 
                    tr.amount,
                    a.username as agent_name,
                    tr.rebate_percentage
                FROM transaction_records tr
                JOIN agents a ON tr.user_id = a.id
                WHERE tr.transaction_type = 'rebate'
                AND tr.period = $1
                ORDER BY tr.created_at DESC
            `, [item.period]);
            
            if (newRebates.length > 0) {
                console.log(`✅ 成功新增 ${newRebates.length} 笔退水记录:`);
                newRebates.forEach(r => {
                    console.log(`   ${r.agent_name}: ${r.amount} 元 (${(r.rebate_percentage * 100).toFixed(1)}%)`);
                });
            } else {
                console.log('❌ 没有新增退水记录');
            }
            
            // 等待一下避免太快
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // 显示摘要
        console.log('\n=== 处理摘要 ===');
        const summary = await db.any(`
            SELECT 
                a.username,
                COUNT(tr.id) as rebate_count,
                SUM(tr.amount) as total_rebate
            FROM agents a
            LEFT JOIN transaction_records tr ON 
                tr.user_id = a.id 
                AND tr.transaction_type = 'rebate'
                AND tr.created_at > NOW() - INTERVAL '5 minutes'
            WHERE a.username IN ('justin2025A', 'ti2025A')
            GROUP BY a.username
        `);
        
        summary.forEach(s => {
            console.log(`${s.username}: ${s.rebate_count || 0} 笔新退水, 总额 ${s.total_rebate || 0} 元`);
        });
        
        // 显示最终余额
        console.log('\n=== 代理最终余额 ===');
        const agents = await db.any(`
            SELECT username, balance FROM agents
            WHERE username IN ('justin2025A', 'ti2025A')
            ORDER BY username
        `);
        
        agents.forEach(a => {
            console.log(`${a.username}: ${a.balance} 元`);
        });
        
    } catch (error) {
        console.error('处理时发生错误:', error);
    } finally {
        process.exit(0);
    }
}

processRecentMissingRebates();