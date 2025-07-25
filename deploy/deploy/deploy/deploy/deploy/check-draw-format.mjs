// check-draw-format.mjs
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
    
    // 設置期數
    const periodNumber = '20250708098'; // 使用我們剛才下注的期數
    
    // 查詢開獎記錄
    const drawQuery = `
      SELECT * FROM draw_records 
      WHERE period = $1
    `;
    
    const drawResult = await client.query(drawQuery, [periodNumber]);
    
    if (drawResult.rows.length > 0) {
      console.log(`期數 ${periodNumber} 的開獎記錄:`);
      const drawData = drawResult.rows[0];
      console.log(drawData);
      
      console.log('\n開獎結果類型:', typeof drawData.result);
      console.log('開獎結果原始值:', drawData.result);
      
      // 嘗試解析開獎結果
      let drawNumbers;
      try {
        // 如果result是字串，嘗試解析
        if (typeof drawData.result === 'string') {
          drawNumbers = JSON.parse(drawData.result);
        } 
        // 如果result已經是物件或陣列，直接使用
        else if (typeof drawData.result === 'object') {
          drawNumbers = drawData.result;
        }
        // 如果是其他類型，直接輸出
        else {
          drawNumbers = drawData.result;
        }
        
        console.log('\n解析後的開獎結果:', drawNumbers);
      } catch (e) {
        console.error('解析開獎結果時出錯:', e);
      }
    } else {
      console.log(`找不到期數 ${periodNumber} 的開獎記錄`);
    }
    
    // 查詢未結算的下注記錄
    const periodNumberInt = parseInt(periodNumber);
    const betsQuery = `
      SELECT * FROM bet_history 
      WHERE period = $1 AND settled = false
    `;
    
    const betsResult = await client.query(betsQuery, [periodNumberInt]);
    console.log(`\n期數 ${periodNumber} 的未結算下注記錄:`, betsResult.rows.length);
    betsResult.rows.forEach(bet => {
      console.log(bet);
    });
    
    // 查詢已結算的下注記錄
    const settledQuery = `
      SELECT * FROM bet_history 
      WHERE period = $1 AND settled = true
    `;
    
    const settledResult = await client.query(settledQuery, [periodNumberInt]);
    console.log(`\n期數 ${periodNumber} 的已結算下注記錄:`, settledResult.rows.length);
    settledResult.rows.forEach(bet => {
      console.log(bet);
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
