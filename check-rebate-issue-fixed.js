// 检查退水问题 - 修正版
import db from './db/config.js';

async function checkRebateIssue() {
    console.log('🔍 检查退水问题...\n');
    
    try {
        // 1. 检查会员代理关系
        console.log('=== 1. 检查 justin111 的代理关系 ===');
        const memberInfo = await db.oneOrNone(`
            SELECT 
                m.username,
                m.agent_id,
                a.username as agent_username,
                a.level as agent_level,
                a.rebate_percentage,
                a.market_type,
                a.balance as agent_balance
            FROM members m
            JOIN agents a ON m.agent_id = a.id
            WHERE m.username = 'justin111'
        `);
        
        if (memberInfo) {
            console.log(`会员: ${memberInfo.username}`);
            console.log(`直属代理: ${memberInfo.agent_username} (ID: ${memberInfo.agent_id})`);
            console.log(`代理层级: ${memberInfo.agent_level}`);
            console.log(`代理退水: ${(parseFloat(memberInfo.rebate_percentage) * 100).toFixed(1)}%`);
            console.log(`盘口类型: ${memberInfo.market_type}`);
            console.log(`代理余额: ${memberInfo.agent_balance}`);
            
            // 检查为什么退水比例只有 0.5%
            if (memberInfo.market_type === 'A' && parseFloat(memberInfo.rebate_percentage) < 0.011) {
                console.log('\n❗ 问题发现: A盘代理退水比例只有 0.5%，应该至少有 1.1%');
            }
        }
        
        // 2. 检查最近结算的期号是否有处理退水
        console.log('\n=== 2. 检查最近结算期号的退水处理 ===');
        const recentSettledBets = await db.any(`
            SELECT 
                DISTINCT period,
                COUNT(*) as bet_count,
                SUM(amount) as total_amount
            FROM bet_history 
            WHERE username = 'justin111' 
            AND settled = true
            AND created_at > NOW() - INTERVAL '24 hours'
            GROUP BY period
            ORDER BY period DESC
            LIMIT 5
        `);
        
        console.log(`最近24小时内 justin111 的已结算期号:`);
        for (const record of recentSettledBets) {
            console.log(`期号: ${record.period}, 注单数: ${record.bet_count}, 总金额: ${record.total_amount}`);
            
            // 检查这期是否有退水记录
            const rebateRecord = await db.oneOrNone(`
                SELECT * FROM transaction_records 
                WHERE transaction_type = 'rebate' 
                AND reason LIKE '%${record.period}%'
                AND agent_username = 'justin2025A'
                LIMIT 1
            `);
            
            if (rebateRecord) {
                console.log(`  ✅ 找到退水记录: ${rebateRecord.rebate_amount}元`);
            } else {
                console.log(`  ❌ 没有找到退水记录`);
            }
        }
        
        // 3. 计算预期的退水金额
        console.log('\n=== 3. 计算预期的退水金额 ===');
        if (memberInfo && memberInfo.market_type === 'A') {
            const betAmount = 1000;
            const expectedRebatePool = betAmount * 0.011; // A盘 1.1%
            const agentRebatePercentage = parseFloat(memberInfo.rebate_percentage);
            const expectedAgentRebate = betAmount * agentRebatePercentage;
            
            console.log(`下注金额: ${betAmount}元`);
            console.log(`A盘退水池: ${expectedRebatePool.toFixed(2)}元 (1.1%)`);
            console.log(`代理退水比例: ${(agentRebatePercentage * 100).toFixed(1)}%`);
            console.log(`代理应得退水: ${expectedAgentRebate.toFixed(2)}元`);
            
            if (agentRebatePercentage < 0.011) {
                console.log(`\n❗ 问题: 代理退水比例(${(agentRebatePercentage * 100).toFixed(1)}%)低于A盘标准(1.1%)`);
                console.log(`这表示代理只能拿到部分退水，上级代理会拿到差额`);
            }
        }
        
        // 4. 检查退水是否在结算时被调用
        console.log('\n=== 4. 诊断结果 ===');
        console.log('发现的问题:');
        console.log('1. justin2025A 的退水比例只有 0.5%，而不是 A盘标准的 1.1%');
        console.log('2. 这表示 justin2025A 只能获得下注金额的 0.5% 作为退水');
        console.log('3. 剩余的 0.6% (1.1% - 0.5%) 会分配给上级代理');
        console.log('\n解决方案:');
        console.log('1. 如果要让 justin2025A 获得全部退水，需要将其退水比例设置为 1.1%');
        console.log('2. 或者检查上级代理是否收到了剩余的 0.6% 退水');
        
        // 5. 查找 justin2025A 的上级代理
        console.log('\n=== 5. 检查代理链 ===');
        const agentChain = await db.any(`
            WITH RECURSIVE agent_tree AS (
                SELECT id, username, parent_id, level, rebate_percentage, market_type, 0 as depth
                FROM agents WHERE username = 'justin2025A'
                
                UNION ALL
                
                SELECT a.id, a.username, a.parent_id, a.level, a.rebate_percentage, a.market_type, at.depth + 1
                FROM agents a
                JOIN agent_tree at ON a.id = at.parent_id
            )
            SELECT * FROM agent_tree ORDER BY depth
        `);
        
        console.log('代理链:');
        agentChain.forEach(agent => {
            const indent = '  '.repeat(agent.depth);
            console.log(`${indent}${agent.username} (L${agent.level}, ${(parseFloat(agent.rebate_percentage) * 100).toFixed(1)}%)`);
        });
        
    } catch (error) {
        console.error('检查时发生错误:', error);
    } finally {
        process.exit(0);
    }
}

checkRebateIssue();