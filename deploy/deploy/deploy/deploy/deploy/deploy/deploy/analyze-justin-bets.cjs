const { Client } = require('pg');

// 生產環境資料庫連線設定
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

async function analyzeJustinBets() {
  const client = new Client(dbConfig);
  
  try {
    await client.connect();
    console.log('✅ 生產環境資料庫連線成功');
    
    // 獲取control開始期數後的所有投注和對應開獎結果
    const controlStartPeriod = '20250703375';
    
    const betAnalysisQuery = `
      SELECT 
        bh.period,
        bh.bet_type,
        bh.bet_value,
        bh.amount,
        bh.win,
        bh.settled,
        rh.result
      FROM bet_history bh
      LEFT JOIN result_history rh ON bh.period = rh.period
      WHERE bh.username = 'justin111' 
      AND bh.period >= $1
      AND bh.settled = true
      ORDER BY bh.period DESC, bh.created_at DESC
    `;
    
    const betResults = await client.query(betAnalysisQuery, [controlStartPeriod]);
    
    console.log(`\n📊 分析justin111會員從控制開始期數${controlStartPeriod}後的投注:\n`);
    
    if (betResults.rows.length > 0) {
      let totalWins = 0;
      let totalBets = betResults.rows.length;
      
      betResults.rows.forEach(bet => {
        const {period, bet_type, bet_value, amount, win, result} = bet;
        
        let analysis = '';
        let shouldWin = false;
        
        if (result && result.length === 10) {
          // 分析每種投注類型是否應該贏
          switch(bet_type) {
            case 'number':
              const betNumber = parseInt(bet_value);
              shouldWin = result.includes(betNumber);
              analysis = `投注${betNumber}號, 開獎[${result.join(',')}], ${shouldWin ? '包含' : '不包含'}該號碼`;
              break;
              
            case 'champion':
              shouldWin = result[0] == bet_value;
              analysis = `投注冠軍${bet_value}, 開獎冠軍${result[0]}`;
              break;
              
            case 'runnerup':
              if (bet_value === 'big') {
                shouldWin = result[1] >= 6;
                analysis = `投注亞軍大, 開獎亞軍${result[1]} (${shouldWin ? '≥6大' : '<6小'})`;
              } else if (bet_value === 'small') {
                shouldWin = result[1] <= 5;
                analysis = `投注亞軍小, 開獎亞軍${result[1]} (${shouldWin ? '≤5小' : '>5大'})`;
              }
              break;
              
            case 'tenth':
              if (bet_value === 'even') {
                shouldWin = result[9] % 2 === 0;
                analysis = `投注第10名雙, 開獎第10名${result[9]} (${shouldWin ? '雙數' : '單數'})`;
              } else if (bet_value === 'odd') {
                shouldWin = result[9] % 2 === 1;
                analysis = `投注第10名單, 開獎第10名${result[9]} (${shouldWin ? '單數' : '雙數'})`;
              }
              break;
              
            case 'sumValue':
              const sum = result[0] + result[1];
              if (bet_value === 'big') {
                shouldWin = sum >= 12;
                analysis = `投注冠亞和大, 冠軍${result[0]}+亞軍${result[1]}=${sum} (${shouldWin ? '≥12大' : '<12小'})`;
              } else if (bet_value === 'small') {
                shouldWin = sum <= 11;
                analysis = `投注冠亞和小, 冠軍${result[0]}+亞軍${result[1]}=${sum} (${shouldWin ? '≤11小' : '>11大'})`;
              } else if (bet_value === 'odd') {
                shouldWin = sum % 2 === 1;
                analysis = `投注冠亞和單, 冠軍${result[0]}+亞軍${result[1]}=${sum} (${shouldWin ? '單數' : '雙數'})`;
              } else if (bet_value === 'even') {
                shouldWin = sum % 2 === 0;
                analysis = `投注冠亞和雙, 冠軍${result[0]}+亞軍${result[1]}=${sum} (${shouldWin ? '雙數' : '單數'})`;
              } else if (!isNaN(bet_value)) {
                shouldWin = sum == bet_value;
                analysis = `投注冠亞和${bet_value}, 冠軍${result[0]}+亞軍${result[1]}=${sum}`;
              }
              break;
              
            case 'dragonTiger':
              if (bet_value.includes('dragon_1_10')) {
                shouldWin = result[0] > result[9];
                analysis = `投注龍(冠軍vs第10名), 冠軍${result[0]} vs 第10名${result[9]} (${shouldWin ? '龍勝' : '虎勝'})`;
              } else if (bet_value.includes('dragon_5_6')) {
                shouldWin = result[4] > result[5];
                analysis = `投注龍(第5名vs第6名), 第5名${result[4]} vs 第6名${result[5]} (${shouldWin ? '龍勝' : '虎勝'})`;
              }
              break;
              
            case 'position':
              // 快速投注
              analysis = `快速投注${bet_value}`;
              break;
              
            default:
              analysis = `未識別的投注類型: ${bet_type} ${bet_value}`;
          }
        }
        
        if (win) totalWins++;
        
        const controlEffect = shouldWin === win ? '✅控制正確' : (shouldWin ? '❌應贏但輸' : '❌應輸但贏');
        
        console.log(`期數${period}: ${bet_type} ${bet_value} ${amount}元 -> ${win ? '贏✅' : '輸❌'} | ${analysis} | ${controlEffect}`);
      });
      
      const winRate = (totalWins / totalBets * 100).toFixed(1);
      console.log(`\n📈 控制期間總結:`);
      console.log(`總投注: ${totalBets}筆`);
      console.log(`獲勝: ${totalWins}筆`);
      console.log(`勝率: ${winRate}%`);
      console.log(`\n💡 分析結論:`);
      
      if (parseFloat(winRate) < 70) {
        console.log('❌ 贏控制(100%)明顯失效！勝率過低，系統可能沒有正確執行控制邏輯');
      } else if (parseFloat(winRate) >= 90) {
        console.log('✅ 贏控制運作良好，勝率符合預期');
      } else {
        console.log('⚠️ 贏控制部分生效，但效果不夠理想');
      }
      
    } else {
      console.log('📝 控制期間內沒有已結算的投注記錄');
    }
    
  } catch (error) {
    console.error('❌ 分析過程中發生錯誤:', error.message);
  } finally {
    await client.end();
  }
}

analyzeJustinBets(); 