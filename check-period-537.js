import db from './db/config.js';

async function checkPeriod537() {
  try {
    console.log('查询期号 20250717537 的开奖结果...\n');
    
    // 1. 查询 result_history 表
    const result = await db.oneOrNone(`
      SELECT period, result, position_1, position_2, position_3, position_4, position_5,
             position_6, position_7, position_8, position_9, position_10, created_at
      FROM result_history 
      WHERE period = '20250717537'
    `);
    
    if (result) {
      console.log('=== result_history 表中的开奖结果 ===');
      console.log('期号:', result.period);
      console.log('JSON结果:', result.result);
      console.log('各名次:');
      for (let i = 1; i <= 10; i++) {
        console.log(`  第${i}名: ${result[`position_${i}`]}`);
      }
      console.log('创建时间:', result.created_at);
    } else {
      console.log('❌ result_history 表中找不到期号 20250717537 的记录');
    }
    
    // 2. 查询 game_state 表的 last_result
    const gameState = await db.oneOrNone(`
      SELECT current_period, last_result, status, updated_at
      FROM game_state
      WHERE id = 1
    `);
    
    console.log('\n=== game_state 表的最后开奖结果 ===');
    console.log('当前期号:', gameState.current_period);
    console.log('最后结果:', gameState.last_result);
    console.log('状态:', gameState.status);
    console.log('更新时间:', gameState.updated_at);
    
    // 3. 查询该期号的所有投注记录
    const bets = await db.manyOrNone(`
      SELECT id, username, bet_type, bet_value, position, amount, odds, 
             win, win_amount, settled, created_at
      FROM bet_history
      WHERE period = '20250717537'
      ORDER BY created_at DESC
    `);
    
    console.log(`\n=== 期号 20250717537 的投注记录 (共 ${bets.length} 笔) ===`);
    
    if (bets.length > 0) {
      // 统计中奖情况
      const winBets = bets.filter(b => b.win === true);
      const settledBets = bets.filter(b => b.settled === true);
      
      console.log(`已结算: ${settledBets.length} 笔`);
      console.log(`中奖: ${winBets.length} 笔`);
      
      // 显示前几笔详细记录
      console.log('\n前5笔投注详情:');
      bets.slice(0, 5).forEach((bet, index) => {
        console.log(`\n[${index + 1}] ID: ${bet.id}`);
        console.log(`  用户: ${bet.username}`);
        console.log(`  类型: ${bet.bet_type}`);
        console.log(`  投注值: ${bet.bet_value}`);
        console.log(`  位置: ${bet.position}`);
        console.log(`  金额: $${bet.amount}`);
        console.log(`  赔率: ${bet.odds}`);
        console.log(`  是否中奖: ${bet.win ? '✅ 赢' : '❌ 输'}`);
        console.log(`  派彩金额: ${bet.win_amount || 0}`);
        console.log(`  已结算: ${bet.settled ? '是' : '否'}`);
      });
    }
    
    // 4. 查询实际开奖时的日志（如果有的话）
    console.log('\n=== 检查结算记录 ===');
    const settlementLog = await db.oneOrNone(`
      SELECT * FROM settlement_logs
      WHERE period = '20250717537'
      ORDER BY created_at DESC
      LIMIT 1
    `);
    
    if (settlementLog) {
      console.log('结算日志:', settlementLog);
    }
    
  } catch (error) {
    console.error('查询失败:', error);
  } finally {
    process.exit(0);
  }
}

checkPeriod537();