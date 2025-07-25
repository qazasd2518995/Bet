import db from './db/config.js';

async function fixRebateMarketType() {
  try {
    console.log('=== 修正退水计算的盘口类型问题 ===\n');

    // 1. 检查 justin111 的代理链和盘口类型
    console.log('1. 检查 justin111 的代理链：');
    const agentChain = await db.query(`
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
          a.market_type,
          1 as chain_level
        FROM members m
        JOIN agents a ON m.agent_id = a.id
        WHERE m.username = 'justin111'
        
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
          a.market_type,
          ac.chain_level + 1
        FROM agent_chain ac
        JOIN agents a ON ac.parent_id = a.id
      )
      SELECT * FROM agent_chain
      ORDER BY chain_level;
    `);
    
    console.log('代理链：');
    agentChain.forEach(agent => {
      console.log(`  层级 ${agent.chain_level}: ${agent.username} (Level: ${agent.level}, 盘口: ${agent.market_type}, 退水: ${agent.rebate_percentage}%)`);
    });

    // 2. 检查最近的退水记录
    console.log('\n2. 检查 justin111 最近的退水记录：');
    const recentRebates = await db.query(`
      SELECT 
        tr.id,
        tr.agent_id,
        a.username as agent_username,
        a.market_type,
        tr.amount,
        tr.description,
        tr.created_at
      FROM transaction_records tr
      JOIN agents a ON tr.agent_id = a.id
      WHERE tr.transaction_type = 'rebate'
        AND tr.description LIKE '%justin111%'
      ORDER BY tr.created_at DESC
      LIMIT 10;
    `);
    
    if (recentRebates.length > 0) {
      console.log('最近的退水记录：');
      recentRebates.forEach(record => {
        console.log(`  ${new Date(record.created_at).toLocaleString()}: ${record.agent_username} (${record.market_type}盘) - ${record.amount} - ${record.description}`);
      });
      
      // 计算总退水
      const totalRebate = recentRebates.reduce((sum, r) => sum + parseFloat(r.amount), 0);
      console.log(`\n总退水金额: ${totalRebate.toFixed(2)}`);
    }

    // 3. 分析问题原因
    console.log('\n3. 问题分析：');
    console.log('问题原因：agentBackend.js 中的 getAgentChainForMember 函数没有查询 market_type 栏位');
    console.log('导致 enhanced-settlement-system.js 无法正确判断代理的盘口类型');
    console.log('\n需要修改的地方：');
    console.log('1. agentBackend.js 第 3048 行的 SQL 查询需要加入 market_type 栏位');
    console.log('2. agentBackend.js 第 3056-3062 行的返回对象需要加入 market_type');

  } catch (error) {
    console.error('检查失败:', error);
  } finally {
    process.exit();
  }
}

fixRebateMarketType();