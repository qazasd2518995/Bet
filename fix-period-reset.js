// 修復期號重置問題 - 清理錯誤的期號記錄

import db from './db/config.js';

async function fixPeriodReset() {
  console.log('🔧 開始修復期號重置問題...');
  
  try {
    // 1. 獲取當前遊戲狀態的期號
    const gameState = await db.oneOrNone('SELECT current_period FROM game_state ORDER BY id DESC LIMIT 1');
    if (!gameState) {
      console.error('❌ 找不到遊戲狀態');
      return;
    }
    
    const currentPeriod = gameState.current_period;
    const currentPeriodStr = String(currentPeriod);
    const currentGameDate = currentPeriodStr.substring(0, 8);
    
    console.log(`📅 當前期號: ${currentPeriod}`);
    console.log(`📅 當前遊戲日期: ${currentGameDate}`);
    
    // 2. 查找當天所有期號大於當前期號的記錄
    const invalidRecords = await db.manyOrNone(`
      SELECT period, draw_time 
      FROM result_history 
      WHERE CAST(period AS VARCHAR) LIKE $1 
        AND CAST(period AS BIGINT) > $2
      ORDER BY period DESC
    `, [currentGameDate + '%', currentPeriod]);
    
    if (invalidRecords.length > 0) {
      console.log(`⚠️ 發現 ${invalidRecords.length} 筆無效記錄（期號大於當前期號）`);
      console.log('前5筆無效記錄:', invalidRecords.slice(0, 5));
      
      // 3. 刪除這些無效記錄
      const deletedCount = await db.result(`
        DELETE FROM result_history 
        WHERE CAST(period AS VARCHAR) LIKE $1 
          AND CAST(period AS BIGINT) > $2
      `, [currentGameDate + '%', currentPeriod], r => r.rowCount);
      
      console.log(`✅ 已刪除 ${deletedCount.rowCount} 筆無效記錄`);
      
      // 4. 同步刪除相關的投注記錄
      const deletedBets = await db.result(`
        DELETE FROM bet_history 
        WHERE CAST(period AS VARCHAR) LIKE $1 
          AND CAST(period AS BIGINT) > $2
      `, [currentGameDate + '%', currentPeriod], r => r.rowCount);
      
      console.log(`✅ 已刪除 ${deletedBets.rowCount} 筆相關投注記錄`);
    } else {
      console.log('✅ 沒有發現無效記錄');
    }
    
    // 5. 檢查並報告當前狀態
    const latestRecord = await db.oneOrNone(`
      SELECT period, draw_time 
      FROM result_history 
      WHERE CAST(period AS VARCHAR) LIKE $1
      ORDER BY period DESC 
      LIMIT 1
    `, [currentGameDate + '%']);
    
    if (latestRecord) {
      console.log(`📊 當天最新的有效記錄: 期號=${latestRecord.period}, 時間=${latestRecord.draw_time}`);
    }
    
    // 6. 驗證期號連續性
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
        console.log(`⚠️ 發現期號不連續的情況:`, gaps.slice(0, 5));
      } else {
        console.log(`✅ 期號連續性檢查通過`);
      }
    }
    
    console.log('🎉 期號重置修復完成！');
    
  } catch (error) {
    console.error('❌ 修復過程中發生錯誤:', error);
  } finally {
    await db.$pool.end();
  }
}

// 執行修復
fixPeriodReset();