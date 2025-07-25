import db from './db/config.js';

// 複製修正後的 getAgentChainForMember 函數
async function getAgentChainForMember(agentId) {
  const agentChain = [];
  
  try {
    let currentAgentId = agentId;
    
    while (currentAgentId) {
      const agent = await db.oneOrNone(`
        SELECT id, username, level, rebate_mode, rebate_percentage, max_rebate_percentage, parent_id, market_type
        FROM agents 
        WHERE id = $1 AND status = 1
      `, [currentAgentId]);
      
      if (!agent) break;
      
      agentChain.push({
        id: agent.id,
        username: agent.username,
        level: agent.level,
        rebate_mode: agent.rebate_mode || 'percentage',
        rebate_percentage: agent.rebate_percentage || 0.041,
        max_rebate_percentage: agent.max_rebate_percentage || 0.041,
        market_type: agent.market_type || 'D'  // 添加 market_type，預設為 D 盤
      });
      
      // 移動到上級代理
      currentAgentId = agent.parent_id;
    }
    
    return agentChain;
  } catch (error) {
    console.error('獲取代理鏈時發生錯誤:', error);
    return [];
  }
}

async function testLocalAgentChain() {
  try {
    console.log('=== 本地測試代理鏈（修正後） ===\n');

    // 1. 獲取會員資訊
    const member = await db.oneOrNone(`
      SELECT id, username, agent_id, market_type
      FROM members 
      WHERE username = 'justin111'
    `);
    
    if (!member) {
      console.log('找不到會員 justin111');
      return;
    }
    
    console.log(`會員: ${member.username}`);
    console.log(`會員 ID: ${member.id}`);
    console.log(`代理 ID: ${member.agent_id}`);
    console.log(`會員盤口: ${member.market_type || '跟隨代理'}`);

    // 2. 獲取代理鏈
    console.log('\n獲取代理鏈：');
    const agentChain = await getAgentChainForMember(member.agent_id);
    
    agentChain.forEach((agent, index) => {
      console.log(`\n層級 ${index + 1}: ${agent.username}`);
      console.log(`  - ID: ${agent.id}`);
      console.log(`  - Level: ${agent.level}`);
      console.log(`  - 盤口類型: ${agent.market_type}`);
      console.log(`  - 退水比例: ${(agent.rebate_percentage * 100).toFixed(2)}%`);
      console.log(`  - 退水模式: ${agent.rebate_mode}`);
    });

    // 3. 計算退水池
    console.log('\n=== 退水池計算 ===');
    if (agentChain.length > 0) {
      const directAgent = agentChain[0];
      const marketType = directAgent.market_type;
      const maxRebatePercentage = marketType === 'A' ? 0.011 : 0.041;
      
      console.log(`\n直屬代理: ${directAgent.username}`);
      console.log(`盤口類型: ${marketType}`);
      console.log(`總退水池: ${(maxRebatePercentage * 100).toFixed(1)}%`);
      
      // 模擬退水分配
      const betAmount = 1000;
      const totalRebatePool = betAmount * maxRebatePercentage;
      
      console.log(`\n模擬下注 ${betAmount} 元的退水分配：`);
      console.log(`總退水池: ${totalRebatePool.toFixed(2)} 元`);
      
      let remainingRebate = totalRebatePool;
      let distributedPercentage = 0;
      
      agentChain.forEach(agent => {
        const rebatePercentage = parseFloat(agent.rebate_percentage);
        if (rebatePercentage > 0 && remainingRebate > 0.01) {
          const actualRebatePercentage = Math.max(0, rebatePercentage - distributedPercentage);
          if (actualRebatePercentage > 0) {
            let agentRebateAmount = betAmount * actualRebatePercentage;
            agentRebateAmount = Math.min(agentRebateAmount, remainingRebate);
            agentRebateAmount = Math.round(agentRebateAmount * 100) / 100;
            
            console.log(`  ${agent.username}: ${agentRebateAmount.toFixed(2)} 元 (實際 ${(actualRebatePercentage * 100).toFixed(2)}%)`);
            
            remainingRebate -= agentRebateAmount;
            distributedPercentage += actualRebatePercentage;
          }
        }
      });
      
      if (remainingRebate > 0.01) {
        console.log(`  平台保留: ${remainingRebate.toFixed(2)} 元`);
      }
      
      if (marketType === 'A') {
        console.log('\n✅ 正確：A盤會員使用 1.1% 的退水池');
      }
    }

  } catch (error) {
    console.error('測試失敗:', error);
  } finally {
    process.exit();
  }
}

testLocalAgentChain();