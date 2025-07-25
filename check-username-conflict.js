import db from './db/config.js';

async function checkUsernameConflict() {
  try {
    const username = 'justin2025A';
    
    console.log(`检查用户名 "${username}" 在各个表中的使用情况...\n`);
    
    // 检查代理表
    const agent = await db.oneOrNone(`
      SELECT id, username, level, created_at 
      FROM agents 
      WHERE username = $1
    `, [username]);
    
    if (agent) {
      console.log('✅ 代理表中找到:');
      console.log('   ID:', agent.id);
      console.log('   用户名:', agent.username);
      console.log('   等级:', agent.level);
      console.log('   创建时间:', agent.created_at);
      console.log('');
    } else {
      console.log('❌ 代理表中未找到');
    }
    
    // 检查会员表
    const member = await db.oneOrNone(`
      SELECT id, username, agent_id, created_at 
      FROM members 
      WHERE username = $1
    `, [username]);
    
    if (member) {
      console.log('✅ 会员表中找到:');
      console.log('   ID:', member.id);
      console.log('   用户名:', member.username);
      console.log('   代理ID:', member.agent_id);
      console.log('   创建时间:', member.created_at);
      console.log('');
    } else {
      console.log('❌ 会员表中未找到');
    }
    
    // 检查子帐号表
    const subAccount = await db.oneOrNone(`
      SELECT id, username, parent_agent_id, created_at 
      FROM sub_accounts 
      WHERE username = $1
    `, [username]);
    
    if (subAccount) {
      console.log('✅ 子帐号表中找到:');
      console.log('   ID:', subAccount.id);
      console.log('   用户名:', subAccount.username);
      console.log('   父代理ID:', subAccount.parent_agent_id);
      console.log('   创建时间:', subAccount.created_at);
      console.log('');
    } else {
      console.log('❌ 子帐号表中未找到');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

checkUsernameConflict();
