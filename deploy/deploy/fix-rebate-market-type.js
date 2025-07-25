import db from './db/config.js';

async function fixRebateMarketType() {
  try {
    console.log('=== 修正退水計算的盤口類型問題 ===\n');

    // 1. 檢查 justin111 的代理鏈和盤口類型
    console.log('1. 檢查 justin111 的代理鏈：');
    const agentChain = await db.query(`
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
          a.market_type,
          1 as chain_level
        FROM members m
        JOIN agents a ON m.agent_id = a.id
        WHERE m.username = 'justin111'
        
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
          a.market_type,
          ac.chain_level + 1
        FROM agent_chain ac
        JOIN agents a ON ac.parent_id = a.id
      )
      SELECT * FROM agent_chain
      ORDER BY chain_level;
    `);
    
    console.log('代理鏈：');
    agentChain.forEach(agent => {
      console.log(`  層級 ${agent.chain_level}: ${agent.username} (Level: ${agent.level}, 盤口: ${agent.market_type}, 退水: ${agent.rebate_percentage}%)`);
    });

    // 2. 檢查最近的退水記錄
    console.log('\n2. 檢查 justin111 最近的退水記錄：');
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
      console.log('最近的退水記錄：');
      recentRebates.forEach(record => {
        console.log(`  ${new Date(record.created_at).toLocaleString()}: ${record.agent_username} (${record.market_type}盤) - ${record.amount} - ${record.description}`);
      });
      
      // 計算總退水
      const totalRebate = recentRebates.reduce((sum, r) => sum + parseFloat(r.amount), 0);
      console.log(`\n總退水金額: ${totalRebate.toFixed(2)}`);
    }

    // 3. 分析問題原因
    console.log('\n3. 問題分析：');
    console.log('問題原因：agentBackend.js 中的 getAgentChainForMember 函數沒有查詢 market_type 欄位');
    console.log('導致 enhanced-settlement-system.js 無法正確判斷代理的盤口類型');
    console.log('\n需要修改的地方：');
    console.log('1. agentBackend.js 第 3048 行的 SQL 查詢需要加入 market_type 欄位');
    console.log('2. agentBackend.js 第 3056-3062 行的返回對象需要加入 market_type');

  } catch (error) {
    console.error('檢查失敗:', error);
  } finally {
    process.exit();
  }
}

fixRebateMarketType();