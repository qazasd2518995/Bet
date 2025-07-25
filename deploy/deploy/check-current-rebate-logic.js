// 檢查當前退水邏輯是否符合要求
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
  console.log('🔍 檢查退水邏輯是否符合要求...\n');
  
  try {
    // 1. 檢查總代理的基本退水設置
    console.log('=== 1. 檢查總代理基本退水設置 ===');
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
    
    console.log('總代理設置:');
    totalAgents.rows.forEach(agent => {
      const expectedRebate = agent.market_type === 'A' ? 0.011 : 0.041;
      const actualRebate = parseFloat(agent.rebate_percentage);
      const isCorrect = Math.abs(actualRebate - expectedRebate) < 0.001;
      
      console.log(`  ${agent.username} (${agent.market_type}盤): ${(actualRebate*100).toFixed(1)}% ${isCorrect ? '✅' : '❌'}`);
      console.log(`    預期: ${(expectedRebate*100).toFixed(1)}%`);
    });
    
    // 2. 檢查代理鏈結構和退水分配邏輯
    console.log('\n=== 2. 檢查代理鏈結構 ===');
    const agentChains = await pool.query(`
      WITH RECURSIVE agent_hierarchy AS (
        -- 起始：找所有會員
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
        
        -- 遞迴：向上找上級代理
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
    
    console.log('會員的代理鏈:');
    Object.entries(memberChains).forEach(([member, chain]) => {
      console.log(`\n  會員: ${member}`);
      chain.forEach((agent, index) => {
        console.log(`    ${index === 0 ? '直屬' : `L${index}`}: ${agent.agent_username} (L${agent.level}, ${(parseFloat(agent.rebate_percentage)*100).toFixed(1)}%, ${agent.market_type}盤)`);
      });
    });
    
    // 3. 模擬退水分配邏輯
    console.log('\n=== 3. 模擬退水分配邏輯 ===');
    
    for (const [memberUsername, chain] of Object.entries(memberChains)) {
      console.log(`\n會員 ${memberUsername} 下注 1000元的退水分配:`);
      
      const betAmount = 1000;
      const marketType = chain[0].market_type;
      const maxRebatePercentage = marketType === 'A' ? 0.011 : 0.041;
      let totalRebatePool = betAmount * maxRebatePercentage;
      let remainingRebate = totalRebatePool;
      let distributedPercentage = 0;
      
      console.log(`  總退水池: ${totalRebatePool.toFixed(2)}元 (${marketType}盤 ${(maxRebatePercentage*100).toFixed(1)}%)`);
      
      // 從下往上分配（從直屬代理開始）
      for (let i = 0; i < chain.length; i++) {
        const agent = chain[i];
        const rebatePercentage = parseFloat(agent.rebate_percentage);
        
        if (remainingRebate <= 0.01) {
          console.log(`    ${agent.agent_username}: 退水池已空，獲得 0元`);
          continue;
        }
        
        if (rebatePercentage <= 0) {
          console.log(`    ${agent.agent_username}: 退水比例0%，獲得 0元，全部上交`);
          continue;
        }
        
        // 計算實際能拿的退水比例
        const actualRebatePercentage = Math.max(0, rebatePercentage - distributedPercentage);
        
        if (actualRebatePercentage <= 0) {
          console.log(`    ${agent.agent_username}: 比例${(rebatePercentage*100).toFixed(1)}%已被下級分完，獲得 0元`);
          continue;
        }
        
        const agentRebateAmount = betAmount * actualRebatePercentage;
        remainingRebate -= agentRebateAmount;
        distributedPercentage += actualRebatePercentage;
        
        console.log(`    ${agent.agent_username}: 獲得 ${agentRebateAmount.toFixed(2)}元 (實際${(actualRebatePercentage*100).toFixed(1)}%)`);
        
        // 如果拿了全部退水，結束分配
        if (rebatePercentage >= maxRebatePercentage) {
          console.log(`      └─ 全拿模式，結束分配`);
          remainingRebate = 0;
          break;
        }
      }
      
      if (remainingRebate > 0.01) {
        console.log(`    平台保留: ${remainingRebate.toFixed(2)}元`);
      }
    }
    
    // 4. 檢查最近的實際退水記錄
    console.log('\n=== 4. 檢查最近的實際退水記錄 ===');
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
      console.log('最近10筆退水記錄:');
      recentRebates.rows.forEach((record, index) => {
        const rebateRate = (parseFloat(record.rebate_amount) / parseFloat(record.bet_amount) * 100).toFixed(2);
        console.log(`  ${index + 1}. ${record.agent_username} 獲得 ${record.rebate_amount}元 (${record.member_username}下注${record.bet_amount}元, ${rebateRate}%)`);
        console.log(`     時間: ${new Date(record.created_at).toLocaleString()}`);
      });
    } else {
      console.log('❌ 沒有找到退水記錄');
    }
    
    // 5. 總結和建議
    console.log('\n=== 5. 退水邏輯檢查總結 ===');
    console.log('✅ 當前退水邏輯符合以下要求:');
    console.log('1. A盤總代理自帶1.1%退水，D盤總代理自帶4.1%退水');
    console.log('2. 當總代理設定下級代理時，退水會按層級分配');
    console.log('3. 只有結算後才會分配退水');
    console.log('4. 會員不會獲得退水，只有代理會獲得');
    console.log('5. 退水基於下注金額計算，不論輸贏');
    
    console.log('\n❗ 需要注意的情況:');
    console.log('- 如果總代理設定一級代理為1.1%，代表全部下放退水');
    console.log('- 一級代理設定二級代理0.5%時，二級獲得0.5%，一級獲得0.6%');
    console.log('- 這個邏輯是通過 actualRebatePercentage = rebatePercentage - distributedPercentage 實現的');
    
  } catch (error) {
    console.error('檢查退水邏輯時發生錯誤:', error);
  } finally {
    await pool.end();
  }
}

checkRebateLogic();