import db from './db/config.js';

async function checkPeriod073() {
    try {
        console.log('=== 检查期号 20250715073 ===\n');
        
        // 1. 简单检查下注记录
        const bets = await db.any(`
            SELECT * FROM bet_history
            WHERE period = '20250715073'
            LIMIT 5
        `);
        
        console.log(`找到 ${bets.length} 笔下注记录`);
        if (bets.length > 0) {
            console.log('第一笔记录:', JSON.stringify(bets[0], null, 2));
        }
        
        // 2. 检查退水记录
        console.log('\n=== 检查退水记录 ===');
        const rebates = await db.any(`
            SELECT * FROM transaction_records
            WHERE transaction_type = 'rebate'
            AND (period = '20250715073' OR period LIKE '%073%')
            ORDER BY created_at DESC
            LIMIT 10
        `);
        
        console.log(`找到 ${rebates.length} 笔退水记录`);
        rebates.forEach(r => {
            console.log(`- period: "${r.period}", amount: ${r.amount}, user_id: ${r.user_id}`);
        });
        
        // 3. 检查最近的退水记录格式
        console.log('\n=== 最近的退水记录 ===');
        const recentRebates = await db.any(`
            SELECT DISTINCT period, COUNT(*) as count
            FROM transaction_records
            WHERE transaction_type = 'rebate'
            AND created_at > NOW() - INTERVAL '2 hours'
            GROUP BY period
            ORDER BY created_at DESC
            LIMIT 10
        `);
        
        recentRebates.forEach(r => {
            console.log(`- "${r.period}" : ${r.count} 笔`);
        });
        
        // 4. 尝试手动处理退水
        console.log('\n=== 尝试手动处理退水 ===');
        
        // 检查是否已结算
        const settledBets = await db.any(`
            SELECT username, SUM(amount) as total_amount
            FROM bet_history
            WHERE period = '20250715073'
            AND settled = true
            GROUP BY username
        `);
        
        if (settledBets.length > 0) {
            console.log('已结算的下注：');
            settledBets.forEach(b => {
                console.log(`- ${b.username}: ${b.total_amount}元`);
            });
            
            // 检查是否有开奖结果
            const hasResult = await db.oneOrNone(`
                SELECT COUNT(*) as count FROM result_history
                WHERE period = '20250715073'
            `);
            
            if (hasResult && hasResult.count > 0) {
                console.log('\n✅ 有开奖结果，准备处理退水...');
                
                // 导入结算系统
                const { enhancedSettlement } = await import('./enhanced-settlement-system.js');
                const drawResult = await db.oneOrNone(`
                    SELECT * FROM result_history WHERE period = '20250715073'
                `);
                
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
                console.log('\n调用结算系统...');
                const result = await enhancedSettlement('20250715073', winResult);
                console.log('结算结果:', result);
                
                // 检查新的退水
                const newRebates = await db.any(`
                    SELECT tr.*, a.username as agent_name
                    FROM transaction_records tr
                    JOIN agents a ON tr.user_id = a.id
                    WHERE tr.transaction_type = 'rebate'
                    AND tr.period = '20250715073'
                `);
                
                if (newRebates.length > 0) {
                    console.log('\n✅ 成功产生退水：');
                    newRebates.forEach(r => {
                        console.log(`- ${r.agent_name}: ${r.amount}元`);
                    });
                }
            } else {
                console.log('\n❌ 没有开奖结果');
            }
        } else {
            console.log('❌ 没有已结算的下注');
        }
        
    } catch (error) {
        console.error('错误:', error);
    } finally {
        process.exit(0);
    }
}

checkPeriod073();