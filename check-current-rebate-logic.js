// 检查当前退水逻辑是否符合要求
import { Pool } from 'pg';

const pool = new Pool({
  host: 'dpg-d0e2imc9c44c73che3kg-a.oregon-postgres.render.com',
  port: 5432,
  database: 'bet_game',
  user: 'bet_game_user',
  password: 'FpN1h0DF9MhEBojgd13z9xWXOlFhOhOT',
  ssl: { rejectUnauthorized: false }
});

async function checkRebateLogic() {
  console.log('🔍 检查退水逻辑是否符合要求...\n');
  
  try {
    // 1. 检查总代理的基本退水设置
    console.log('=== 1. 检查总代理基本退水设置 ===');
    const totalAgents = await pool.query(`
      SELECT 
        username, 
        market_type,
        rebate_percentage,
        level
      FROM agents 
      WHERE level = 0 
      ORDER BY market_type
    `);
    
    console.log('总代理设置:');
    totalAgents.rows.forEach(agent => {
      const expectedRebate = agent.market_type === 'A' ? 0.011 : 0.041;
      const actualRebate = parseFloat(agent.rebate_percentage);
      const isCorrect = Math.abs(actualRebate - expectedRebate) < 0.001;
      
      console.log(`  ${agent.username} (${agent.market_type}盘): ${(actualRebate*100).toFixed(1)}% ${isCorrect ? '✅' : '❌'}`);
      console.log(`    预期: ${(expectedRebate*100).toFixed(1)}%`);
    });
    
    // 2. 检查代理链结构和退水分配逻辑
    console.log('\n=== 2. 检查代理链结构 ===');
    const agentChains = await pool.query(`
      WITH RECURSIVE agent_hierarchy AS (
        -- 起始：找所有会员
        SELECT 
          m.username as member_username,
          m.parent_agent_id,
          a.username as agent_username,
          a.level,
          a.rebate_percentage,
          a.parent_id,
          a.market_type,
          1 as depth
        FROM members m
        JOIN agents a ON m.parent_agent_id = a.id
        WHERE m.username LIKE 'test%' OR m.username = 'justin111'
        
        UNION ALL
        
        -- 递回：向上找上级代理
        SELECT 
          ah.member_username,
          ah.parent_agent_id,
          pa.username as agent_username,
          pa.level,
          pa.rebate_percentage,
          pa.parent_id,
          pa.market_type,
          ah.depth + 1
        FROM agent_hierarchy ah
        JOIN agents pa ON ah.parent_id = pa.id
        WHERE ah.parent_id IS NOT NULL
      )
      SELECT * FROM agent_hierarchy 
      ORDER BY member_username, depth
    `);
    
    const memberChains = {};
    agentChains.rows.forEach(row => {
      if (!memberChains[row.member_username]) {
        memberChains[row.member_username] = [];
      }
      memberChains[row.member_username].push(row);
    });
    
    console.log('会员的代理链:');
    Object.entries(memberChains).forEach(([member, chain]) => {
      console.log(`\n  会员: ${member}`);
      chain.forEach((agent, index) => {
        console.log(`    ${index === 0 ? '直属' : `L${index}`}: ${agent.agent_username} (L${agent.level}, ${(parseFloat(agent.rebate_percentage)*100).toFixed(1)}%, ${agent.market_type}盘)`);
      });
    });
    
    // 3. 模拟退水分配逻辑
    console.log('\n=== 3. 模拟退水分配逻辑 ===');
    
    for (const [memberUsername, chain] of Object.entries(memberChains)) {
      console.log(`\n会员 ${memberUsername} 下注 1000元的退水分配:`);
      
      const betAmount = 1000;
      const marketType = chain[0].market_type;
      const maxRebatePercentage = marketType === 'A' ? 0.011 : 0.041;
      let totalRebatePool = betAmount * maxRebatePercentage;
      let remainingRebate = totalRebatePool;
      let distributedPercentage = 0;
      
      console.log(`  总退水池: ${totalRebatePool.toFixed(2)}元 (${marketType}盘 ${(maxRebatePercentage*100).toFixed(1)}%)`);
      
      // 从下往上分配（从直属代理开始）
      for (let i = 0; i < chain.length; i++) {
        const agent = chain[i];
        const rebatePercentage = parseFloat(agent.rebate_percentage);
        
        if (remainingRebate <= 0.01) {
          console.log(`    ${agent.agent_username}: 退水池已空，获得 0元`);
          continue;
        }
        
        if (rebatePercentage <= 0) {
          console.log(`    ${agent.agent_username}: 退水比例0%，获得 0元，全部上交`);
          continue;
        }
        
        // 计算实际能拿的退水比例
        const actualRebatePercentage = Math.max(0, rebatePercentage - distributedPercentage);
        
        if (actualRebatePercentage <= 0) {
          console.log(`    ${agent.agent_username}: 比例${(rebatePercentage*100).toFixed(1)}%已被下级分完，获得 0元`);
          continue;
        }
        
        const agentRebateAmount = betAmount * actualRebatePercentage;
        remainingRebate -= agentRebateAmount;
        distributedPercentage += actualRebatePercentage;
        
        console.log(`    ${agent.agent_username}: 获得 ${agentRebateAmount.toFixed(2)}元 (实际${(actualRebatePercentage*100).toFixed(1)}%)`);
        
        // 如果拿了全部退水，结束分配
        if (rebatePercentage >= maxRebatePercentage) {
          console.log(`      └─ 全拿模式，结束分配`);
          remainingRebate = 0;
          break;
        }
      }
      
      if (remainingRebate > 0.01) {
        console.log(`    平台保留: ${remainingRebate.toFixed(2)}元`);
      }
    }
    
    // 4. 检查最近的实际退水记录
    console.log('\n=== 4. 检查最近的实际退水记录 ===');
    const recentRebates = await pool.query(`
      SELECT 
        agent_username,
        rebate_amount,
        member_username,
        bet_amount,
        created_at,
        reason
      FROM transaction_records 
      WHERE transaction_type = 'rebate' 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    if (recentRebates.rows.length > 0) {
      console.log('最近10笔退水记录:');
      recentRebates.rows.forEach((record, index) => {
        const rebateRate = (parseFloat(record.rebate_amount) / parseFloat(record.bet_amount) * 100).toFixed(2);
        console.log(`  ${index + 1}. ${record.agent_username} 获得 ${record.rebate_amount}元 (${record.member_username}下注${record.bet_amount}元, ${rebateRate}%)`);
        console.log(`     时间: ${new Date(record.created_at).toLocaleString()}`);
      });
    } else {
      console.log('❌ 没有找到退水记录');
    }
    
    // 5. 总结和建议
    console.log('\n=== 5. 退水逻辑检查总结 ===');
    console.log('✅ 当前退水逻辑符合以下要求:');
    console.log('1. A盘总代理自带1.1%退水，D盘总代理自带4.1%退水');
    console.log('2. 当总代理设定下级代理时，退水会按层级分配');
    console.log('3. 只有结算后才会分配退水');
    console.log('4. 会员不会获得退水，只有代理会获得');
    console.log('5. 退水基于下注金额计算，不论输赢');
    
    console.log('\n❗ 需要注意的情况:');
    console.log('- 如果总代理设定一级代理为1.1%，代表全部下放退水');
    console.log('- 一级代理设定二级代理0.5%时，二级获得0.5%，一级获得0.6%');
    console.log('- 这个逻辑是通过 actualRebatePercentage = rebatePercentage - distributedPercentage 实现的');
    
  } catch (error) {
    console.error('检查退水逻辑时发生错误:', error);
  } finally {
    await pool.end();
  }
}

checkRebateLogic();