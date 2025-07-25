import db from './db/config.js';

async function checkMemberAgentRelation() {
  try {
    console.log('=== 检查会员和代理关系 ===\n');

    // 1. 检查是否有 justin2025A 这个会员
    console.log('1. 寻找 justin2025A：');
    const members = await db.query(`
      SELECT m.*, a.username as agent_username, a.market_type as agent_market_type
      FROM members m
      LEFT JOIN agents a ON m.agent_id = a.id
      WHERE m.username LIKE '%justin%'
      ORDER BY m.created_at DESC;
    `);
    
    if (members.length > 0) {
      console.log(`找到 ${members.length} 个相关会员：`);
      members.forEach(member => {
        console.log(`  - ${member.username} (代理: ${member.agent_username}, 盘口: ${member.market_type || member.agent_market_type || '未设定'})`);
      });
    } else {
      console.log('未找到包含 justin 的会员');
    }

    // 2. 检查代理关系
    console.log('\n2. 检查代理关系：');
    const agents = await db.query(`
      SELECT id, username, level, parent_id, market_type, rebate_percentage
      FROM agents
      WHERE username IN ('ti2025A', 'win1688', 'ddd22', 'mj1688', 'justin2025A')
      ORDER BY level;
    `);
    
    console.log('代理资料：');
    agents.forEach(agent => {
      console.log(`  ${agent.username}: Level ${agent.level}, 盘口 ${agent.market_type}, 退水 ${agent.rebate_percentage}%, Parent ID: ${agent.parent_id || 'None'}`);
    });

    // 3. 检查最近的投注记录（任何会员）
    console.log('\n3. 检查最近的投注记录：');
    const recentBets = await db.query(`
      SELECT b.id, b.username, b.amount, b.created_at
      FROM bet_history b
      ORDER BY b.created_at DESC
      LIMIT 10;
    `);
    
    if (recentBets.length > 0) {
      console.log('最近的投注：');
      recentBets.forEach(bet => {
        console.log(`  ID: ${bet.id}, 会员: ${bet.username}, 金额: ${bet.amount}, 时间: ${new Date(bet.created_at).toLocaleString()}`);
      });
    }

    // 4. 检查是否有退水相关的栏位
    console.log('\n4. 检查退水相关栏位：');
    const rebateColumns = await db.query(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE column_name LIKE '%rebate%'
      ORDER BY table_name;
    `);
    
    console.log('退水相关栏位：');
    rebateColumns.forEach(col => {
      console.log(`  ${col.table_name}.${col.column_name}`);
    });

    // 5. 检查 agent_chain 栏位是否存在
    console.log('\n5. 检查 agent_chain 栏位：');
    const agentChainColumns = await db.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE column_name = 'agent_chain'
      ORDER BY table_name;
    `);
    
    if (agentChainColumns.length > 0) {
      console.log('找到 agent_chain 栏位：');
      agentChainColumns.forEach(col => {
        console.log(`  ${col.table_name}.${col.column_name} (${col.data_type})`);
      });
    } else {
      console.log('未找到 agent_chain 栏位');
    }

  } catch (error) {
    console.error('检查失败:', error.message);
  } finally {
    process.exit();
  }
}

checkMemberAgentRelation();