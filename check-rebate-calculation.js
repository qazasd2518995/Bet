import db from './db/config.js';

async function checkRebateCalculation() {
  try {
    console.log('=== 检查退水计算逻辑 ===\n');

    // 1. 检查 justin2025A 的代理链关系和盘口类型
    console.log('1. 检查 justin2025A 的代理链关系：');
    const memberQuery = `
      WITH RECURSIVE agent_chain AS (
        -- 起始：找到会员的直属代理
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
        
        -- 递回：找上级代理
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
    console.log('代理链：');
    agentChain.forEach(agent => {
      console.log(`  层级 ${agent.chain_level}: ${agent.username} (Level: ${agent.level}, 盘口: ${agent.handicap_type}, 退水: ${agent.rebate_percentage}%)`);
    });

    // 2. 检查各代理的盘口类型
    console.log('\n2. 检查所有相关代理的盘口类型：');
    const allAgentsQuery = `
      SELECT username, level, handicap_type, rebate_percentage
      FROM agents
      WHERE username IN ('win1688', 'ti2025A', 'ddd22', 'mj1688')
      ORDER BY level;
    `;
    
    const allAgents = await db.query(allAgentsQuery);
    console.log('代理详情：');
    allAgents.forEach(agent => {
      console.log(`  ${agent.username}: Level ${agent.level}, 盘口 ${agent.handicap_type}, 退水 ${agent.rebate_percentage}%`);
    });

    // 3. 检查最近的投注记录和退水计算
    console.log('\n3. 检查 justin2025A 最近的投注记录：');
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
      console.log(`  投注ID: ${bet.id}, 金额: ${bet.amount}, 退水: ${bet.rebate_amount}, 退水率: ${bet.rebate_percentage.toFixed(2)}%`);
      console.log(`    代理链: ${bet.agent_chain}`);
    });

    // 4. 检查退水分配记录
    console.log('\n4. 检查最近的退水分配记录：');
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
    console.log('退水分配记录：');
    let currentBetId = null;
    rebateRecords.forEach(record => {
      if (currentBetId !== record.bet_id) {
        console.log(`\n  投注ID ${record.bet_id}:`);
        currentBetId = record.bet_id;
      }
      console.log(`    ${record.agent_username} (${record.handicap_type}盘): ${record.amount} - ${record.description}`);
    });

    // 5. 分析问题
    console.log('\n=== 问题分析 ===');
    if (agentChain.length > 0) {
      const memberAgent = agentChain[0];
      const topAgent = agentChain[agentChain.length - 1];
      
      console.log(`\n会员 justin2025A 的直属代理: ${memberAgent.username} (${memberAgent.handicap_type}盘)`);
      console.log(`代理链最顶层代理: ${topAgent.username} (${topAgent.handicap_type}盘)`);
      
      if (memberAgent.handicap_type === 'A' && bets.length > 0 && bets[0].rebate_percentage > 2) {
        console.log('\n❌ 问题确认：A盘会员但使用了高于A盘标准的退水率！');
        console.log('   应该使用 1.1% 的总退水池，而不是 4.1%');
      }
    }

  } catch (error) {
    console.error('检查失败:', error);
  } finally {
    process.exit();
  }
}

checkRebateCalculation();