// high-amount-bet-test.mjs
import pg from 'pg';
import dotenv from 'dotenv';

// 載入環境變量
dotenv.config();

// 資料庫連接配置
const dbConfig = {
  host: 'dpg-d0e2imc9c44c73che3kg-a.oregon-postgres.render.com',
  port: 5432,
  database: 'bet_game',
  user: 'bet_game_user',
  password: 'Vm4J5g1gymwPfBNcgYfGCe4GEZqCjoIy',
  ssl: {
    rejectUnauthorized: false // 在開發環境中，可能需要設置為 false
  }
};

async function main() {
  // 創建客戶端
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
    console.log(`會員資訊：ID=${member.id}, 用戶名=${member.username}, 當前餘額=${member.balance}`);
    
    // 為ti888會員建立一筆10000元的下注
    const now = new Date();
    const periodNumber = '20250708' + String(Math.floor(Math.random() * 100) + 1).padStart(3, '0');
    
    // 插入下注記錄
    await client.query(
      'INSERT INTO bet_history (username, period_number, bet_position, market_type, bet_amount, odds, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      ['ti888', periodNumber, '第一名-1', 'A', 10000, 9.8, now]
    );
    
    // 更新會員餘額
    await client.query(
      'UPDATE members SET balance = balance - $1 WHERE username = $2',
      [10000, 'ti888']
    );
    
    // 再次查詢餘額確認
    const updatedMemberResult = await client.query('SELECT id, username, balance FROM members WHERE username = $1', ['ti888']);
    console.log(`下注後餘額：ID=${updatedMemberResult.rows[0].id}, 用戶名=${updatedMemberResult.rows[0].username}, 當前餘額=${updatedMemberResult.rows[0].balance}`);
    
    // 查詢剛才插入的下注記錄
    const betResult = await client.query('SELECT * FROM bet_history WHERE username = $1 AND period_number = $2', ['ti888', periodNumber]);
    console.log('下注記錄:', betResult.rows[0]);
    
    console.log('成功為ti888會員建立10000元下注記錄，期數:', periodNumber);
    
    // 同時將交易記錄插入transaction_logs表
    await client.query(
      'INSERT INTO transaction_logs (username, amount, type, description, created_at) VALUES ($1, $2, $3, $4, $5)',
      ['ti888', -10000, 'bet', `下注 ${periodNumber} 期 10000元`, now]
    );
    
    console.log('已將交易記錄插入到transaction_logs表');
    
    // 查詢近期交易記錄
    const txResult = await client.query('SELECT * FROM transaction_logs WHERE username = $1 ORDER BY created_at DESC LIMIT 3', ['ti888']);
    console.log('近期交易記錄:', txResult.rows);
    
  } catch (error) {
    console.error('發生錯誤:', error);
  } finally {
    // 關閉客戶端連接
    await client.end();
    console.log('資料庫連接已關閉');
  }
}

// 執行主函數
main().catch(console.error);
