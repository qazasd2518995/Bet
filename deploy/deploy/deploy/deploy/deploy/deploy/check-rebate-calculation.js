import db from './db/config.js';

async function checkRebateCalculation() {
  try {
    console.log('=== 檢查退水計算邏輯 ===\n');

    // 1. 檢查 justin2025A 的代理鏈關係和盤口類型
    console.log('1. 檢查 justin2025A 的代理鏈關係：');
    const memberQuery = `
      WITH RECURSIVE agent_chain AS (
        -- 起始：找到會員的直屬代理
        SELECT 
          m.username as member_username,
          m.agent_id,
          a.id,
          a.username,
          a.parent_id,
          a.level,
          a.rebate_percentage,
          a.handicap_type,
          1 as chain_level
        FROM members m
        JOIN agents a ON m.agent_id = a.id
        WHERE m.username = 'justin2025A'
        
        UNION ALL
        
        -- 遞迴：找上級代理
        SELECT 
          ac.member_username,
          ac.agent_id,
          a.id,
          a.username,
          a.parent_id,
          a.level,
          a.rebate_percentage,
          a.handicap_type,
          ac.chain_level + 1
        FROM agent_chain ac
        JOIN agents a ON ac.parent_id = a.id
      )
      SELECT * FROM agent_chain
      ORDER BY chain_level;
    `;
    
    const agentChain = await db.query(memberQuery);
    console.log('代理鏈：');
    agentChain.forEach(agent => {
      console.log(`  層級 ${agent.chain_level}: ${agent.username} (Level: ${agent.level}, 盤口: ${agent.handicap_type}, 退水: ${agent.rebate_percentage}%)`);
    });

    // 2. 檢查各代理的盤口類型
    console.log('\n2. 檢查所有相關代理的盤口類型：');
    const allAgentsQuery = `
      SELECT username, level, handicap_type, rebate_percentage
      FROM agents
      WHERE username IN ('win1688', 'ti2025A', 'ddd22', 'mj1688')
      ORDER BY level;
    `;
    
    const allAgents = await db.query(allAgentsQuery);
    console.log('代理詳情：');
    allAgents.forEach(agent => {
      console.log(`  ${agent.username}: Level ${agent.level}, 盤口 ${agent.handicap_type}, 退水 ${agent.rebate_percentage}%`);
    });

    // 3. 檢查最近的投注記錄和退水計算
    console.log('\n3. 檢查 justin2025A 最近的投注記錄：');
    const betsQuery = `
      SELECT 
        b.id,
        b.amount,
        b.rebate_amount,
        b.agent_chain,
        b.created_at,
        (b.rebate_amount / b.amount * 100) as rebate_percentage
      FROM bet_history b
      JOIN members m ON b.member_id = m.id
      WHERE m.username = 'justin2025A'
      ORDER BY b.created_at DESC
      LIMIT 5;
    `;
    
    const bets = await db.query(betsQuery);
    console.log('最近投注：');
    bets.forEach(bet => {
      console.log(`  投注ID: ${bet.id}, 金額: ${bet.amount}, 退水: ${bet.rebate_amount}, 退水率: ${bet.rebate_percentage.toFixed(2)}%`);
      console.log(`    代理鏈: ${bet.agent_chain}`);
    });

    // 4. 檢查退水分配記錄
    console.log('\n4. 檢查最近的退水分配記錄：');
    const rebateQuery = `
      SELECT 
        tr.bet_id,
        tr.agent_id,
        a.username as agent_username,
        a.handicap_type,
        tr.type,
        tr.amount,
        tr.description,
        tr.created_at
      FROM transaction_records tr
      JOIN agents a ON tr.agent_id = a.id
      WHERE tr.type = 'rebate'
        AND tr.bet_id IN (
          SELECT b.id 
          FROM bet_history b
          JOIN members m ON b.member_id = m.id
          WHERE m.username = 'justin2025A'
          ORDER BY b.created_at DESC
          LIMIT 5
        )
      ORDER BY tr.bet_id DESC, tr.created_at;
    `;
    
    const rebateRecords = await db.query(rebateQuery);
    console.log('退水分配記錄：');
    let currentBetId = null;
    rebateRecords.forEach(record => {
      if (currentBetId !== record.bet_id) {
        console.log(`\n  投注ID ${record.bet_id}:`);
        currentBetId = record.bet_id;
      }
      console.log(`    ${record.agent_username} (${record.handicap_type}盤): ${record.amount} - ${record.description}`);
    });

    // 5. 分析問題
    console.log('\n=== 問題分析 ===');
    if (agentChain.length > 0) {
      const memberAgent = agentChain[0];
      const topAgent = agentChain[agentChain.length - 1];
      
      console.log(`\n會員 justin2025A 的直屬代理: ${memberAgent.username} (${memberAgent.handicap_type}盤)`);
      console.log(`代理鏈最頂層代理: ${topAgent.username} (${topAgent.handicap_type}盤)`);
      
      if (memberAgent.handicap_type === 'A' && bets.length > 0 && bets[0].rebate_percentage > 2) {
        console.log('\n❌ 問題確認：A盤會員但使用了高於A盤標準的退水率！');
        console.log('   應該使用 1.1% 的總退水池，而不是 4.1%');
      }
    }

  } catch (error) {
    console.error('檢查失敗:', error);
  } finally {
    process.exit();
  }
}

checkRebateCalculation();