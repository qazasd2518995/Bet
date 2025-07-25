import db from './db/config.js';

async function checkPeriod546() {
  try {
    console.log('🔍 检查期号 20250717546 的开奖和结算情况...\n');
    
    // 1. 查询开奖结果
    const result = await db.oneOrNone(`
      SELECT * FROM result_history 
      WHERE period = '20250717546'
    `);
    
    if (result) {
      console.log('=== 开奖结果 ===');
      console.log('期号:', result.period);
      console.log('JSON结果:', result.result);
      console.log('各名次:');
      for (let i = 1; i <= 10; i++) {
        console.log(`  第${i}名: ${result[`position_${i}`]}`);
      }
      console.log('开奖时间:', result.created_at);
      console.log(`\n重点：第2名开出 ${result.position_2} 号\n`);
    } else {
      console.log('❌ 找不到期号 20250717546 的开奖记录');
      return;
    }
    
    // 2. 查询该期所有第2名的投注
    const bets = await db.manyOrNone(`
      SELECT id, username, bet_type, bet_value, position, amount, odds, 
             win, win_amount, settled, created_at, settled_at
      FROM bet_history
      WHERE period = '20250717546' 
        AND bet_type = 'number' 
        AND position = 2
      ORDER BY id
    `);
    
    console.log(`=== 第2名投注记录 (共 ${bets.length} 笔) ===`);
    
    let correctWins = 0;
    let wrongWins = 0;
    
    bets.forEach((bet) => {
      const shouldWin = parseInt(bet.bet_value) === result.position_2;
      const actualWin = bet.win;
      const isCorrect = shouldWin === actualWin;
      
      console.log(`\nID ${bet.id}: 投注号码 ${bet.bet_value}`);
      console.log(`  应该${shouldWin ? '中奖' : '未中'} (第2名=${result.position_2})`);
      console.log(`  实际${actualWin ? '中奖' : '未中'} ${isCorrect ? '✅' : '❌ 错误！'}`);
      
      if (actualWin && !shouldWin) {
        wrongWins++;
        console.log(`  ⚠️ 错误中奖：投注${bet.bet_value}不应该中奖`);
      } else if (!actualWin && shouldWin) {
        console.log(`  ⚠️ 错误未中：投注${bet.bet_value}应该中奖`);
      }
      
      if (isCorrect && shouldWin) correctWins++;
    });
    
    console.log(`\n统计：正确中奖 ${correctWins} 笔，错误中奖 ${wrongWins} 笔`);
    
    // 3. 查看结算日志
    console.log('\n=== 结算日志 ===');
    const logs = await db.manyOrNone(`
      SELECT * FROM settlement_logs 
      WHERE period = '20250717546'
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    if (logs.length > 0) {
      logs.forEach((log, i) => {
        console.log(`\n[${i+1}] ${log.created_at}`);
        console.log(`  状态: ${log.status}`);
        console.log(`  讯息: ${log.message}`);
        if (log.details) {
          console.log(`  详情: ${JSON.stringify(log.details).substring(0, 100)}...`);
        }
      });
    } else {
      console.log('没有找到结算日志');
    }
    
    // 4. 检查开奖流程
    console.log('\n=== 检查开奖流程 ===');
    
    // 查看最近的系统日志中关于 546 期的记录
    console.log('请检查 server.log 中关于期号 546 的以下关键日志：');
    console.log('1. [提前开奖] 相关日志');
    console.log('2. [统一开奖] 相关日志');
    console.log('3. [结果保存] 相关日志');
    console.log('4. [结算执行] 相关日志');
    
  } catch (error) {
    console.error('查询失败:', error);
  } finally {
    process.exit(0);
  }
}

checkPeriod546();