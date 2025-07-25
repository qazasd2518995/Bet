import db from './db/config.js';

async function checkPeriod364Settlement() {
  try {
    console.log('\n=== 检查期号 20250714364 结算问题 ===\n');

    // 1. 检查该期的开奖结果
    console.log('1. 检查开奖结果:');
    const result = await db.oneOrNone(`
      SELECT * FROM result_history 
      WHERE period = $1
    `, [20250714364]);

    if (!result) {
      console.log('❌ 找不到期号 20250714364 的开奖结果！');
      return;
    }

    // 解析结果
    const resultArray = result.result.split ? result.result.split(',').map(Number) : result.result;
    console.log('开奖结果:', {
      period: result.period,
      result: resultArray,
      冠军: resultArray[0],
      亚军: resultArray[1],
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

    // 2. 检查该期所有冠军位置的投注
    console.log('\n2. 检查冠军位置的所有投注:');
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

    console.log(`\n找到 ${championBets.length} 笔冠军投注`);

    // 按用户分组显示投注
    const betsByUser = {};
    championBets.forEach(bet => {
      if (!betsByUser[bet.username]) {
        betsByUser[bet.username] = [];
      }
      betsByUser[bet.username].push(bet);
    });

    const championNumber = resultArray[0]; // 冠军号码
    
    for (const [username, userBets] of Object.entries(betsByUser)) {
      console.log(`\n用户 ${username} 的投注:`);
      userBets.forEach(bet => {
        const betNumber = parseInt(bet.bet_value);
        const shouldWin = betNumber === championNumber;
        const actualWin = bet.win === true;
        const statusIcon = actualWin ? '✅' : '❌';
        const correctIcon = shouldWin === actualWin ? '✓' : '✗';
        
        console.log(`  ${statusIcon} 投注号码: ${bet.bet_value} | 金额: $${bet.amount} | 赔率: ${bet.odds} | 赢金: $${bet.win_amount || 0} | 结算: ${bet.settled ? '是' : '否'} | 正确性: ${correctIcon}`);
      });
    }

    // 3. 检查结算逻辑
    console.log('\n3. 检查结算逻辑问题:');
    
    // 检查应该赢但标记为输的投注
    const wrongLosses = championBets.filter(bet => {
      const betNumber = parseInt(bet.bet_value);
      return betNumber === championNumber && bet.win === false;
    });
    
    if (wrongLosses.length > 0) {
      console.log(`\n❌ 发现 ${wrongLosses.length} 笔应该赢但被标记为输的投注！`);
      wrongLosses.forEach(bet => {
        console.log(`  - ID: ${bet.id}, 用户: ${bet.username}, 号码: ${bet.bet_value}, 冠军结果: ${championNumber}`);
      });
    }

    // 检查应该输但标记为赢的投注
    const wrongWins = championBets.filter(bet => {
      const betNumber = parseInt(bet.bet_value);
      return betNumber !== championNumber && bet.win === true;
    });
    
    if (wrongWins.length > 0) {
      console.log(`\n❌ 发现 ${wrongWins.length} 笔应该输但被标记为赢的投注！`);
      wrongWins.forEach(bet => {
        console.log(`  - ID: ${bet.id}, 用户: ${bet.username}, 号码: ${bet.bet_value}, 冠军结果: ${championNumber}`);
      });
    }

    // 4. 检查交易记录
    console.log('\n4. 检查相关交易记录:');
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

    console.log(`\n找到 ${transactions.length} 笔相关交易`);
    
    // 5. 检查用户余额变化
    if (championBets.length > 0) {
      const sampleUsername = championBets[0].username;
      console.log(`\n5. 检查用户 ${sampleUsername} 的余额变化:`);
      
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

    // 6. 提供修复建议
    if (wrongLosses.length > 0) {
      console.log('\n\n=== 修复建议 ===');
      console.log('发现结算逻辑有误，需要重新结算这些投注。');
      console.log('可能的原因:');
      console.log('1. checkWin 函数中的号码比较逻辑有误');
      console.log('2. 号码类型不匹配（字符串 vs 数字）');
      console.log('3. 结算时使用了错误的开奖结果');
    }

  } catch (error) {
    console.error('检查过程中发生错误:', error);
  } finally {
    await db.$pool.end();
  }
}

// 执行检查
checkPeriod364Settlement();