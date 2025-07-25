import db from './db/config.js';

async function investigateRebateCalculation() {
  try {
    console.log('=== 深入调查退水计算问题 ===\n');
    
    const period = '20250716001';
    const member = 'justin111';
    
    // 1. 查询会员的代理链
    console.log('1. 会员的代理链资讯:');
    const memberInfo = await db.oneOrNone(`
      SELECT m.*, a.username as agent_username, a.rebate_percentage as agent_rebate_percentage
      FROM members m
      LEFT JOIN agents a ON m.agent_id = a.id
      WHERE m.username = $1
    `, [member]);
    
    if (memberInfo) {
      console.log(`  会员: ${memberInfo.username}`);
      console.log(`  直属代理: ${memberInfo.agent_username} (退水比例: ${(memberInfo.agent_rebate_percentage * 100).toFixed(1)}%)`);
    }
    
    // 2. 查询代理链的完整资讯
    console.log('\n2. 完整代理链:');
    const agentChain = await db.any(`
      WITH RECURSIVE agent_hierarchy AS (
        -- 从会员的直属代理开始
        SELECT a.*, 0 as hierarchy_level
        FROM agents a
        WHERE a.id = $1
        
        UNION ALL
        
        -- 递回查询上级代理
        SELECT a.*, ah.hierarchy_level + 1
        FROM agents a
        JOIN agent_hierarchy ah ON a.id = ah.parent_id
      )
      SELECT *, hierarchy_level FROM agent_hierarchy
      ORDER BY hierarchy_level
    `, [memberInfo.agent_id]);
    
    agentChain.forEach((agent, idx) => {
      console.log(`  L${idx}: ${agent.username} (退水: ${(agent.rebate_percentage * 100).toFixed(1)}%, 盘口: ${agent.market_type})`);
    });
    
    // 3. 根据盘口类型计算总退水池
    const marketType = agentChain[0]?.market_type || 'A';
    const maxRebatePercentage = marketType === 'A' ? 0.011 : 0.041;
    console.log(`\n3. 退水计算:`);
    console.log(`  盘口类型: ${marketType} 盘`);
    console.log(`  最大退水比例: ${(maxRebatePercentage * 100).toFixed(1)}%`);
    
    // 4. 查询该期的下注总额
    const betSummary = await db.oneOrNone(`
      SELECT COUNT(*) as bet_count, SUM(amount) as total_amount
      FROM bet_history
      WHERE period = $1 AND username = $2
    `, [period, member]);
    
    console.log(`\n4. 下注统计:`);
    console.log(`  下注笔数: ${betSummary.bet_count}`);
    console.log(`  下注总额: $${betSummary.total_amount}`);
    console.log(`  总退水池: $${(betSummary.total_amount * maxRebatePercentage).toFixed(2)}`);
    
    // 5. 模拟退水分配逻辑
    console.log('\n5. 退水分配模拟:');
    let remainingRebate = betSummary.total_amount * maxRebatePercentage;
    let distributedPercentage = 0;
    
    for (let i = 0; i < agentChain.length; i++) {
      const agent = agentChain[i];
      const rebatePercentage = parseFloat(agent.rebate_percentage);
      
      if (remainingRebate <= 0.01) {
        console.log(`  退水池已分配完毕`);
        break;
      }
      
      if (isNaN(rebatePercentage) || rebatePercentage <= 0) {
        console.log(`  ${agent.username}: 退水比例为 ${(rebatePercentage * 100).toFixed(1)}%，不拿退水`);
        continue;
      }
      
      const actualRebatePercentage = Math.max(0, rebatePercentage - distributedPercentage);
      
      if (actualRebatePercentage <= 0) {
        console.log(`  ${agent.username}: 退水比例 ${(rebatePercentage * 100).toFixed(1)}% 已被下级分完`);
        continue;
      }
      
      let agentRebateAmount = betSummary.total_amount * actualRebatePercentage;
      agentRebateAmount = Math.min(agentRebateAmount, remainingRebate);
      agentRebateAmount = Math.round(agentRebateAmount * 100) / 100;
      
      console.log(`  ${agent.username}:`);
      console.log(`    - 设定退水比例: ${(rebatePercentage * 100).toFixed(1)}%`);
      console.log(`    - 实际可得比例: ${(actualRebatePercentage * 100).toFixed(1)}%`);
      console.log(`    - 应得退水金额: $${agentRebateAmount.toFixed(2)}`);
      
      remainingRebate -= agentRebateAmount;
      distributedPercentage = rebatePercentage;
    }
    
    console.log(`\n  剩余未分配退水: $${remainingRebate.toFixed(2)}`);
    
    // 6. 查询实际的退水记录
    console.log('\n6. 实际退水记录与预期对比:');
    const actualRebates = await db.any(`
      SELECT tr.*, a.username
      FROM transaction_records tr
      JOIN agents a ON tr.user_id = a.id AND tr.user_type = 'agent'
      WHERE tr.period = $1 AND tr.transaction_type = 'rebate'
      ORDER BY tr.created_at
    `, [period]);
    
    actualRebates.forEach(r => {
      console.log(`  ${r.username}: 实际收到 $${r.amount}`);
    });
    
    // 7. 检查是否每笔下注都单独计算退水
    console.log('\n7. 检查退水是否按单笔下注计算:');
    const detailedBets = await db.any(`
      SELECT id, amount
      FROM bet_history
      WHERE period = $1 AND username = $2
      ORDER BY id
    `, [period, member]);
    
    detailedBets.forEach(bet => {
      console.log(`  下注ID ${bet.id}: 金额 $${bet.amount}`);
      console.log(`    - 如果单独计算退水:`);
      console.log(`      - justin2025A 应得: $${(bet.amount * 0.005).toFixed(2)} (0.5%)`);
      console.log(`      - ti2025A 应得: $${(bet.amount * 0.006).toFixed(2)} (0.6%)`);
    });
    
    process.exit(0);
    
  } catch (error) {
    console.error('调查过程中发生错误:', error);
    process.exit(1);
  }
}

investigateRebateCalculation();