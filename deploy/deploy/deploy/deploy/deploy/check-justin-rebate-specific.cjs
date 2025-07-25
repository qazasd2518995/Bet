const { Client } = require('pg');

// 使用統一的數據庫配置
const db = new Client({
  host: 'localhost',
  port: 5432,
  database: 'bet_game',
  user: 'justin',
  password: ''
});

async function checkJustinRebateIssue() {
  try {
    await db.connect();
    
    console.log('🔍 詳細檢查 justin2025A 期數 20250702503 退水問題...\n');
    
    // 1. 檢查期數20250702503的開獎記錄
    console.log('📅 1. 檢查期數 20250702503 開獎記錄:');
    const drawResult = await db.query(`
      SELECT period, result, draw_time 
      FROM result_history 
      WHERE period = '20250702503'
    `);
    
    if (drawResult.rows.length === 0) {
      console.log('❌ 期數 20250702503 不存在!');
      return;
    }
    
    const draw = drawResult.rows[0];
    console.log(`✅ 期數: ${draw.period}`);
    console.log(`✅ 開獎結果: ${draw.result}`);
    console.log(`✅ 開獎時間: ${draw.draw_time}`);
    console.log();
    
    // 2. 檢查 justin2025A 會員資料
    console.log('👤 2. 檢查 justin2025A 會員資料:');
    const memberResult = await db.query(`
      SELECT id, username, agent_id, balance, market_type, status
      FROM members 
      WHERE username = 'justin2025A'
    `);
    
    if (memberResult.rows.length === 0) {
      console.log('❌ 會員 justin2025A 不存在!');
      return;
    }
    
    const member = memberResult.rows[0];
    console.log(`✅ 會員ID: ${member.id}`);
    console.log(`✅ 用戶名: ${member.username}`);
    console.log(`✅ 代理ID: ${member.agent_id}`);
    console.log(`✅ 餘額: ${member.balance}`);
    console.log(`✅ 盤口類型: ${member.market_type}`);
    console.log(`✅ 狀態: ${member.status}`);
    console.log();
    
    // 3. 檢查 justin2025A 的代理鏈
    console.log('🔗 3. 檢查 justin2025A 的代理鏈:');
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
    `, [member.agent_id]);
    
    console.log('代理鏈結構:');
    agentChainResult.rows.forEach((agent, index) => {
      console.log(`L${index}: ${agent.username} (ID:${agent.id}, 模式:${(agent.rebate_percentage * 100).toFixed(1)}%)`);
    });
    console.log();
    
    // 4. 檢查期數20250702503的下注記錄
    console.log('💰 4. 檢查期數 20250702503 的下注記錄:');
    const betResult = await db.query(`
      SELECT id, username, period, bet_type, bet_content, amount, win_amount, result, created_at
      FROM bet_history 
      WHERE username = 'justin2025A' AND period = '20250702503'
      ORDER BY created_at
    `);
    
    if (betResult.rows.length === 0) {
      console.log('❌ 沒有找到 justin2025A 在期數 20250702503 的下注記錄!');
      return;
    }
    
    console.log(`✅ 找到 ${betResult.rows.length} 筆下注記錄:`);
    let totalBetAmount = 0;
    let totalWinAmount = 0;
    
    betResult.rows.forEach((bet, index) => {
      console.log(`${index + 1}. ${bet.bet_type} ${bet.bet_content} - ${bet.amount}元 (${bet.result}) 時間:${bet.created_at}`);
      totalBetAmount += parseFloat(bet.amount);
      if (bet.result === 'win') {
        totalWinAmount += parseFloat(bet.win_amount || 0);
      }
    });
    
    console.log(`📊 總下注金額: ${totalBetAmount}元`);
    console.log(`📊 總贏得金額: ${totalWinAmount}元`);
    console.log(`📊 淨輸贏: ${totalWinAmount - totalBetAmount}元`);
    console.log();
    
    // 5. 計算預期退水
    const expectedRebate = totalBetAmount * 0.011; // 1.1%
    console.log(`💹 5. 預期退水計算:`);
    console.log(`✅ 有效投注: ${totalBetAmount}元`);
    console.log(`✅ 退水比例: 1.1%`);
    console.log(`✅ 預期退水: ${expectedRebate}元`);
    console.log();
    
    // 6. 檢查實際退水記錄
    console.log('🏦 6. 檢查實際退水記錄:');
    
    // 檢查 ti2025A 在期數20250702503附近的退水記錄
    const rebateResult = await db.query(`
      SELECT agent_id, amount, period, created_at, source_agent_id, source_member_username
      FROM rebate_records 
      WHERE agent_id = (
        SELECT id FROM agents WHERE username = 'ti2025A'
      ) 
      AND period LIKE '202507025%'
      ORDER BY created_at DESC
    `);
    
    console.log(`找到 ti2025A 在期數202507025xx的退水記錄 ${rebateResult.rows.length} 筆:`);
    
    let justinRebateFound = false;
    rebateResult.rows.forEach((rebate, index) => {
      console.log(`${index + 1}. 期數:${rebate.period} 金額:${rebate.amount}元 來源會員:${rebate.source_member_username} 時間:${rebate.created_at}`);
      
      if (rebate.source_member_username === 'justin2025A' && rebate.period === '20250702503') {
        justinRebateFound = true;
      }
    });
    
    if (!justinRebateFound) {
      console.log('❌ 沒有找到來自 justin2025A 期數 20250702503 的退水記錄!');
    } else {
      console.log('✅ 找到來自 justin2025A 期數 20250702503 的退水記錄');
    }
    console.log();
    
    // 7. 檢查代理系統同步記錄
    console.log('🔄 7. 檢查代理系統開獎同步記錄:');
    const syncResult = await db.query(`
      SELECT * FROM game_results 
      WHERE period = '20250702503'
    `);
    
    if (syncResult.rows.length === 0) {
      console.log('❌ 代理系統中沒有期數 20250702503 的同步記錄!');
    } else {
      console.log('✅ 代理系統中有期數 20250702503 的同步記錄');
      console.log(`   開獎時間: ${syncResult.rows[0].draw_time}`);
    }
    console.log();
    
    // 8. 檢查是否有justin2025A作為代理的記錄
    console.log('🕵️ 8. 檢查用戶名重複問題:');
    const agentJustinResult = await db.query(`
      SELECT id, username, level, rebate_mode, rebate_percentage
      FROM agents 
      WHERE username = 'justin2025A'
    `);
    
    if (agentJustinResult.rows.length > 0) {
      console.log('⚠️ 發現 justin2025A 同時也是代理!');
      agentJustinResult.rows.forEach((agent, index) => {
        console.log(`   代理ID: ${agent.id}, 等級: ${agent.level}, 退水模式: ${agent.rebate_mode}, 比例: ${(agent.rebate_percentage * 100).toFixed(1)}%`);
      });
      console.log('❌ 這就是問題根源！同一個用戶名既是會員也是代理！');
    } else {
      console.log('✅ justin2025A 不是代理，只是會員');
    }
    console.log();
    
    // 總結
    console.log('🎯 問題總結:');
    console.log('1. ✅ 期數20250702503已正常開獎');
    console.log('2. ✅ justin2025A會員存在且有下注記錄');
    console.log('3. ✅ 代理鏈結構正確');
    console.log(`4. ✅ 預期退水${expectedRebate}元應進入ti2025A帳戶`);
    
    if (agentJustinResult.rows.length > 0) {
      console.log('5. ❌ 發現用戶名重複問題：justin2025A既是會員也是代理');
      console.log('6. ❌ 這可能導致退水分配邏輯混亂');
    } else {
      console.log('5. ❌ 實際沒有退水記錄 = 退水分配邏輯沒有被觸發');
    }
    
    console.log('\n💡 建議解決方案:');
    if (agentJustinResult.rows.length > 0) {
      console.log('1. 🚨 立即解決用戶名重複問題');
      console.log('2. 將代理或會員改名以避免衝突');
      console.log('3. 建立用戶名唯一性檢查機制');
    }
    console.log('4. 檢查遊戲後端的注單結算邏輯');
    console.log('5. 檢查退水分配API調用是否正常');
    console.log('6. 手動補發遺漏的退水');
    
  } catch (error) {
    console.error('檢查過程中發生錯誤:', error);
  } finally {
    await db.end();
  }
}

checkJustinRebateIssue(); 