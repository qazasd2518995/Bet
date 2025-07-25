import db from './db/config.js';

async function checkDatabaseStructure() {
  try {
    console.log('=== 檢查資料庫結構 ===\n');

    // 1. 檢查 agents 表結構
    console.log('1. agents 表結構：');
    const agentsColumns = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'agents'
      ORDER BY ordinal_position;
    `);
    
    console.log('Columns:');
    agentsColumns.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
    });

    // 2. 檢查 members 表結構
    console.log('\n2. members 表結構：');
    const membersColumns = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'members'
      ORDER BY ordinal_position;
    `);
    
    console.log('Columns:');
    membersColumns.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
    });

    // 3. 檢查代理資料和盤口類型
    console.log('\n3. 檢查代理資料：');
    const agents = await db.query(`
      SELECT *
      FROM agents
      WHERE username IN ('win1688', 'ti2025A', 'ddd22', 'mj1688')
      ORDER BY level;
    `);
    
    console.log('代理資料：');
    agents.forEach(agent => {
      console.log(`\n  ${agent.username}:`);
      Object.keys(agent).forEach(key => {
        if (agent[key] !== null) {
          console.log(`    ${key}: ${agent[key]}`);
        }
      });
    });

    // 4. 檢查會員資料和盤口
    console.log('\n4. 檢查會員 justin2025A：');
    const member = await db.query(`
      SELECT m.*, a.username as agent_username
      FROM members m
      JOIN agents a ON m.agent_id = a.id
      WHERE m.username = 'justin2025A';
    `);
    
    if (member.length > 0) {
      console.log('會員資料：');
      Object.keys(member[0]).forEach(key => {
        if (member[0][key] !== null) {
          console.log(`  ${key}: ${member[0][key]}`);
        }
      });
    }

  } catch (error) {
    console.error('檢查失敗:', error);
  } finally {
    process.exit();
  }
}

checkDatabaseStructure();