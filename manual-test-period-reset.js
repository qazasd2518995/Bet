// 手動測試期號重置功能

import db from './db/config.js';

async function manualTest() {
  console.log('📋 期號重置邏輯測試\n');
  
  try {
    // 1. 查看當前遊戲狀態
    const gameState = await db.oneOrNone('SELECT * FROM game_state ORDER BY id DESC LIMIT 1');
    console.log('🎮 當前遊戲狀態:');
    console.log(`  期號: ${gameState.current_period}`);
    console.log(`  狀態: ${gameState.status}`);
    console.log(`  倒計時: ${gameState.countdown_seconds}秒`);
    
    // 2. 分析期號
    const periodStr = String(gameState.current_period);
    const dateStr = periodStr.substring(0, 8);
    const numStr = periodStr.substring(8);
    console.log(`\n📊 期號分析:`);
    console.log(`  日期部分: ${dateStr}`);
    console.log(`  序號部分: ${numStr}`);
    console.log(`  格式化: ${dateStr.substring(0,4)}-${dateStr.substring(4,6)}-${dateStr.substring(6,8)} 第${parseInt(numStr)}期`);
    
    // 3. 查看最近的開獎記錄
    console.log('\n📜 最近10期開獎記錄:');
    const recentRecords = await db.manyOrNone(`
      SELECT period, draw_time 
      FROM result_history 
      ORDER BY period DESC 
      LIMIT 10
    `);
    
    recentRecords.forEach(record => {
      const periodStr = String(record.period);
      const dateStr = periodStr.substring(0, 8);
      const numStr = periodStr.substring(8);
      const formattedDate = `${dateStr.substring(0,4)}-${dateStr.substring(4,6)}-${dateStr.substring(6,8)}`;
      console.log(`  ${formattedDate} 第${parseInt(numStr)}期 - ${record.draw_time.toLocaleString('zh-TW')}`);
    });
    
    // 4. 檢查今天的記錄範圍
    const today = new Date();
    const todayStr = `${today.getFullYear()}${(today.getMonth()+1).toString().padStart(2,'0')}${today.getDate().toString().padStart(2,'0')}`;
    
    const todayRecords = await db.manyOrNone(`
      SELECT MIN(CAST(period AS BIGINT)) as min_period, 
             MAX(CAST(period AS BIGINT)) as max_period, 
             COUNT(*) as total
      FROM result_history 
      WHERE CAST(period AS VARCHAR) LIKE $1
    `, [todayStr + '%']);
    
    if (todayRecords[0].total > 0) {
      console.log(`\n📅 今天(${todayStr})的開獎統計:`);
      console.log(`  最小期號: ${todayRecords[0].min_period}`);
      console.log(`  最大期號: ${todayRecords[0].max_period}`);
      console.log(`  總期數: ${todayRecords[0].total}`);
    }
    
    // 5. 檢查昨天的記錄範圍
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}${(yesterday.getMonth()+1).toString().padStart(2,'0')}${yesterday.getDate().toString().padStart(2,'0')}`;
    
    const yesterdayRecords = await db.manyOrNone(`
      SELECT MIN(CAST(period AS BIGINT)) as min_period, 
             MAX(CAST(period AS BIGINT)) as max_period, 
             COUNT(*) as total
      FROM result_history 
      WHERE CAST(period AS VARCHAR) LIKE $1
    `, [yesterdayStr + '%']);
    
    if (yesterdayRecords[0].total > 0) {
      console.log(`\n📅 昨天(${yesterdayStr})的開獎統計:`);
      console.log(`  最小期號: ${yesterdayRecords[0].min_period}`);
      console.log(`  最大期號: ${yesterdayRecords[0].max_period}`);
      console.log(`  總期數: ${yesterdayRecords[0].total}`);
    }
    
    // 6. 測試期號重置邏輯（不實際修改）
    console.log('\n🧪 期號重置邏輯測試:');
    console.log('如果現在是早上7點，根據邏輯：');
    console.log(`- 昨天的最後期號應該是: ${yesterdayStr}XXX (XXX可能超過999)`);
    console.log(`- 今天的第一期號應該是: ${todayStr}001`);
    console.log(`- 當前期號(${gameState.current_period})是否符合預期？`);
    
    // 檢查當前時間
    const now = new Date();
    const hours = now.getHours();
    if (hours >= 7) {
      console.log(`\n✅ 現在是 ${hours} 點，應該使用今天的日期作為期號前綴`);
    } else {
      console.log(`\n⚠️ 現在是 ${hours} 點（早上7點前），應該繼續使用昨天的日期作為期號前綴`);
    }
    
  } catch (error) {
    console.error('❌ 測試過程中發生錯誤:', error);
  } finally {
    await db.$pool.end();
  }
}

// 執行測試
manualTest();