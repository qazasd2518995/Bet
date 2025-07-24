import db from './db/config.js';

async function checkAgentsColumns() {
  try {
    // 檢查agents表的所有欄位
    const columns = await db.any(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'agents' 
      ORDER BY ordinal_position
    `);
    
    console.log('agents表的欄位:');
    columns.forEach(col => {
      console.log(`- ${col.column_name} (${col.data_type})`);
    });
    
    // 查找ti2025A和ti2025D
    console.log('\n查找總代理 ti2025A 和 ti2025D...');
    const agents = await db.any(`
      SELECT * FROM agents 
      WHERE username IN ('ti2025A', 'ti2025D')
      LIMIT 5
    `);
    
    if (agents.length > 0) {
      console.log(`\n找到 ${agents.length} 個代理:`);
      agents.forEach(agent => {
        console.log(`\n帳號: ${agent.username}`);
        console.log(`ID: ${agent.id}`);
        console.log(`當前限紅等級: ${agent.betting_limit_level || '未設定'}`);
      });
    } else {
      console.log('\n未找到指定的代理');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('錯誤:', error);
    process.exit(1);
  }
}

checkAgentsColumns();