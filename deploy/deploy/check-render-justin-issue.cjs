const { Client } = require('pg');

// Render PostgreSQL 配置 (需要您提供實際的連接信息)
const renderDb = new Client({
  host: 'dpg-ct4sah4gph6c73bqr0u0-a.oregon-postgres.render.com',
  port: 5432,
  database: 'bet_game_9hth',
  user: 'bet_game_9hth_user',
  password: 'u6WDMWG6GCLFbBLe3bhNrWnRdMNd6qGQ',
  ssl: { rejectUnauthorized: false }
});

async function checkRenderJustinIssue() {
  try {
    await renderDb.connect();
    
    console.log('🔍 檢查 Render 環境中 justin2025A 的問題...\n');
    
    // 1. 檢查 justin2025A 作為會員
    console.log('👤 1. 檢查 justin2025A 會員記錄:');
    const memberResult = await renderDb.query(`
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
      console.log(`✅ 狀態: ${member.status}`);
    }
    console.log();
    
    // 2. 檢查 justin2025A 作為代理
    console.log('🕵️ 2. 檢查 justin2025A 代理記錄:');
    const agentResult = await renderDb.query(`
      SELECT id, username, level, rebate_mode, rebate_percentage, parent_id, balance
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
        console.log(`   餘額: ${agent.balance}`);
      });
    }
    console.log();
    
    // 3. 檢查期數20250702503的下注記錄
    console.log('💰 3. 檢查期數 20250702503 的下注記錄:');
    const betResult = await renderDb.query(`
      SELECT id, username, period, bet_type, bet_content, amount, win_amount, result, created_at
      FROM bet_history 
      WHERE username = 'justin2025A' AND period = '20250702503'
      ORDER BY created_at
    `);
    
    if (betResult.rows.length === 0) {
      console.log('❌ 沒有找到下注記錄');
    } else {
      console.log(`✅ 找到 ${betResult.rows.length} 筆下注記錄:`);
      let totalAmount = 0;
      betResult.rows.forEach((bet, index) => {
        console.log(`${index + 1}. ${bet.bet_type} ${bet.bet_content} - ${bet.amount}元 (${bet.result})`);
        totalAmount += parseFloat(bet.amount);
      });
      console.log(`📊 總下注金額: ${totalAmount}元`);
      console.log(`📊 預期退水: ${(totalAmount * 0.011).toFixed(2)}元 (1.1%)`);
    }
    console.log();
    
    // 4. 檢查代理鏈
    if (memberResult.rows.length > 0) {
      console.log('🔗 4. 檢查會員的代理鏈:');
      const agentChainResult = await renderDb.query(`
        WITH RECURSIVE agent_chain AS (
          SELECT id, username, parent_id, level, rebate_mode, rebate_percentage, balance, 0 as depth
          FROM agents 
          WHERE id = $1
          
          UNION ALL
          
          SELECT a.id, a.username, a.parent_id, a.level, a.rebate_mode, a.rebate_percentage, a.balance, ac.depth + 1
          FROM agents a
          INNER JOIN agent_chain ac ON a.id = ac.parent_id
          WHERE ac.depth < 10
        )
        SELECT * FROM agent_chain ORDER BY depth;
      `, [memberResult.rows[0].agent_id]);
      
      agentChainResult.rows.forEach((agent, index) => {
        console.log(`L${index}: ${agent.username} (ID:${agent.id}, 模式:${agent.rebate_mode}, 比例:${(agent.rebate_percentage * 100).toFixed(1)}%, 餘額:${agent.balance})`);
      });
    }
    console.log();
    
    // 5. 檢查 ti2025A 的餘額變化
    console.log('💰 5. 檢查 ti2025A 的當前狀態:');
    const ti2025aResult = await renderDb.query(`
      SELECT id, username, balance, rebate_percentage
      FROM agents 
      WHERE username = 'ti2025A'
    `);
    
    if (ti2025aResult.rows.length > 0) {
      const ti2025a = ti2025aResult.rows[0];
      console.log(`✅ ti2025A ID: ${ti2025a.id}`);
      console.log(`✅ ti2025A 餘額: ${ti2025a.balance}`);
      console.log(`✅ ti2025A 退水比例: ${(ti2025a.rebate_percentage * 100).toFixed(1)}%`);
    }
    console.log();
    
    // 6. 總結問題
    console.log('🎯 問題分析:');
    
    const hasUsernameDuplication = memberResult.rows.length > 0 && agentResult.rows.length > 0;
    const hasBetRecords = betResult.rows.length > 0;
    
    if (hasUsernameDuplication) {
      console.log('❌ 發現嚴重問題：justin2025A 既是會員也是代理！');
      console.log('❌ 這會導致系統邏輯混亂，退水分配可能失效');
      console.log();
      console.log('💡 立即解決方案：');
      console.log('1. 🚨 將代理改名為 justin2025A_agent');
      console.log('2. 🔧 確保用戶名唯一性檢查生效');
      if (hasBetRecords) {
        const totalAmount = betResult.rows.reduce((sum, bet) => sum + parseFloat(bet.amount), 0);
        console.log(`3. 💰 手動補發退水: ${(totalAmount * 0.011).toFixed(2)}元給ti2025A`);
      }
    } else if (memberResult.rows.length > 0 && hasBetRecords) {
      console.log('✅ 沒有用戶名重複問題');
      console.log('❓ 退水沒有分配的原因需要進一步調查');
      console.log('💡 建議檢查遊戲後端的退水分配邏輯');
    } else {
      console.log('❓ 會員或下注記錄不存在，請確認問題描述');
    }
    
  } catch (error) {
    console.error('檢查過程中發生錯誤:', error);
    console.log('\n⚠️ 可能需要：');
    console.log('1. 確認 Render 數據庫連接信息是否正確');
    console.log('2. 確認網絡連接正常');
    console.log('3. 檢查防火牆設置');
  } finally {
    await renderDb.end();
  }
}

checkRenderJustinIssue(); 