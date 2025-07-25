import db from './db/config.js';

async function checkBetDrawResult() {
  try {
    // 1. 检查 bet_history 表结构
    console.log('=== 检查 bet_history 表结构 ===');
    const columns = await db.any(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'bet_history'
      ORDER BY ordinal_position
    `);
    
    console.log('bet_history 表栏位:');
    columns.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type}`);
    });
    
    // 2. 查询投注记录的查询语句
    console.log('\n=== 查询投注记录时使用的 SQL ===');
    const queryUsed = `
      SELECT 
        bh.id, 
        bh.period, 
        bh.bet_type, 
        bh.bet_value, 
        bh.position, 
        bh.amount, 
        bh.odds,
        bh.win, 
        bh.win_amount, 
        bh.created_at,
        rh.result as draw_result
      FROM bet_history bh
      LEFT JOIN result_history rh ON bh.period = rh.period
      WHERE bh.username = $1 
        AND bh.settled = true 
      ORDER BY bh.created_at DESC
      LIMIT 5
    `;
    
    console.log('查询语句:', queryUsed);
    
    // 3. 执行查询看看结果
    const bets = await db.manyOrNone(queryUsed, ['justin111']);
    
    console.log(`\n=== 查询结果 (共 ${bets.length} 笔) ===`);
    bets.forEach((bet, index) => {
      console.log(`\n[${index + 1}] 期号: ${bet.period}`);
      console.log(`  投注: ${bet.bet_type} - ${bet.bet_value} (位置: ${bet.position})`);
      console.log(`  中奖: ${bet.win ? '✅' : '❌'}`);
      console.log(`  draw_result: ${JSON.stringify(bet.draw_result)}`);
      
      // 检查结果格式
      if (bet.draw_result) {
        if (Array.isArray(bet.draw_result)) {
          console.log(`  第1名: ${bet.draw_result[0]}`);
        } else {
          console.log(`  draw_result 不是阵列格式`);
        }
      }
    });
    
    // 4. 比对期号 537 的实际结果
    console.log('\n=== 期号 20250717537 的实际开奖结果 ===');
    const actual537 = await db.oneOrNone(`
      SELECT * FROM result_history WHERE period = '20250717537'
    `);
    
    if (actual537) {
      console.log('result:', actual537.result);
      console.log('position_1:', actual537.position_1);
      
      // 查询该期号的投注
      const bets537 = await db.manyOrNone(`
        SELECT bh.*, rh.result as draw_result
        FROM bet_history bh
        LEFT JOIN result_history rh ON bh.period = rh.period
        WHERE bh.period = '20250717537'
        ORDER BY bh.id
      `);
      
      console.log(`\n该期号共 ${bets537.length} 笔投注`);
      bets537.forEach(bet => {
        console.log(`  ID ${bet.id}: 投注${bet.bet_value}, 位置${bet.position}, ${bet.win ? '中奖' : '未中'}`);
        if (bet.win && bet.position == 1) {
          console.log(`    ⚠️ 注意: 投注第1名号码${bet.bet_value}中奖`);
          console.log(`    draw_result: ${JSON.stringify(bet.draw_result)}`);
          if (Array.isArray(bet.draw_result)) {
            console.log(`    第1名实际开出: ${bet.draw_result[0]}`);
          }
        }
      });
    }
    
  } catch (error) {
    console.error('查询失败:', error);
  } finally {
    process.exit(0);
  }
}

checkBetDrawResult();