import db from './db/config.js';

async function investigateRebateCalculation() {
  try {
    console.log('=== 深入調查退水計算問題 ===\n');
    
    const period = '20250716001';
    const member = 'justin111';
    
    // 1. 查詢會員的代理鏈
    console.log('1. 會員的代理鏈資訊:');
    const memberInfo = await db.oneOrNone(`
      SELECT m.*, a.username as agent_username, a.rebate_percentage as agent_rebate_percentage
      FROM members m
      LEFT JOIN agents a ON m.agent_id = a.id
      WHERE m.username = $1
    `, [member]);
    
    if (memberInfo) {
      console.log(`  會員: ${memberInfo.username}`);
      console.log(`  直屬代理: ${memberInfo.agent_username} (退水比例: ${(memberInfo.agent_rebate_percentage * 100).toFixed(1)}%)`);
    }
    
    // 2. 查詢代理鏈的完整資訊
    console.log('\n2. 完整代理鏈:');
    const agentChain = await db.any(`
      WITH RECURSIVE agent_hierarchy AS (
        -- 從會員的直屬代理開始
        SELECT a.*, 0 as hierarchy_level
        FROM agents a
        WHERE a.id = $1
        
        UNION ALL
        
        -- 遞迴查詢上級代理
        SELECT a.*, ah.hierarchy_level + 1
        FROM agents a
        JOIN agent_hierarchy ah ON a.id = ah.parent_id
      )
      SELECT *, hierarchy_level FROM agent_hierarchy
      ORDER BY hierarchy_level
    `, [memberInfo.agent_id]);
    
    agentChain.forEach((agent, idx) => {
      console.log(`  L${idx}: ${agent.username} (退水: ${(agent.rebate_percentage * 100).toFixed(1)}%, 盤口: ${agent.market_type})`);
    });
    
    // 3. 根據盤口類型計算總退水池
    const marketType = agentChain[0]?.market_type || 'A';
    const maxRebatePercentage = marketType === 'A' ? 0.011 : 0.041;
    console.log(`\n3. 退水計算:`);
    console.log(`  盤口類型: ${marketType} 盤`);
    console.log(`  最大退水比例: ${(maxRebatePercentage * 100).toFixed(1)}%`);
    
    // 4. 查詢該期的下注總額
    const betSummary = await db.oneOrNone(`
      SELECT COUNT(*) as bet_count, SUM(amount) as total_amount
      FROM bet_history
      WHERE period = $1 AND username = $2
    `, [period, member]);
    
    console.log(`\n4. 下注統計:`);
    console.log(`  下注筆數: ${betSummary.bet_count}`);
    console.log(`  下注總額: $${betSummary.total_amount}`);
    console.log(`  總退水池: $${(betSummary.total_amount * maxRebatePercentage).toFixed(2)}`);
    
    // 5. 模擬退水分配邏輯
    console.log('\n5. 退水分配模擬:');
    let remainingRebate = betSummary.total_amount * maxRebatePercentage;
    let distributedPercentage = 0;
    
    for (let i = 0; i < agentChain.length; i++) {
      const agent = agentChain[i];
      const rebatePercentage = parseFloat(agent.rebate_percentage);
      
      if (remainingRebate <= 0.01) {
        console.log(`  退水池已分配完畢`);
        break;
      }
      
      if (isNaN(rebatePercentage) || rebatePercentage <= 0) {
        console.log(`  ${agent.username}: 退水比例為 ${(rebatePercentage * 100).toFixed(1)}%，不拿退水`);
        continue;
      }
      
      const actualRebatePercentage = Math.max(0, rebatePercentage - distributedPercentage);
      
      if (actualRebatePercentage <= 0) {
        console.log(`  ${agent.username}: 退水比例 ${(rebatePercentage * 100).toFixed(1)}% 已被下級分完`);
        continue;
      }
      
      let agentRebateAmount = betSummary.total_amount * actualRebatePercentage;
      agentRebateAmount = Math.min(agentRebateAmount, remainingRebate);
      agentRebateAmount = Math.round(agentRebateAmount * 100) / 100;
      
      console.log(`  ${agent.username}:`);
      console.log(`    - 設定退水比例: ${(rebatePercentage * 100).toFixed(1)}%`);
      console.log(`    - 實際可得比例: ${(actualRebatePercentage * 100).toFixed(1)}%`);
      console.log(`    - 應得退水金額: $${agentRebateAmount.toFixed(2)}`);
      
      remainingRebate -= agentRebateAmount;
      distributedPercentage = rebatePercentage;
    }
    
    console.log(`\n  剩餘未分配退水: $${remainingRebate.toFixed(2)}`);
    
    // 6. 查詢實際的退水記錄
    console.log('\n6. 實際退水記錄與預期對比:');
    const actualRebates = await db.any(`
      SELECT tr.*, a.username
      FROM transaction_records tr
      JOIN agents a ON tr.user_id = a.id AND tr.user_type = 'agent'
      WHERE tr.period = $1 AND tr.transaction_type = 'rebate'
      ORDER BY tr.created_at
    `, [period]);
    
    actualRebates.forEach(r => {
      console.log(`  ${r.username}: 實際收到 $${r.amount}`);
    });
    
    // 7. 檢查是否每筆下注都單獨計算退水
    console.log('\n7. 檢查退水是否按單筆下注計算:');
    const detailedBets = await db.any(`
      SELECT id, amount
      FROM bet_history
      WHERE period = $1 AND username = $2
      ORDER BY id
    `, [period, member]);
    
    detailedBets.forEach(bet => {
      console.log(`  下注ID ${bet.id}: 金額 $${bet.amount}`);
      console.log(`    - 如果單獨計算退水:`);
      console.log(`      - justin2025A 應得: $${(bet.amount * 0.005).toFixed(2)} (0.5%)`);
      console.log(`      - ti2025A 應得: $${(bet.amount * 0.006).toFixed(2)} (0.6%)`);
    });
    
    process.exit(0);
    
  } catch (error) {
    console.error('調查過程中發生錯誤:', error);
    process.exit(1);
  }
}

investigateRebateCalculation();