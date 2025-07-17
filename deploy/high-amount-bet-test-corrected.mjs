// high-amount-bet-test-corrected.mjs
import pg from 'pg';

// 資料庫連接配置
const dbConfig = {
  host: 'dpg-d0e2imc9c44c73che3kg-a.oregon-postgres.render.com',
  port: 5432,
  database: 'bet_game',
  user: 'bet_game_user',
  password: 'Vm4J5g1gymwPfBNcgYfGCe4GEZqCjoIy',
  ssl: {
    rejectUnauthorized: false
  }
};

async function main() {
  const client = new pg.Client(dbConfig);
  
  try {
    // 連接到資料庫
    await client.connect();
    console.log('成功連接到PostgreSQL資料庫');
    
    // 查詢ti888會員現有餘額
    const memberResult = await client.query('SELECT id, username, balance FROM members WHERE username = $1', ['ti888']);
    
    if (memberResult.rows.length === 0) {
      console.log('找不到ti888會員');
      await client.end();
      return;
    }
    
    const member = memberResult.rows[0];
    const memberId = member.id;
    const initialBalance = parseFloat(member.balance);
    console.log(`會員資訊：ID=${member.id}, 用戶名=${member.username}, 當前餘額=${initialBalance}`);
    
    // 為ti888會員建立一筆10000元的下注
    const betAmount = 8000; // 下注金額
    const now = new Date();
    const periodNumber = '202507080' + String(Math.floor(Math.random() * 90) + 10); // 確保是8位數
    const periodNumberInt = parseInt(periodNumber);
    
    // 記錄下注前餘額
    const balanceBeforeBet = initialBalance;
    const balanceAfterBet = initialBalance - betAmount;
    
    // 更新會員餘額
    await client.query(
      'UPDATE members SET balance = balance - $1 WHERE username = $2',
      [betAmount, 'ti888']
    );
    
    // 插入下注記錄
    await client.query(
      'INSERT INTO bet_history (username, bet_type, bet_value, position, amount, odds, period, win, win_amount, settled, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
      ['ti888', 'number', '1', 1, betAmount, 9.89, periodNumberInt, false, 0, false, now]
    );
    
    // 插入交易記錄
    await client.query(
      'INSERT INTO transaction_records (user_type, user_id, transaction_type, amount, balance_before, balance_after, description, created_at, member_username, period) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      ['member', memberId, 'bet', -betAmount, balanceBeforeBet, balanceAfterBet, `下注第${periodNumber}期，第一名 數字1，金額${betAmount}元`, now, 'ti888', periodNumber]
    );
    
    // 再次查詢餘額確認
    const updatedMemberResult = await client.query('SELECT id, username, balance FROM members WHERE username = $1', ['ti888']);
    const updatedBalance = parseFloat(updatedMemberResult.rows[0].balance);
    console.log(`下注後餘額：ID=${updatedMemberResult.rows[0].id}, 用戶名=${updatedMemberResult.rows[0].username}, 當前餘額=${updatedBalance}`);
    console.log(`餘額變化：${initialBalance} - ${betAmount} = ${updatedBalance} (差額：${initialBalance - updatedBalance})`);
    
    // 查詢剛才插入的下注記錄
    const betResult = await client.query('SELECT * FROM bet_history WHERE username = $1 AND period = $2', ['ti888', periodNumberInt]);
    console.log('\n新增的下注記錄:');
    console.log(betResult.rows[0]);
    
    // 查詢近期交易記錄
    const txResult = await client.query(`
      SELECT * FROM transaction_records 
      WHERE member_username = $1 
      ORDER BY created_at DESC 
      LIMIT 3
    `, ['ti888']);
    console.log('\n近期交易記錄:');
    txResult.rows.forEach(row => {
      console.log(row);
    });
    
    console.log(`\n成功為ti888會員建立${betAmount}元下注記錄，期數: ${periodNumber}`);
    console.log('完成高額下注測試，請驗證餘額變化和下注記錄是否正確');
    
  } catch (error) {
    console.error('發生錯誤:', error);
  } finally {
    // 關閉客戶端連接
    await client.end();
    console.log('\n資料庫連接已關閉');
  }
}

// 執行主函數
main().catch(console.error);
