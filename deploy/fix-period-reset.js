// 修复期号重置问题 - 清理错误的期号记录

import db from './db/config.js';

async function fixPeriodReset() {
  console.log('🔧 开始修复期号重置问题...');
  
  try {
    // 1. 获取当前游戏状态的期号
    const gameState = await db.oneOrNone('SELECT current_period FROM game_state ORDER BY id DESC LIMIT 1');
    if (!gameState) {
      console.error('❌ 找不到游戏状态');
      return;
    }
    
    const currentPeriod = gameState.current_period;
    const currentPeriodStr = String(currentPeriod);
    const currentGameDate = currentPeriodStr.substring(0, 8);
    
    console.log(`📅 当前期号: ${currentPeriod}`);
    console.log(`📅 当前游戏日期: ${currentGameDate}`);
    
    // 2. 查找当天所有期号大于当前期号的记录
    const invalidRecords = await db.manyOrNone(`
      SELECT period, draw_time 
      FROM result_history 
      WHERE CAST(period AS VARCHAR) LIKE $1 
        AND CAST(period AS BIGINT) > $2
      ORDER BY period DESC
    `, [currentGameDate + '%', currentPeriod]);
    
    if (invalidRecords.length > 0) {
      console.log(`⚠️ 发现 ${invalidRecords.length} 笔无效记录（期号大于当前期号）`);
      console.log('前5笔无效记录:', invalidRecords.slice(0, 5));
      
      // 3. 删除这些无效记录
      const deletedCount = await db.result(`
        DELETE FROM result_history 
        WHERE CAST(period AS VARCHAR) LIKE $1 
          AND CAST(period AS BIGINT) > $2
      `, [currentGameDate + '%', currentPeriod], r => r.rowCount);
      
      console.log(`✅ 已删除 ${deletedCount.rowCount} 笔无效记录`);
      
      // 4. 同步删除相关的投注记录
      const deletedBets = await db.result(`
        DELETE FROM bet_history 
        WHERE CAST(period AS VARCHAR) LIKE $1 
          AND CAST(period AS BIGINT) > $2
      `, [currentGameDate + '%', currentPeriod], r => r.rowCount);
      
      console.log(`✅ 已删除 ${deletedBets.rowCount} 笔相关投注记录`);
    } else {
      console.log('✅ 没有发现无效记录');
    }
    
    // 5. 检查并报告当前状态
    const latestRecord = await db.oneOrNone(`
      SELECT period, draw_time 
      FROM result_history 
      WHERE CAST(period AS VARCHAR) LIKE $1
      ORDER BY period DESC 
      LIMIT 1
    `, [currentGameDate + '%']);
    
    if (latestRecord) {
      console.log(`📊 当天最新的有效记录: 期号=${latestRecord.period}, 时间=${latestRecord.draw_time}`);
    }
    
    // 6. 验证期号连续性
    const todayRecords = await db.manyOrNone(`
      SELECT period 
      FROM result_history 
      WHERE CAST(period AS VARCHAR) LIKE $1
      ORDER BY period ASC
    `, [currentGameDate + '%']);
    
    if (todayRecords.length > 0) {
      let expectedNum = 1;
      let gaps = [];
      
      for (const record of todayRecords) {
        const periodStr = String(record.period);
        const periodNum = parseInt(periodStr.substring(8));
        
        if (periodNum !== expectedNum) {
          gaps.push({ expected: expectedNum, actual: periodNum });
        }
        expectedNum = periodNum + 1;
      }
      
      if (gaps.length > 0) {
        console.log(`⚠️ 发现期号不连续的情况:`, gaps.slice(0, 5));
      } else {
        console.log(`✅ 期号连续性检查通过`);
      }
    }
    
    console.log('🎉 期号重置修复完成！');
    
  } catch (error) {
    console.error('❌ 修复过程中发生错误:', error);
  } finally {
    await db.$pool.end();
  }
}

// 执行修复
fixPeriodReset();