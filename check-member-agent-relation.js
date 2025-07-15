import db from './db/config.js';

async function checkMemberAgentRelation() {
  try {
    console.log('=== 檢查會員和代理關係 ===\n');

    // 1. 檢查是否有 justin2025A 這個會員
    console.log('1. 尋找 justin2025A：');
    const members = await db.query(`
      SELECT m.*, a.username as agent_username, a.market_type as agent_market_type
      FROM members m
      LEFT JOIN agents a ON m.agent_id = a.id
      WHERE m.username LIKE '%justin%'
      ORDER BY m.created_at DESC;
    `);
    
    if (members.length > 0) {
      console.log(`找到 ${members.length} 個相關會員：`);
      members.forEach(member => {
        console.log(`  - ${member.username} (代理: ${member.agent_username}, 盤口: ${member.market_type || member.agent_market_type || '未設定'})`);
      });
    } else {
      console.log('未找到包含 justin 的會員');
    }

    // 2. 檢查代理關係
    console.log('\n2. 檢查代理關係：');
    const agents = await db.query(`
      SELECT id, username, level, parent_id, market_type, rebate_percentage
      FROM agents
      WHERE username IN ('ti2025A', 'win1688', 'ddd22', 'mj1688', 'justin2025A')
      ORDER BY level;
    `);
    
    console.log('代理資料：');
    agents.forEach(agent => {
      console.log(`  ${agent.username}: Level ${agent.level}, 盤口 ${agent.market_type}, 退水 ${agent.rebate_percentage}%, Parent ID: ${agent.parent_id || 'None'}`);
    });

    // 3. 檢查最近的投注記錄（任何會員）
    console.log('\n3. 檢查最近的投注記錄：');
    const recentBets = await db.query(`
      SELECT b.id, b.username, b.amount, b.created_at
      FROM bet_history b
      ORDER BY b.created_at DESC
      LIMIT 10;
    `);
    
    if (recentBets.length > 0) {
      console.log('最近的投注：');
      recentBets.forEach(bet => {
        console.log(`  ID: ${bet.id}, 會員: ${bet.username}, 金額: ${bet.amount}, 時間: ${new Date(bet.created_at).toLocaleString()}`);
      });
    }

    // 4. 檢查是否有退水相關的欄位
    console.log('\n4. 檢查退水相關欄位：');
    const rebateColumns = await db.query(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE column_name LIKE '%rebate%'
      ORDER BY table_name;
    `);
    
    console.log('退水相關欄位：');
    rebateColumns.forEach(col => {
      console.log(`  ${col.table_name}.${col.column_name}`);
    });

    // 5. 檢查 agent_chain 欄位是否存在
    console.log('\n5. 檢查 agent_chain 欄位：');
    const agentChainColumns = await db.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE column_name = 'agent_chain'
      ORDER BY table_name;
    `);
    
    if (agentChainColumns.length > 0) {
      console.log('找到 agent_chain 欄位：');
      agentChainColumns.forEach(col => {
        console.log(`  ${col.table_name}.${col.column_name} (${col.data_type})`);
      });
    } else {
      console.log('未找到 agent_chain 欄位');
    }

  } catch (error) {
    console.error('檢查失敗:', error.message);
  } finally {
    process.exit();
  }
}

checkMemberAgentRelation();