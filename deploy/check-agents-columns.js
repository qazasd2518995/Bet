import db from './db/config.js';

async function checkAgentsColumns() {
  try {
    // 检查agents表的所有栏位
    const columns = await db.any(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'agents' 
      ORDER BY ordinal_position
    `);
    
    console.log('agents表的栏位:');
    columns.forEach(col => {
      console.log(`- ${col.column_name} (${col.data_type})`);
    });
    
    // 查找ti2025A和ti2025D
    console.log('\n查找总代理 ti2025A 和 ti2025D...');
    const agents = await db.any(`
      SELECT * FROM agents 
      WHERE username IN ('ti2025A', 'ti2025D')
      LIMIT 5
    `);
    
    if (agents.length > 0) {
      console.log(`\n找到 ${agents.length} 个代理:`);
      agents.forEach(agent => {
        console.log(`\n帐号: ${agent.username}`);
        console.log(`ID: ${agent.id}`);
        console.log(`当前限红等级: ${agent.betting_limit_level || '未设定'}`);
      });
    } else {
      console.log('\n未找到指定的代理');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

checkAgentsColumns();