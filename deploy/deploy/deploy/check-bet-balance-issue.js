import db from './db/config.js';

async function checkBetBalanceIssue() {
  try {
    console.log('=== 檢查下注餘額問題 ===');
    
    // 1. 檢查期號 20250715107 的下注記錄
    console.log('\n1. 檢查期號 20250715107 的下注記錄:');
    const bets = await db.any(`
      SELECT * FROM bet_history 
      WHERE period = $1 
      ORDER BY created_at DESC
    `, ['20250715107']);
    
    console.log(`找到 ${bets.length} 筆下注記錄`);
    for (const bet of bets) {
      console.log(`\nID: ${bet.id}`);
      console.log(`用戶: ${bet.username}`);
      console.log(`金額: ${bet.amount}`);
      console.log(`類型: ${bet.bet_type} - ${bet.bet_value}`);
      console.log(`位置: ${bet.position}`);
      console.log(`賠率: ${bet.odds}`);
      console.log(`結算: ${bet.settled ? '是' : '否'}`);
      console.log(`中獎: ${bet.win ? '是' : '否'}`);
      console.log(`創建時間: ${bet.created_at}`);
    }
    
    // 2. 檢查 justin111 的交易記錄
    console.log('\n2. 檢查 justin111 最近的交易記錄:');
    const transactions = await db.any(`
      SELECT * FROM transaction_records 
      WHERE user_type = 'member' 
        AND user_id = (SELECT id FROM members WHERE username = 'justin111')
        AND created_at > NOW() - INTERVAL '1 hour'
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    for (const tx of transactions) {
      console.log(`\n時間: ${tx.created_at}`);
      console.log(`類型: ${tx.transaction_type}`);
      console.log(`金額: ${tx.amount}`);
      console.log(`餘額前: ${tx.balance_before}`);
      console.log(`餘額後: ${tx.balance_after}`);
      console.log(`描述: ${tx.description}`);
    }
    
    // 3. 檢查當前餘額
    console.log('\n3. 當前餘額:');
    const member = await db.oneOrNone('SELECT username, balance FROM members WHERE username = $1', ['justin111']);
    const agents = await db.any(`
      SELECT username, balance FROM agents 
      WHERE username IN ($1, $2)
      ORDER BY username
    `, ['justin2025A', 'ti2025A']);
    
    if (member) {
      console.log(`justin111: ${member.balance} 元`);
    }
    
    for (const agent of agents) {
      console.log(`${agent.username}: ${agent.balance} 元`);
    }
    
    // 4. 檢查該期號的結算狀態
    console.log('\n4. 檢查期號 20250715107 的結算狀態:');
    const drawResult = await db.oneOrNone(`
      SELECT * FROM result_history 
      WHERE period = $1
    `, ['20250715107']);
    
    if (drawResult) {
      console.log('開獎結果:', drawResult.result);
      console.log('開獎時間:', drawResult.created_at);
    } else {
      console.log('該期號尚未開獎');
    }
    
    // 5. 檢查是否有退水記錄
    console.log('\n5. 檢查該期號的退水記錄:');
    const rebates = await db.any(`
      SELECT * FROM transaction_records 
      WHERE transaction_type = 'rebate' 
        AND period = $1
      ORDER BY created_at DESC
    `, ['20250715107']);
    
    console.log(`找到 ${rebates.length} 筆退水記錄`);
    for (const rebate of rebates) {
      const user = await db.oneOrNone(
        rebate.user_type === 'agent' 
          ? 'SELECT username FROM agents WHERE id = $1'
          : 'SELECT username FROM members WHERE id = $1',
        [rebate.user_id]
      );
      console.log(`${rebate.created_at}: ${user?.username || '未知'} 獲得退水 ${rebate.amount} 元`);
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('錯誤:', error);
    process.exit(1);
  }
}

checkBetBalanceIssue();