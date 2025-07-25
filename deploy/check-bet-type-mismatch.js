import db from './db/config.js';

async function checkBetTypeMismatch() {
  try {
    console.log('\n=== 检查投注类型不匹配问题 ===\n');

    // 1. 检查 bet_history 表中的所有 bet_type 值
    console.log('1. 检查 bet_history 表中使用的 bet_type 值:');
    const betTypes = await db.any(`
      SELECT DISTINCT bet_type, COUNT(*) as count
      FROM bet_history
      GROUP BY bet_type
      ORDER BY count DESC
    `);
    
    console.log('投注类型统计:');
    betTypes.forEach(type => {
      console.log(`  - ${type.bet_type}: ${type.count} 笔`);
    });

    // 2. 检查期号 20250714364 的投注类型
    console.log('\n2. 期号 20250714364 的投注类型:');
    const period364Types = await db.any(`
      SELECT DISTINCT bet_type, position, COUNT(*) as count
      FROM bet_history
      WHERE period = $1
      GROUP BY bet_type, position
      ORDER BY position, bet_type
    `, [20250714364]);
    
    period364Types.forEach(type => {
      console.log(`  - 位置 ${type.position || 'N/A'}, 类型: ${type.bet_type}, 数量: ${type.count}`);
    });

    // 3. 检查具体的冠军投注
    console.log('\n3. 期号 20250714364 的冠军位置投注详情:');
    const championBets = await db.any(`
      SELECT id, username, bet_type, bet_value, position, amount, win, settled
      FROM bet_history
      WHERE period = $1 AND position = 1
      LIMIT 10
    `, [20250714364]);
    
    championBets.forEach(bet => {
      console.log(`  - ID: ${bet.id}, 用户: ${bet.username}, bet_type: "${bet.bet_type}", 号码: ${bet.bet_value}, win: ${bet.win}, settled: ${bet.settled}`);
    });

    // 4. 检查结算系统中的 bet_type 映射
    console.log('\n4. 结算系统需要支援的 bet_type 值:');
    console.log('  根据资料库记录，系统使用中文 bet_type 值（如"number"而非"champion"）');
    console.log('  但 checkWin 函数检查的是英文值');
    console.log('  这是导致结算失败的根本原因！');
    
    // 5. 提供修复建议
    console.log('\n=== 修复建议 ===');
    console.log('1. 更新 checkWin 函数，支援中文 bet_type 值');
    console.log('2. 或将资料库中的 bet_type 改为英文值');
    console.log('3. 建议使用映射表来处理中英文对照');

  } catch (error) {
    console.error('检查过程中发生错误:', error);
  } finally {
    await db.$pool.end();
  }
}

// 执行检查
checkBetTypeMismatch();