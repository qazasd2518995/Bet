const { Client } = require('pg');

const db = new Client({
  host: 'localhost',
  port: 5432,
  database: 'bet_game',
  user: 'justin',
  password: ''
});

async function checkJustinIssue() {
  try {
    await db.connect();
    
    console.log('🔍 檢查 justin2025A 用戶名重複問題...\n');
    
    // 1. 檢查 justin2025A 作為會員
    console.log('👤 1. 檢查 justin2025A 會員記錄:');
    const memberResult = await db.query(`
      SELECT id, username, agent_id, balance, market_type, status
      FROM members 
      WHERE username = 'justin2025A'
    `);
    
    if (memberResult.rows.length === 0) {
      console.log('❌ 會員 justin2025A 不存在!');
    } else {
      const member = memberResult.rows[0];
      console.log(`✅ 會員ID: ${member.id}`);
      console.log(`✅ 用戶名: ${member.username}`);
      console.log(`✅ 代理ID: ${member.agent_id}`);
      console.log(`✅ 餘額: ${member.balance}`);
      console.log(`✅ 盤口類型: ${member.market_type}`);
    }
    console.log();
    
    // 2. 檢查 justin2025A 作為代理
    console.log('🕵️ 2. 檢查 justin2025A 代理記錄:');
    const agentResult = await db.query(`
      SELECT id, username, level, rebate_mode, rebate_percentage, parent_id
      FROM agents 
      WHERE username = 'justin2025A'
    `);
    
    if (agentResult.rows.length === 0) {
      console.log('✅ justin2025A 不是代理');
    } else {
      console.log('⚠️ 發現 justin2025A 同時也是代理!');
      agentResult.rows.forEach((agent, index) => {
        console.log(`   代理ID: ${agent.id}`);
        console.log(`   等級: ${agent.level}`);
        console.log(`   退水模式: ${agent.rebate_mode}`);
        console.log(`   退水比例: ${(agent.rebate_percentage * 100).toFixed(1)}%`);
        console.log(`   上級代理ID: ${agent.parent_id}`);
      });
    }
    console.log();
    
    // 3. 檢查期數20250702503的下注記錄
    console.log('💰 3. 檢查期數 20250702503 的下注記錄:');
    const betResult = await db.query(`
      SELECT COUNT(*) as bet_count, SUM(amount) as total_amount
      FROM bet_history 
      WHERE username = 'justin2025A' AND period = '20250702503'
    `);
    
    if (betResult.rows[0].bet_count > 0) {
      console.log(`✅ 找到 ${betResult.rows[0].bet_count} 筆下注記錄`);
      console.log(`✅ 總下注金額: ${betResult.rows[0].total_amount}元`);
    } else {
      console.log('❌ 沒有找到下注記錄');
    }
    console.log();
    
    // 4. 檢查代理鏈
    if (memberResult.rows.length > 0) {
      console.log('🔗 4. 檢查會員的代理鏈:');
      const agentChainResult = await db.query(`
        WITH RECURSIVE agent_chain AS (
          SELECT id, username, parent_id, level, rebate_mode, rebate_percentage, 0 as depth
          FROM agents 
          WHERE id = $1
          
          UNION ALL
          
          SELECT a.id, a.username, a.parent_id, a.level, a.rebate_mode, a.rebate_percentage, ac.depth + 1
          FROM agents a
          INNER JOIN agent_chain ac ON a.id = ac.parent_id
          WHERE ac.depth < 10
        )
        SELECT * FROM agent_chain ORDER BY depth;
      `, [memberResult.rows[0].agent_id]);
      
      agentChainResult.rows.forEach((agent, index) => {
        console.log(`L${index}: ${agent.username} (ID:${agent.id}, 模式:${agent.rebate_mode}, 比例:${(agent.rebate_percentage * 100).toFixed(1)}%)`);
      });
    }
    console.log();
    
    // 5. 總結問題
    console.log('🎯 問題分析:');
    
    const hasUsernameDuplication = memberResult.rows.length > 0 && agentResult.rows.length > 0;
    
    if (hasUsernameDuplication) {
      console.log('❌ 發現嚴重問題：justin2025A 既是會員也是代理！');
      console.log('❌ 這會導致系統邏輯混亂，退水分配可能失效');
      console.log('❌ 我們剛修復的用戶名唯一性檢查就是為了防止這種情況');
      console.log();
      console.log('💡 解決方案：');
      console.log('1. 🚨 立即將其中一個改名（建議將代理改名為 justin2025A_agent）');
      console.log('2. 🔧 確保新的用戶名唯一性檢查生效');
      console.log('3. 💰 手動補發遺漏的退水');
    } else {
      console.log('✅ 沒有用戶名重複問題');
      console.log('❓ 退水問題可能是其他原因導致');
    }
    
  } catch (error) {
    console.error('檢查過程中發生錯誤:', error);
  } finally {
    await db.end();
  }
}

checkJustinIssue(); 