// check-specific-tables.mjs
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
    
    // 檢查bet_history表結構
    const betHistoryQuery = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'bet_history'
      ORDER BY ordinal_position;
    `;
    
    const betHistoryResult = await client.query(betHistoryQuery);
    console.log('bet_history表結構:');
    betHistoryResult.rows.forEach(row => {
      console.log(`- ${row.column_name}: ${row.data_type}`);
    });
    
    // 檢查近期下注記錄
    try {
      const recentBetsQuery = `
        SELECT * FROM bet_history 
        WHERE username = 'ti888' 
        ORDER BY created_at DESC 
        LIMIT 5;
      `;
      
      const recentBetsResult = await client.query(recentBetsQuery);
      console.log('\nti888的近期下注記錄 (bet_history表):');
      recentBetsResult.rows.forEach(row => {
        console.log(row);
      });
    } catch (error) {
      console.log('查詢bet_history表出錯:', error.message);
    }
    
    // 檢查transaction_records表結構
    const txRecordsQuery = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'transaction_records'
      ORDER BY ordinal_position;
    `;
    
    const txRecordsResult = await client.query(txRecordsQuery);
    console.log('\ntransaction_records表結構:');
    txRecordsResult.rows.forEach(row => {
      console.log(`- ${row.column_name}: ${row.data_type}`);
    });
    
    // 檢查近期交易記錄
    try {
      const recentTxQuery = `
        SELECT * FROM transaction_records 
        WHERE username = 'ti888' 
        ORDER BY created_at DESC 
        LIMIT 5;
      `;
      
      const recentTxResult = await client.query(recentTxQuery);
      console.log('\nti888的近期交易記錄 (transaction_records表):');
      recentTxResult.rows.forEach(row => {
        console.log(row);
      });
    } catch (error) {
      console.log('查詢transaction_records表出錯:', error.message);
    }
    
    // 檢查會員當前餘額
    const memberBalanceQuery = `
      SELECT id, username, balance 
      FROM members 
      WHERE username = 'ti888';
    `;
    
    const memberBalanceResult = await client.query(memberBalanceQuery);
    console.log('\nti888會員當前餘額:');
    console.log(memberBalanceResult.rows[0]);
    
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
