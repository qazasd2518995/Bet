// check-database-tables.mjs
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
    
    // 查詢所有表格
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;
    
    const tablesResult = await client.query(tablesQuery);
    console.log('資料庫中的表格:');
    tablesResult.rows.forEach(row => {
      console.log(`- ${row.table_name}`);
    });
    
    // 檢查投注記錄表結構
    const betTableQuery = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'bets' OR table_name = 'bet_history'
      ORDER BY table_name, ordinal_position;
    `;
    
    const betTableResult = await client.query(betTableQuery);
    console.log('\n投注記錄表結構:');
    let currentTable = '';
    betTableResult.rows.forEach(row => {
      if (currentTable !== row.table_name) {
        currentTable = row.table_name;
        console.log(`\n表格: ${currentTable}`);
      }
      console.log(`- ${row.column_name}: ${row.data_type}`);
    });
    
    // 檢查近期下注記錄
    try {
      const recentBetsQuery = `
        SELECT * FROM bets 
        WHERE username = 'ti888' 
        ORDER BY created_at DESC 
        LIMIT 5;
      `;
      
      const recentBetsResult = await client.query(recentBetsQuery);
      console.log('\nti888的近期下注記錄 (bets表):');
      console.log(recentBetsResult.rows);
    } catch (error) {
      console.log('查詢bets表出錯:', error.message);
    }
    
    // 查詢交易記錄表結構
    const txTableQuery = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'transaction_logs'
      ORDER BY ordinal_position;
    `;
    
    const txTableResult = await client.query(txTableQuery);
    console.log('\n交易記錄表結構:');
    txTableResult.rows.forEach(row => {
      console.log(`- ${row.column_name}: ${row.data_type}`);
    });
    
    // 查詢開獎記錄表結構
    const drawTableQuery = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'draw_records'
      ORDER BY ordinal_position;
    `;
    
    const drawTableResult = await client.query(drawTableQuery);
    console.log('\n開獎記錄表結構:');
    drawTableResult.rows.forEach(row => {
      console.log(`- ${row.column_name}: ${row.data_type}`);
    });
    
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
