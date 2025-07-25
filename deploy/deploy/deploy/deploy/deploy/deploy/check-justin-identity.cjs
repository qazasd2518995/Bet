const { Pool } = require('pg');

// 本地數據庫配置
const dbConfig = {
  host: 'localhost',
  port: 5432,
  database: 'bet_game',
  user: 'justin',
  password: undefined,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
};

const db = new Pool(dbConfig);

async function checkJustinIdentity() {
  try {
    console.log('🔍 完整檢查 justin2025A 的身份和退水設定...\n');

    // 0. 先檢查資料庫結構
    console.log('0️⃣ 檢查資料庫表結構:');
    
    // 檢查bet_history表結構
    const betTableResult = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'bet_history'
      ORDER BY ordinal_position
    `);
    console.log('   bet_history表欄位:', betTableResult.rows.map(r => r.column_name).join(', '));

    // 1. 檢查是否為會員
    console.log('\n1️⃣ 檢查會員表中的 justin2025A:');
    const memberResult = await db.query(`
      SELECT id, username, agent_id, balance, status, market_type, created_at
      FROM members 
      WHERE username = 'justin2025A'
    `);
    
    if (memberResult.rows.length > 0) {
      const member = memberResult.rows[0];
      console.log(`   ✅ 找到會員: ID=${member.id}, agent_id=${member.agent_id}, 餘額=${member.balance}, 狀態=${member.status}, 盤口=${member.market_type}`);
      
      // 檢查會員的代理鏈
      if (member.agent_id) {
        console.log(`\n   🔗 會員 justin2025A 的代理鏈結構:`);
        let currentAgentId = member.agent_id;
        let level = 1;
        
        while (currentAgentId) {
          const agentResult = await db.query(`
            SELECT id, username, level, parent_id, rebate_mode, rebate_percentage, market_type
            FROM agents 
            WHERE id = $1
          `, [currentAgentId]);
          
          if (agentResult.rows.length === 0) break;
          
          const agent = agentResult.rows[0];
          console.log(`   L${level}: ${agent.username} (ID:${agent.id}, 模式:${agent.rebate_mode}, 比例:${(agent.rebate_percentage * 100).toFixed(1)}%, 盤口:${agent.market_type})`);
          
          currentAgentId = agent.parent_id;
          level++;
        }
      }
    } else {
      console.log('   ❌ 在會員表中未找到 justin2025A');
    }

    // 2. 檢查是否為代理
    console.log('\n2️⃣ 檢查代理表中的 justin2025A:');
    const agentResult = await db.query(`
      SELECT id, username, level, parent_id, rebate_mode, rebate_percentage, market_type, balance, status, created_at
      FROM agents 
      WHERE username = 'justin2025A'
    `);
    
    if (agentResult.rows.length > 0) {
      const agent = agentResult.rows[0];
      console.log(`   ✅ 找到代理: ID=${agent.id}, 等級=${agent.level}, parent_id=${agent.parent_id}`);
      console.log(`       退水模式: ${agent.rebate_mode}, 退水比例: ${(agent.rebate_percentage * 100).toFixed(1)}%`);
      console.log(`       盤口類型: ${agent.market_type}, 餘額: ${agent.balance}, 狀態: ${agent.status}`);
      
      // 檢查代理的上級鏈
      if (agent.parent_id) {
        console.log(`\n   🔗 代理 justin2025A 的上級代理鏈:`);
        let currentParentId = agent.parent_id;
        let level = 1;
        
        while (currentParentId) {
          const parentResult = await db.query(`
            SELECT id, username, level, parent_id, rebate_mode, rebate_percentage, market_type
            FROM agents 
            WHERE id = $1
          `, [currentParentId]);
          
          if (parentResult.rows.length === 0) break;
          
          const parent = parentResult.rows[0];
          console.log(`   上級L${level}: ${parent.username} (ID:${parent.id}, 模式:${parent.rebate_mode}, 比例:${(parent.rebate_percentage * 100).toFixed(1)}%, 盤口:${parent.market_type})`);
          
          currentParentId = parent.parent_id;
          level++;
        }
      }
    } else {
      console.log('   ❌ 在代理表中未找到 justin2025A');
    }

    // 3. 檢查期數20250702503的下注記錄（使用正確的欄位名）
    console.log('\n3️⃣ 檢查期數 20250702503 的下注記錄:');
    const betResult = await db.query(`
      SELECT period, username, amount, bet_type, bet_value, position, odds, win_amount, settled, created_at
      FROM bet_history 
      WHERE username = 'justin2025A' AND period = '20250702503'
      ORDER BY created_at
    `);
    
    console.log(`   找到 ${betResult.rows.length} 筆下注記錄:`);
    let totalBetAmount = 0;
    betResult.rows.forEach((bet, index) => {
      console.log(`   ${index + 1}. 金額:${bet.amount}, 類型:${bet.bet_type}, 值:${bet.bet_value}, 位置:${bet.position}, 賠率:${bet.odds}, 輸贏:${bet.win_amount}, 已結算:${bet.settled}`);
      totalBetAmount += parseFloat(bet.amount);
    });
    console.log(`   總下注金額: ${totalBetAmount} 元`);

    // 4. 檢查退水記錄
    console.log('\n4️⃣ 檢查相關的退水記錄:');
    
    // 檢查 ti2025A 的退水記錄
    const rebateResult = await db.query(`
      SELECT user_id, amount, description, member_username, bet_amount, rebate_percentage, period, created_at
      FROM transaction_records 
      WHERE transaction_type = 'rebate' 
      AND (member_username = 'justin2025A' OR period = '20250702503')
      ORDER BY created_at DESC
    `);
    
    console.log(`   找到 ${rebateResult.rows.length} 筆相關退水記錄:`);
    rebateResult.rows.forEach((record, index) => {
      console.log(`   ${index + 1}. 用戶ID:${record.user_id}, 金額:${record.amount}, 會員:${record.member_username}, 期數:${record.period}`);
      console.log(`       描述:${record.description}, 下注:${record.bet_amount}, 比例:${(record.rebate_percentage * 100).toFixed(1)}%`);
    });

    // 5. 分析問題
    console.log('\n🎯 問題分析:');
    
    if (memberResult.rows.length > 0 && agentResult.rows.length > 0) {
      console.log('   ❌ CRITICAL: justin2025A 同時存在於會員表和代理表！');
      console.log('   這是用戶名重複問題，會導致退水分配邏輯混亂。');
      console.log('   \n   解決方案：');
      console.log('   1. 修改其中一個的用戶名（建議將代理改名為 justin2025A_agent）');
      console.log('   2. 手動補發應得的退水金額');
      console.log('   3. 用戶名唯一性檢查已修復，防止未來重複');
    } else if (memberResult.rows.length > 0) {
      console.log('   ✅ justin2025A 是會員，應該通過代理鏈獲得退水');
      
      if (totalBetAmount > 0 && rebateResult.rows.length === 0) {
        console.log('   ❌ 應該產生退水但未找到退水記錄！');
      }
    } else if (agentResult.rows.length > 0) {
      console.log('   ✅ justin2025A 是代理，如果作為會員下注則退水邏輯特殊');
    } else {
      console.log('   ❌ CRITICAL: justin2025A 既不是會員也不是代理！');
      console.log('   這表示可能存在資料庫不一致性問題。');
    }

    // 6. 檢查本地資料庫是否和生產環境一致
    console.log('\n6️⃣ 檢查本地資料庫與Render環境的一致性:');
    console.log('   ⚠️  注意：本地測試結果可能與Render生產環境不同');
    console.log('   建議：直接連接Render資料庫進行檢查');

  } catch (error) {
    console.error('檢查過程發生錯誤:', error);
  } finally {
    await db.end();
  }
}

checkJustinIdentity(); 