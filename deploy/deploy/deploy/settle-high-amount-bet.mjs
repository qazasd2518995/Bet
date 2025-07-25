// settle-high-amount-bet.mjs
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
    const periodNumberInt = parseInt(periodNumber);
    
    // 查詢開獎記錄
    const drawQuery = `
      SELECT * FROM draw_records 
      WHERE period = $1
    `;
    
    const drawResult = await client.query(drawQuery, [periodNumber]);
    
    if (drawResult.rows.length === 0) {
      console.log(`找不到期數 ${periodNumber} 的開獎記錄`);
      return;
    }
    
    const drawData = drawResult.rows[0];
    console.log(`期數 ${periodNumber} 的開獎記錄:`, drawData);
    
    // 獲取開獎結果
    const drawNumbers = drawData.result;
    console.log('\n開獎號碼:', drawNumbers);
    
    // 查詢未結算的下注記錄
    const betsQuery = `
      SELECT * FROM bet_history 
      WHERE period = $1 AND settled = false
    `;
    
    const betsResult = await client.query(betsQuery, [periodNumberInt]);
    console.log(`\n期數 ${periodNumber} 的未結算下注記錄:`, betsResult.rows.length);
    
    if (betsResult.rows.length === 0) {
      console.log('沒有未結算的下注記錄');
      return;
    }
    
    // 查詢ti888會員當前餘額
    const memberBeforeResult = await client.query('SELECT id, username, balance FROM members WHERE username = $1', ['ti888']);
    const memberBefore = memberBeforeResult.rows[0];
    const balanceBeforeSettlement = parseFloat(memberBefore.balance);
    console.log(`\n結算前餘額：ID=${memberBefore.id}, 用戶名=${memberBefore.username}, 當前餘額=${balanceBeforeSettlement}`);
    
    // 進行結算
    for (const bet of betsResult.rows) {
      // 獲取下注位置和下注值
      const position = bet.position - 1; // 0-based index
      const betValue = parseInt(bet.bet_value);
      
      // 檢查是否中獎
      const isWin = position < drawNumbers.length && drawNumbers[position] === betValue;
      
      // 獲取開獎位置的實際數字
      const actualNumber = drawNumbers[position];
      
      // 計算中獎金額
      const winAmount = isWin ? parseFloat(bet.amount) * parseFloat(bet.odds) : 0;
      
      console.log(`下注資訊: 位置=${bet.position}(索引${position}), 下注數字=${betValue}, 開獎數字=${actualNumber}, 是否中獎=${isWin}`);
      
      // 更新下注記錄
      await client.query(
        'UPDATE bet_history SET win = $1, win_amount = $2, settled = true WHERE id = $3',
        [isWin, winAmount, bet.id]
      );
      
      // 如果中獎，更新會員餘額
      if (isWin) {
        await client.query(
          'UPDATE members SET balance = balance + $1 WHERE username = $2',
          [winAmount, bet.username]
        );
        
        // 插入獎金入帳交易記錄
        const memberResult = await client.query('SELECT id, balance FROM members WHERE username = $1', [bet.username]);
        const memberId = memberResult.rows[0].id;
        const balanceAfterWin = parseFloat(memberResult.rows[0].balance);
        const balanceBeforeWin = balanceAfterWin - winAmount;
        
        const now = new Date();
        await client.query(
          'INSERT INTO transaction_records (user_type, user_id, transaction_type, amount, balance_before, balance_after, description, created_at, member_username, period) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
          ['member', memberId, 'win', winAmount, balanceBeforeWin, balanceAfterWin, `中獎 ${periodNumber} 期，第${bet.position}名 數字${bet.bet_value}，獎金${winAmount}元`, now, bet.username, periodNumber]
        );
      }
      
      console.log(`已結算下注ID=${bet.id}, 用戶=${bet.username}, 下注=${bet.bet_type}${bet.bet_value}, 位置=${bet.position}, 金額=${bet.amount}, 是否中獎=${isWin}, 獎金=${winAmount}`);
    }
    
    // 查詢結算後的下注記錄
    const settledBetsQuery = `
      SELECT * FROM bet_history 
      WHERE period = $1 AND settled = true
    `;
    
    const settledBetsResult = await client.query(settledBetsQuery, [periodNumberInt]);
    console.log(`\n期數 ${periodNumber} 的已結算下注記錄:`, settledBetsResult.rows.length);
    settledBetsResult.rows.forEach(bet => {
      console.log(bet);
    });
    
    // 查詢ti888會員結算後餘額
    const memberAfterResult = await client.query('SELECT id, username, balance FROM members WHERE username = $1', ['ti888']);
    const memberAfter = memberAfterResult.rows[0];
    const balanceAfterSettlement = parseFloat(memberAfter.balance);
    console.log(`\n結算後餘額：ID=${memberAfter.id}, 用戶名=${memberAfter.username}, 當前餘額=${balanceAfterSettlement}`);
    console.log(`餘額變化：${balanceBeforeSettlement} -> ${balanceAfterSettlement} (差額：${balanceAfterSettlement - balanceBeforeSettlement})`);
    
    // 查詢近期交易記錄
    const txResult = await client.query(`
      SELECT * FROM transaction_records 
      WHERE member_username = $1 
      ORDER BY created_at DESC 
      LIMIT 5
    `, ['ti888']);
    console.log('\n近期交易記錄:');
    txResult.rows.forEach(row => {
      console.log(row);
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
