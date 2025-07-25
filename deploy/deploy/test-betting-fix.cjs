// 測試修正後的下注結算邏輯
const fetch = require('node-fetch');
const { Pool } = require('pg');
require('dotenv').config();

// 使用 Render 數據庫
const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

const pool = new Pool(dbConfig);

console.log('🔧 測試修正後的下注結算邏輯');

async function testBettingAndSettlement() {
  try {
    // 1. 檢查 justin111 當前餘額
    console.log('\n1. 檢查用戶當前狀態...');
    const balanceQuery = `
      SELECT username, balance 
      FROM users 
      WHERE username = 'justin111'
    `;
    const balanceResult = await pool.query(balanceQuery);
    
    if (balanceResult.rows.length === 0) {
      console.log('❌ 用戶 justin111 不存在');
      return;
    }
    
    const currentBalance = parseFloat(balanceResult.rows[0].balance);
    console.log(`💰 justin111 當前餘額: ${currentBalance}`);
    
    // 2. 檢查最近的下注記錄
    console.log('\n2. 檢查最近的下注記錄...');
    const betsQuery = `
      SELECT id, period, bet_type, bet_value, amount, odds, is_settled, is_win, win_amount, created_at
      FROM bets 
      WHERE username = 'justin111' 
      ORDER BY created_at DESC 
      LIMIT 10
    `;
    const betsResult = await pool.query(betsQuery);
    
    console.log(`📊 找到 ${betsResult.rows.length} 筆下注記錄:`);
    betsResult.rows.forEach((bet, index) => {
      console.log(`  ${index + 1}. 期數:${bet.period}, 類型:${bet.bet_type}, 值:${bet.bet_value}, 金額:${bet.amount}, 賠率:${bet.odds}, 已結算:${bet.is_settled}, 中獎:${bet.is_win}, 獎金:${bet.win_amount}`);
    });
    
    // 3. 檢查最近的遊戲結果
    console.log('\n3. 檢查最近的遊戲結果...');
    const gamesQuery = `
      SELECT period, result, created_at
      FROM games 
      ORDER BY period DESC 
      LIMIT 5
    `;
    const gamesResult = await pool.query(gamesQuery);
    
    console.log(`🎮 最近 ${gamesResult.rows.length} 期遊戲結果:`);
    gamesResult.rows.forEach((game, index) => {
      console.log(`  ${index + 1}. 期數:${game.period}, 結果:${game.result}, 時間:${game.created_at}`);
    });
    
    // 4. 模擬下注邏輯驗證
    console.log('\n4. 模擬結算邏輯驗證...');
    
    // 假設：下注100元，賠率9.89，中獎
    const betAmount = 100;
    const odds = 9.89;
    const winAmount = betAmount * odds; // 989元（總回報）
    const netProfit = winAmount - betAmount; // 889元（純獎金）
    
    console.log(`📊 模擬計算:`);
    console.log(`  - 下注金額: ${betAmount} 元`);
    console.log(`  - 賠率: ${odds}`);
    console.log(`  - 總回報: ${winAmount} 元 (下注金額 × 賠率)`);
    console.log(`  - 純獎金: ${netProfit} 元 (總回報 - 下注金額)`);
    console.log(`  - 餘額變化: ${currentBalance} + ${winAmount} = ${currentBalance + winAmount}`);
    
    // 5. 驗證修正邏輯
    console.log('\n5. 修正前後對比:');
    console.log(`  修正前: 餘額增加 ${netProfit} 元 (錯誤邏輯，重複扣除本金)`);
    console.log(`  修正後: 餘額增加 ${winAmount} 元 (正確邏輯，返還總回報)`);
    console.log(`  差異: ${winAmount - netProfit} 元 (正好是下注本金)`);
    
    // 6. 檢查今日盈虧計算邏輯
    console.log('\n6. 檢查今日盈虧計算...');
    const today = new Date().toISOString().split('T')[0];
    const profitQuery = `
      SELECT 
        COUNT(*) as total_bets,
        SUM(amount) as total_bet_amount,
        SUM(CASE WHEN is_win THEN win_amount ELSE 0 END) as total_win_amount,
        SUM(CASE WHEN is_win THEN win_amount - amount ELSE -amount END) as net_profit
      FROM bets 
      WHERE username = 'justin111' 
        AND DATE(created_at) = $1
        AND is_settled = true
    `;
    const profitResult = await pool.query(profitQuery, [today]);
    
    if (profitResult.rows.length > 0) {
      const stats = profitResult.rows[0];
      console.log(`📈 今日統計 (${today}):`);
      console.log(`  - 總下注筆數: ${stats.total_bets}`);
      console.log(`  - 總下注金額: ${stats.total_bet_amount} 元`);
      console.log(`  - 總中獎金額: ${stats.total_win_amount} 元`);
      console.log(`  - 淨盈虧: ${stats.net_profit} 元`);
      
      // 驗證計算邏輯
      const expectedNetProfit = parseFloat(stats.total_win_amount) - parseFloat(stats.total_bet_amount);
      console.log(`  - 驗證計算: ${stats.total_win_amount} - ${stats.total_bet_amount} = ${expectedNetProfit}`);
      console.log(`  - 計算正確: ${Math.abs(expectedNetProfit - parseFloat(stats.net_profit)) < 0.01 ? '✅' : '❌'}`);
    }
    
  } catch (error) {
    console.error('❌ 測試過程中發生錯誤:', error);
  } finally {
    await pool.end();
  }
}

// 執行測試
testBettingAndSettlement();
