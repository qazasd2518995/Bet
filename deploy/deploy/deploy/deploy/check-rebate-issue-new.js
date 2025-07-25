import db from './db/config.js';

async function checkRebateSettings() {
  try {
    console.log('=== 檢查退水設定 ===');
    
    // 檢查代理設定
    const agents = await db.any(`
      SELECT id, username, level, rebate_percentage, max_rebate_percentage, market_type, parent_id 
      FROM agents 
      WHERE username IN ($1, $2, $3) 
      ORDER BY level DESC
    `, ['ti2025A', 'justin2025A', 'justin111']);
    
    console.log('代理設定:');
    for (const agent of agents) {
      console.log(`${agent.username} (L${agent.level}): 退水=${(agent.rebate_percentage*100).toFixed(1)}%, 最大=${(agent.max_rebate_percentage*100).toFixed(1)}%, 盤口=${agent.market_type}, 上級=${agent.parent_id}`);
    }
    
    // 檢查會員設定
    const member = await db.oneOrNone('SELECT username, agent_id, market_type FROM members WHERE username = $1', ['justin111']);
    if (member) {
      console.log('\n會員設定:');
      console.log(`${member.username} 的直屬代理ID: ${member.agent_id}, 盤口: ${member.market_type}`);
    }
    
    // 檢查代理鏈
    console.log('\n=== 檢查代理鏈 ===');
    if (member && member.agent_id) {
      let currentAgentId = member.agent_id;
      const agentChain = [];
      
      while (currentAgentId) {
        const agent = await db.oneOrNone('SELECT * FROM agents WHERE id = $1', [currentAgentId]);
        if (!agent) break;
        
        agentChain.push({
          id: agent.id,
          username: agent.username,
          level: agent.level,
          rebate_percentage: agent.rebate_percentage,
          parent_id: agent.parent_id
        });
        
        currentAgentId = agent.parent_id;
      }
      
      console.log('代理鏈（從直屬到最上級）:');
      agentChain.forEach((agent, index) => {
        console.log(`${index + 1}. ${agent.username} (L${agent.level}): 退水=${(agent.rebate_percentage*100).toFixed(1)}%`);
      });
      
      // 計算退水分配
      console.log('\n=== 模擬退水計算（1000元下注） ===');
      const betAmount = 1000;
      const maxRebatePercentage = member.market_type === 'A' ? 0.011 : 0.041;
      const totalRebatePool = betAmount * maxRebatePercentage;
      
      console.log(`總退水池: ${totalRebatePool.toFixed(2)} 元 (${(maxRebatePercentage*100).toFixed(1)}%)`);
      
      let remainingRebate = totalRebatePool;
      let distributedPercentage = 0;
      
      console.log('\n退水分配詳情:');
      for (let i = 0; i < agentChain.length; i++) {
        const agent = agentChain[i];
        const rebatePercentage = parseFloat(agent.rebate_percentage);
        
        if (remainingRebate <= 0.01) {
          console.log(`退水池已分配完畢`);
          break;
        }
        
        if (rebatePercentage <= 0) {
          console.log(`${agent.username}: 退水比例為0，不拿退水`);
          continue;
        }
        
        // 計算實際能拿的退水比例
        const actualRebatePercentage = Math.max(0, rebatePercentage - distributedPercentage);
        
        if (actualRebatePercentage <= 0) {
          console.log(`${agent.username}: 退水比例 ${(rebatePercentage*100).toFixed(1)}% 已被下級分完`);
          continue;
        }
        
        // 計算該代理實際獲得的退水金額
        let agentRebateAmount = betAmount * actualRebatePercentage;
        agentRebateAmount = Math.min(agentRebateAmount, remainingRebate);
        agentRebateAmount = Math.round(agentRebateAmount * 100) / 100;
        
        remainingRebate -= agentRebateAmount;
        distributedPercentage += actualRebatePercentage;
        
        console.log(`${agent.username}: 設定比例=${(rebatePercentage*100).toFixed(1)}%, 實際獲得=${(actualRebatePercentage*100).toFixed(1)}%, 金額=${agentRebateAmount.toFixed(2)}元`);
        
        if (rebatePercentage >= maxRebatePercentage) {
          console.log(`${agent.username} 拿了全部退水池，結束分配`);
          break;
        }
      }
      
      console.log(`\n剩餘未分配退水: ${remainingRebate.toFixed(2)} 元`);
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('錯誤:', error);
    process.exit(1);
  }
}

checkRebateSettings();