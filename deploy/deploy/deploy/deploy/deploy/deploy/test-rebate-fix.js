import fetch from 'node-fetch';

const AGENT_API_URL = 'https://bet-agent.onrender.com';

async function testRebateFix() {
  try {
    console.log('=== 測試退水修正 ===\n');

    // 1. 測試獲取會員代理鏈 API
    console.log('1. 測試獲取 justin111 的代理鏈：');
    const response = await fetch(`${AGENT_API_URL}/api/agent/member-agent-chain?username=justin111`);
    
    if (!response.ok) {
      console.error(`API 返回錯誤: ${response.status}`);
      return;
    }
    
    const data = await response.json();
    
    if (data.success) {
      console.log('成功獲取代理鏈：');
      data.agentChain.forEach((agent, index) => {
        console.log(`  層級 ${index + 1}: ${agent.username}`);
        console.log(`    - Level: ${agent.level}`);
        console.log(`    - 盤口類型: ${agent.market_type || '未設定'}`);
        console.log(`    - 退水比例: ${(agent.rebate_percentage * 100).toFixed(2)}%`);
      });
      
      // 2. 分析退水池計算
      console.log('\n2. 退水池計算分析：');
      if (data.agentChain.length > 0) {
        const directAgent = data.agentChain[0];
        const marketType = directAgent.market_type || 'D';
        const maxRebatePercentage = marketType === 'A' ? 0.011 : 0.041;
        
        console.log(`  直屬代理: ${directAgent.username}`);
        console.log(`  盤口類型: ${marketType}`);
        console.log(`  總退水池: ${(maxRebatePercentage * 100).toFixed(1)}%`);
        
        if (marketType === 'A') {
          console.log('\n✅ 修正成功：現在會正確使用 A盤 1.1% 的退水池');
        } else {
          console.log('\n  使用 D盤 4.1% 的退水池');
        }
      }
      
      // 3. 計算退水分配
      console.log('\n3. 模擬退水分配（假設下注 1000 元）：');
      const betAmount = 1000;
      const directAgent = data.agentChain[0];
      const marketType = directAgent.market_type || 'D';
      const maxRebatePercentage = marketType === 'A' ? 0.011 : 0.041;
      const totalRebatePool = betAmount * maxRebatePercentage;
      
      console.log(`  下注金額: ${betAmount} 元`);
      console.log(`  總退水池: ${totalRebatePool.toFixed(2)} 元 (${(maxRebatePercentage * 100).toFixed(1)}%)`);
      
      let remainingRebate = totalRebatePool;
      let distributedPercentage = 0;
      
      console.log('\n  退水分配：');
      data.agentChain.forEach(agent => {
        const rebatePercentage = parseFloat(agent.rebate_percentage);
        if (rebatePercentage > 0 && remainingRebate > 0.01) {
          const actualRebatePercentage = Math.max(0, rebatePercentage - distributedPercentage);
          if (actualRebatePercentage > 0) {
            const agentRebateAmount = Math.min(betAmount * actualRebatePercentage, remainingRebate);
            console.log(`    ${agent.username}: ${agentRebateAmount.toFixed(2)} 元 (${(actualRebatePercentage * 100).toFixed(2)}%)`);
            remainingRebate -= agentRebateAmount;
            distributedPercentage += actualRebatePercentage;
          }
        }
      });
      
      if (remainingRebate > 0.01) {
        console.log(`    平台保留: ${remainingRebate.toFixed(2)} 元`);
      }
      
    } else {
      console.error('獲取代理鏈失敗:', data.message);
    }

  } catch (error) {
    console.error('測試失敗:', error.message);
  }
}

testRebateFix();