import db from './db/config.js';
import { processRebates } from './enhanced-settlement-system.js';

async function manualProcessRebate() {
  try {
    console.log('=== 手動處理期號 20250715107 的退水 ===');
    
    // 1. 檢查該期的下注情況
    console.log('\n1. 檢查該期下注情況:');
    const bets = await db.any(`
      SELECT username, SUM(amount) as total_amount, COUNT(*) as bet_count
      FROM bet_history
      WHERE period = $1 AND settled = true
      GROUP BY username
    `, ['20250715107']);
    
    console.log(`期號 20250715107 共有 ${bets.length} 位會員下注:`);
    for (const bet of bets) {
      console.log(`- ${bet.username}: ${bet.bet_count} 筆，總額 ${bet.total_amount} 元`);
    }
    
    // 2. 檢查是否已有退水記錄
    console.log('\n2. 檢查現有退水記錄:');
    const existingRebates = await db.any(`
      SELECT COUNT(*) as count
      FROM transaction_records
      WHERE transaction_type = 'rebate' AND period = $1
    `, ['20250715107']);
    
    if (existingRebates[0].count > 0) {
      console.log(`該期已有 ${existingRebates[0].count} 筆退水記錄，跳過處理`);
      process.exit(0);
    }
    
    // 3. 執行退水處理
    console.log('\n3. 開始處理退水...');
    try {
      await processRebates('20250715107');
      console.log('✅ 退水處理成功');
    } catch (error) {
      console.error('退水處理失敗:', error);
      
      // 如果自動處理失敗，嘗試手動計算
      console.log('\n嘗試手動計算退水...');
      await manualCalculateRebate(bets);
    }
    
    // 4. 驗證結果
    console.log('\n4. 驗證退水結果:');
    const newRebates = await db.any(`
      SELECT 
        tr.amount,
        tr.description,
        CASE 
          WHEN tr.user_type = 'agent' THEN a.username
          ELSE 'unknown'
        END as username
      FROM transaction_records tr
      LEFT JOIN agents a ON tr.user_type = 'agent' AND tr.user_id = a.id
      WHERE tr.transaction_type = 'rebate' AND tr.period = $1
      ORDER BY tr.created_at
    `, ['20250715107']);
    
    if (newRebates.length > 0) {
      console.log('退水記錄:');
      let totalRebate = 0;
      for (const rebate of newRebates) {
        console.log(`- ${rebate.username}: ${rebate.amount} 元`);
        totalRebate += parseFloat(rebate.amount);
      }
      console.log(`總退水金額: ${totalRebate.toFixed(2)} 元`);
    } else {
      console.log('⚠️ 沒有找到退水記錄');
    }
    
    // 5. 檢查最新餘額
    console.log('\n5. 最新代理餘額:');
    const agents = await db.any(`
      SELECT username, balance FROM agents 
      WHERE username IN ($1, $2)
      ORDER BY username
    `, ['justin2025A', 'ti2025A']);
    
    for (const agent of agents) {
      console.log(`${agent.username}: ${agent.balance} 元`);
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('錯誤:', error);
    process.exit(1);
  }
}

// 手動計算退水
async function manualCalculateRebate(bets) {
  for (const bet of bets) {
    if (bet.username === 'justin111') {
      const betAmount = parseFloat(bet.total_amount);
      const totalRebate = betAmount * 0.011; // A盤 1.1%
      
      console.log(`\n計算 ${bet.username} 的退水:`);
      console.log(`下注金額: ${betAmount}`);
      console.log(`總退水池: ${totalRebate.toFixed(2)} (1.1%)`);
      
      // justin2025A 獲得 0.5%
      const justin2025ARebate = betAmount * 0.005;
      console.log(`justin2025A 應獲得: ${justin2025ARebate.toFixed(2)} (0.5%)`);
      
      // ti2025A 獲得剩餘的 0.6%
      const ti2025ARebate = betAmount * 0.006;
      console.log(`ti2025A 應獲得: ${ti2025ARebate.toFixed(2)} (0.6%)`);
    }
  }
}

manualProcessRebate();