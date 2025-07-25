// 测试新的退水系统
import db from './db/config.js';

async function testNewRebateSystem() {
    console.log('========================================');
    console.log('🧪 测试新退水系统');
    console.log('========================================\n');
    
    try {
        // 1. 查找测试数据
        console.log('1️⃣ 查找测试代理链...');
        const testMember = await db.oneOrNone(`
            SELECT m.*, a.username as agent_username, a.market_type 
            FROM members m 
            JOIN agents a ON m.agent_id = a.id 
            ORDER BY m.created_at DESC
            LIMIT 1
        `);
        
        if (!testMember) {
            console.log('❌ 找不到任何会员');
            return;
        }
        
        console.log(`✓ 找到测试会员: ${testMember.username}`);
        console.log(`  代理: ${testMember.agent_username} (${testMember.market_type}盘)`);
        
        // 2. 获取完整代理链
        console.log('\n2️⃣ 获取代理链...');
        const agentChain = await db.any(`
            WITH RECURSIVE agent_chain AS (
                SELECT id, username, parent_id, rebate_percentage, market_type, 0 as level
                FROM agents 
                WHERE id = $1
                
                UNION ALL
                
                SELECT a.id, a.username, a.parent_id, a.rebate_percentage, a.market_type, ac.level + 1
                FROM agents a
                JOIN agent_chain ac ON a.id = ac.parent_id
                WHERE ac.level < 10
            )
            SELECT * FROM agent_chain ORDER BY level DESC
        `, [testMember.agent_id]);
        
        console.log(`✓ 代理链 (${agentChain.length} 层):`);
        agentChain.forEach((agent, index) => {
            console.log(`  ${index === 0 ? '总代理' : `L${agent.level}`}: ${agent.username} (退水: ${(agent.rebate_percentage * 100).toFixed(1)}%)`);
        });
        
        const topAgent = agentChain[0];
        console.log(`\n📍 总代理: ${topAgent.username}`);
        
        // 3. 模拟下注并计算退水
        console.log('\n3️⃣ 模拟下注并计算退水...');
        const betAmount = 1000;
        const marketType = topAgent.market_type || 'D';
        const rebatePercentage = marketType === 'A' ? 0.011 : 0.041;
        const rebateAmount = Math.round(betAmount * rebatePercentage * 100) / 100;
        
        console.log(`✓ 下注金额: ${betAmount}`);
        console.log(`✓ 盘口类型: ${marketType}盘`);
        console.log(`✓ 退水比例: ${(rebatePercentage * 100).toFixed(1)}%`);
        console.log(`✓ 退水金额: ${rebateAmount}`);
        console.log(`✓ 退水将全部给总代理: ${topAgent.username}`);
        
        // 4. 检查最近的退水记录
        console.log('\n4️⃣ 检查最近的退水记录...');
        const recentRebates = await db.any(`
            SELECT tr.*, a.username as agent_username 
            FROM transaction_records tr
            JOIN agents a ON tr.user_id = a.id
            WHERE tr.transaction_type = 'rebate' 
            AND tr.user_type = 'agent'
            AND tr.period IS NOT NULL
            ORDER BY tr.created_at DESC 
            LIMIT 5
        `);
        
        if (recentRebates.length > 0) {
            console.log(`✓ 最近 ${recentRebates.length} 笔退水记录:`);
            recentRebates.forEach(record => {
                const desc = record.description || '';
                const marketMatch = desc.match(/([AD])盘/);
                const percentMatch = desc.match(/([\d.]+)%/);
                console.log(`  ${record.agent_username}: ${record.amount} 元 (${marketMatch ? marketMatch[1] : '?'}盘 ${percentMatch ? percentMatch[1] : '?'}%) - ${new Date(record.created_at).toLocaleString()}`);
            });
        } else {
            console.log('❌ 没有找到退水记录');
        }
        
        // 5. 检查代理报表显示
        console.log('\n5️⃣ 检查代理报表显示逻辑...');
        console.log('✓ 新逻辑说明:');
        console.log('  - 退水设定只影响报表显示');
        console.log('  - 代理的赚水显示 = 该代理的退水设定百分比 × 下注金额');
        console.log('  - 会员的赚水显示 = 0 (会员没有退水设定)');
        console.log('  - 这些数据仅供代理查看和手动分配退水使用');
        
        // 6. 查询某个代理的报表数据范例
        const sampleAgent = await db.oneOrNone(`
            SELECT * FROM agents 
            WHERE rebate_percentage > 0 
            AND parent_id IS NOT NULL 
            ORDER BY created_at DESC 
            LIMIT 1
        `);
        
        if (sampleAgent) {
            console.log(`\n✓ 范例代理: ${sampleAgent.username}`);
            console.log(`  退水设定: ${(sampleAgent.rebate_percentage * 100).toFixed(1)}%`);
            
            const betStats = await db.oneOrNone(`
                SELECT 
                    COUNT(*) as bet_count,
                    COALESCE(SUM(amount), 0) as total_bet
                FROM bet_history 
                WHERE username IN (
                    SELECT username FROM members WHERE agent_id = $1
                )
            `, [sampleAgent.id]);
            
            if (betStats && parseFloat(betStats.total_bet) > 0) {
                const earnedRebate = parseFloat(betStats.total_bet) * sampleAgent.rebate_percentage;
                console.log(`  下注总额: ${betStats.total_bet}`);
                console.log(`  报表显示赚水: ${earnedRebate.toFixed(2)} 元`);
            }
        }
        
        console.log('\n✅ 测试完成！');
        
    } catch (error) {
        console.error('❌ 测试失败:', error);
    } finally {
        await db.$pool.end();
    }
}

// 执行测试
testNewRebateSystem();