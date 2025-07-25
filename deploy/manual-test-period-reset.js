// 手动测试期号重置功能

import db from './db/config.js';

async function manualTest() {
  console.log('📋 期号重置逻辑测试\n');
  
  try {
    // 1. 查看当前游戏状态
    const gameState = await db.oneOrNone('SELECT * FROM game_state ORDER BY id DESC LIMIT 1');
    console.log('🎮 当前游戏状态:');
    console.log(`  期号: ${gameState.current_period}`);
    console.log(`  状态: ${gameState.status}`);
    console.log(`  倒计时: ${gameState.countdown_seconds}秒`);
    
    // 2. 分析期号
    const periodStr = String(gameState.current_period);
    const dateStr = periodStr.substring(0, 8);
    const numStr = periodStr.substring(8);
    console.log(`\n📊 期号分析:`);
    console.log(`  日期部分: ${dateStr}`);
    console.log(`  序号部分: ${numStr}`);
    console.log(`  格式化: ${dateStr.substring(0,4)}-${dateStr.substring(4,6)}-${dateStr.substring(6,8)} 第${parseInt(numStr)}期`);
    
    // 3. 查看最近的开奖记录
    console.log('\n📜 最近10期开奖记录:');
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
    
    // 4. 检查今天的记录范围
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
      console.log(`\n📅 今天(${todayStr})的开奖统计:`);
      console.log(`  最小期号: ${todayRecords[0].min_period}`);
      console.log(`  最大期号: ${todayRecords[0].max_period}`);
      console.log(`  总期数: ${todayRecords[0].total}`);
    }
    
    // 5. 检查昨天的记录范围
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
      console.log(`\n📅 昨天(${yesterdayStr})的开奖统计:`);
      console.log(`  最小期号: ${yesterdayRecords[0].min_period}`);
      console.log(`  最大期号: ${yesterdayRecords[0].max_period}`);
      console.log(`  总期数: ${yesterdayRecords[0].total}`);
    }
    
    // 6. 测试期号重置逻辑（不实际修改）
    console.log('\n🧪 期号重置逻辑测试:');
    console.log('如果现在是早上7点，根据逻辑：');
    console.log(`- 昨天的最后期号应该是: ${yesterdayStr}XXX (XXX可能超过999)`);
    console.log(`- 今天的第一期号应该是: ${todayStr}001`);
    console.log(`- 当前期号(${gameState.current_period})是否符合预期？`);
    
    // 检查当前时间
    const now = new Date();
    const hours = now.getHours();
    if (hours >= 7) {
      console.log(`\n✅ 现在是 ${hours} 点，应该使用今天的日期作为期号前缀`);
    } else {
      console.log(`\n⚠️ 现在是 ${hours} 点（早上7点前），应该继续使用昨天的日期作为期号前缀`);
    }
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  } finally {
    await db.$pool.end();
  }
}

// 执行测试
manualTest();