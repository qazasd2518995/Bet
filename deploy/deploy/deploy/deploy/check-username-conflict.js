import db from './db/config.js';

async function checkUsernameConflict() {
  try {
    const username = 'justin2025A';
    
    console.log(`檢查用戶名 "${username}" 在各個表中的使用情況...\n`);
    
    // 檢查代理表
    const agent = await db.oneOrNone(`
      SELECT id, username, level, created_at 
      FROM agents 
      WHERE username = $1
    `, [username]);
    
    if (agent) {
      console.log('✅ 代理表中找到:');
      console.log('   ID:', agent.id);
      console.log('   用戶名:', agent.username);
      console.log('   等級:', agent.level);
      console.log('   創建時間:', agent.created_at);
      console.log('');
    } else {
      console.log('❌ 代理表中未找到');
    }
    
    // 檢查會員表
    const member = await db.oneOrNone(`
      SELECT id, username, agent_id, created_at 
      FROM members 
      WHERE username = $1
    `, [username]);
    
    if (member) {
      console.log('✅ 會員表中找到:');
      console.log('   ID:', member.id);
      console.log('   用戶名:', member.username);
      console.log('   代理ID:', member.agent_id);
      console.log('   創建時間:', member.created_at);
      console.log('');
    } else {
      console.log('❌ 會員表中未找到');
    }
    
    // 檢查子帳號表
    const subAccount = await db.oneOrNone(`
      SELECT id, username, parent_agent_id, created_at 
      FROM sub_accounts 
      WHERE username = $1
    `, [username]);
    
    if (subAccount) {
      console.log('✅ 子帳號表中找到:');
      console.log('   ID:', subAccount.id);
      console.log('   用戶名:', subAccount.username);
      console.log('   父代理ID:', subAccount.parent_agent_id);
      console.log('   創建時間:', subAccount.created_at);
      console.log('');
    } else {
      console.log('❌ 子帳號表中未找到');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('錯誤:', error);
    process.exit(1);
  }
}

checkUsernameConflict();
