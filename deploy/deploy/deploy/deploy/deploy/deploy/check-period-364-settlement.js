import db from './db/config.js';

async function checkPeriod364Settlement() {
  try {
    console.log('\n=== 檢查期號 20250714364 結算問題 ===\n');

    // 1. 檢查該期的開獎結果
    console.log('1. 檢查開獎結果:');
    const result = await db.oneOrNone(`
      SELECT * FROM result_history 
      WHERE period = $1
    `, [20250714364]);

    if (!result) {
      console.log('❌ 找不到期號 20250714364 的開獎結果！');
      return;
    }

    // 解析結果
    const resultArray = result.result.split ? result.result.split(',').map(Number) : result.result;
    console.log('開獎結果:', {
      period: result.period,
      result: resultArray,
      冠軍: resultArray[0],
      亞軍: resultArray[1],
      第三名: resultArray[2],
      第四名: resultArray[3],
      第五名: resultArray[4],
      第六名: resultArray[5],
      第七名: resultArray[6],
      第八名: resultArray[7],
      第九名: resultArray[8],
      第十名: resultArray[9],
      created_at: result.created_at
    });

    // 2. 檢查該期所有冠軍位置的投注
    console.log('\n2. 檢查冠軍位置的所有投注:');
    const championBets = await db.any(`
      SELECT 
        bh.id,
        bh.username,
        bh.bet_type,
        bh.bet_value,
        bh.position,
        bh.amount,
        bh.odds,
        bh.win,
        bh.win_amount,
        bh.settled,
        bh.settled_at
      FROM bet_history bh
      WHERE bh.period = $1 
        AND bh.position = 1
      ORDER BY bh.username, bh.bet_value
    `, [20250714364]);

    console.log(`\n找到 ${championBets.length} 筆冠軍投注`);

    // 按用戶分組顯示投注
    const betsByUser = {};
    championBets.forEach(bet => {
      if (!betsByUser[bet.username]) {
        betsByUser[bet.username] = [];
      }
      betsByUser[bet.username].push(bet);
    });

    const championNumber = resultArray[0]; // 冠軍號碼
    
    for (const [username, userBets] of Object.entries(betsByUser)) {
      console.log(`\n用戶 ${username} 的投注:`);
      userBets.forEach(bet => {
        const betNumber = parseInt(bet.bet_value);
        const shouldWin = betNumber === championNumber;
        const actualWin = bet.win === true;
        const statusIcon = actualWin ? '✅' : '❌';
        const correctIcon = shouldWin === actualWin ? '✓' : '✗';
        
        console.log(`  ${statusIcon} 投注號碼: ${bet.bet_value} | 金額: $${bet.amount} | 賠率: ${bet.odds} | 贏金: $${bet.win_amount || 0} | 結算: ${bet.settled ? '是' : '否'} | 正確性: ${correctIcon}`);
      });
    }

    // 3. 檢查結算邏輯
    console.log('\n3. 檢查結算邏輯問題:');
    
    // 檢查應該贏但標記為輸的投注
    const wrongLosses = championBets.filter(bet => {
      const betNumber = parseInt(bet.bet_value);
      return betNumber === championNumber && bet.win === false;
    });
    
    if (wrongLosses.length > 0) {
      console.log(`\n❌ 發現 ${wrongLosses.length} 筆應該贏但被標記為輸的投注！`);
      wrongLosses.forEach(bet => {
        console.log(`  - ID: ${bet.id}, 用戶: ${bet.username}, 號碼: ${bet.bet_value}, 冠軍結果: ${championNumber}`);
      });
    }

    // 檢查應該輸但標記為贏的投注
    const wrongWins = championBets.filter(bet => {
      const betNumber = parseInt(bet.bet_value);
      return betNumber !== championNumber && bet.win === true;
    });
    
    if (wrongWins.length > 0) {
      console.log(`\n❌ 發現 ${wrongWins.length} 筆應該輸但被標記為贏的投注！`);
      wrongWins.forEach(bet => {
        console.log(`  - ID: ${bet.id}, 用戶: ${bet.username}, 號碼: ${bet.bet_value}, 冠軍結果: ${championNumber}`);
      });
    }

    // 4. 檢查交易記錄
    console.log('\n4. 檢查相關交易記錄:');
    const transactions = await db.any(`
      SELECT 
        tr.id,
        tr.username,
        tr.type,
        tr.amount,
        tr.balance_before,
        tr.balance_after,
        tr.description,
        tr.created_at
      FROM transaction_records tr
      WHERE tr.period = $1
        AND tr.type IN ('settlement', 'bet', 'bet_win')
      ORDER BY tr.created_at
    `, [20250714364]);

    console.log(`\n找到 ${transactions.length} 筆相關交易`);
    
    // 5. 檢查用戶餘額變化
    if (championBets.length > 0) {
      const sampleUsername = championBets[0].username;
      console.log(`\n5. 檢查用戶 ${sampleUsername} 的餘額變化:`);
      
      const userTransactions = await db.any(`
        SELECT 
          type,
          amount,
          balance_before,
          balance_after,
          description,
          created_at
        FROM transaction_records
        WHERE username = $1
          AND period = $2
        ORDER BY created_at
      `, [sampleUsername, 20250714364]);
      
      userTransactions.forEach(tx => {
        console.log(`  ${tx.type}: $${tx.balance_before} → $${tx.balance_after} (${tx.amount > 0 ? '+' : ''}${tx.amount}) - ${tx.description}`);
      });
    }

    // 6. 提供修復建議
    if (wrongLosses.length > 0) {
      console.log('\n\n=== 修復建議 ===');
      console.log('發現結算邏輯有誤，需要重新結算這些投注。');
      console.log('可能的原因:');
      console.log('1. checkWin 函數中的號碼比較邏輯有誤');
      console.log('2. 號碼類型不匹配（字符串 vs 數字）');
      console.log('3. 結算時使用了錯誤的開獎結果');
    }

  } catch (error) {
    console.error('檢查過程中發生錯誤:', error);
  } finally {
    await db.$pool.end();
  }
}

// 執行檢查
checkPeriod364Settlement();