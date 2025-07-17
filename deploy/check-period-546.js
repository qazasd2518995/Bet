import db from './db/config.js';

async function checkPeriod546() {
  try {
    console.log('🔍 檢查期號 20250717546 的開獎和結算情況...\n');
    
    // 1. 查詢開獎結果
    const result = await db.oneOrNone(`
      SELECT * FROM result_history 
      WHERE period = '20250717546'
    `);
    
    if (result) {
      console.log('=== 開獎結果 ===');
      console.log('期號:', result.period);
      console.log('JSON結果:', result.result);
      console.log('各名次:');
      for (let i = 1; i <= 10; i++) {
        console.log(`  第${i}名: ${result[`position_${i}`]}`);
      }
      console.log('開獎時間:', result.created_at);
      console.log(`\n重點：第2名開出 ${result.position_2} 號\n`);
    } else {
      console.log('❌ 找不到期號 20250717546 的開獎記錄');
      return;
    }
    
    // 2. 查詢該期所有第2名的投注
    const bets = await db.manyOrNone(`
      SELECT id, username, bet_type, bet_value, position, amount, odds, 
             win, win_amount, settled, created_at, settled_at
      FROM bet_history
      WHERE period = '20250717546' 
        AND bet_type = 'number' 
        AND position = 2
      ORDER BY id
    `);
    
    console.log(`=== 第2名投注記錄 (共 ${bets.length} 筆) ===`);
    
    let correctWins = 0;
    let wrongWins = 0;
    
    bets.forEach((bet) => {
      const shouldWin = parseInt(bet.bet_value) === result.position_2;
      const actualWin = bet.win;
      const isCorrect = shouldWin === actualWin;
      
      console.log(`\nID ${bet.id}: 投注號碼 ${bet.bet_value}`);
      console.log(`  應該${shouldWin ? '中獎' : '未中'} (第2名=${result.position_2})`);
      console.log(`  實際${actualWin ? '中獎' : '未中'} ${isCorrect ? '✅' : '❌ 錯誤！'}`);
      
      if (actualWin && !shouldWin) {
        wrongWins++;
        console.log(`  ⚠️ 錯誤中獎：投注${bet.bet_value}不應該中獎`);
      } else if (!actualWin && shouldWin) {
        console.log(`  ⚠️ 錯誤未中：投注${bet.bet_value}應該中獎`);
      }
      
      if (isCorrect && shouldWin) correctWins++;
    });
    
    console.log(`\n統計：正確中獎 ${correctWins} 筆，錯誤中獎 ${wrongWins} 筆`);
    
    // 3. 查看結算日誌
    console.log('\n=== 結算日誌 ===');
    const logs = await db.manyOrNone(`
      SELECT * FROM settlement_logs 
      WHERE period = '20250717546'
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    if (logs.length > 0) {
      logs.forEach((log, i) => {
        console.log(`\n[${i+1}] ${log.created_at}`);
        console.log(`  狀態: ${log.status}`);
        console.log(`  訊息: ${log.message}`);
        if (log.details) {
          console.log(`  詳情: ${JSON.stringify(log.details).substring(0, 100)}...`);
        }
      });
    } else {
      console.log('沒有找到結算日誌');
    }
    
    // 4. 檢查開獎流程
    console.log('\n=== 檢查開獎流程 ===');
    
    // 查看最近的系統日誌中關於 546 期的記錄
    console.log('請檢查 server.log 中關於期號 546 的以下關鍵日誌：');
    console.log('1. [提前開獎] 相關日誌');
    console.log('2. [統一開獎] 相關日誌');
    console.log('3. [結果保存] 相關日誌');
    console.log('4. [結算執行] 相關日誌');
    
  } catch (error) {
    console.error('查詢失敗:', error);
  } finally {
    process.exit(0);
  }
}

checkPeriod546();