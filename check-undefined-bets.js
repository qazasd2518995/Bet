// check-undefined-bets.js - 检查是否有 undefined 或错误的投注值

import db from './db/config.js';

async function checkUndefinedBets() {
  console.log('🔍 检查 undefined 或错误的投注值...\n');
  
  try {
    // 1. 查找 bet_value 为 'undefined' 的记录
    console.log('1. 查找 bet_value 为 "undefined" 的记录:');
    const undefinedBets = await db.any(`
      SELECT 
        id,
        username,
        bet_type,
        bet_value,
        position,
        period,
        created_at
      FROM bet_history
      WHERE bet_value = 'undefined'
         OR bet_value IS NULL
         OR bet_value = ''
      ORDER BY created_at DESC
      LIMIT 20
    `);
    
    if (undefinedBets.length > 0) {
      console.log(`找到 ${undefinedBets.length} 笔问题记录:`);
      undefinedBets.forEach(bet => {
        console.log(`  ID: ${bet.id}, 用户: ${bet.username}, 期号: ${bet.period}`);
        console.log(`    bet_type: ${bet.bet_type}, bet_value: "${bet.bet_value}", position: ${bet.position}`);
        console.log(`    时间: ${bet.created_at}`);
      });
    } else {
      console.log('  ✅ 没有找到 bet_value 为 undefined 的记录');
    }
    
    // 2. 查找今天通过批量 API 创建的投注
    console.log('\n2. 检查今天通过批量 API 的投注统计:');
    const todayStats = await db.one(`
      SELECT 
        COUNT(*) as total_bets,
        COUNT(CASE WHEN bet_value = 'undefined' THEN 1 END) as undefined_bets,
        COUNT(CASE WHEN bet_value IS NULL THEN 1 END) as null_bets,
        COUNT(CASE WHEN bet_value = '' THEN 1 END) as empty_bets,
        COUNT(CASE WHEN bet_type = 'number' AND position IS NULL THEN 1 END) as null_position_bets
      FROM bet_history
      WHERE created_at >= CURRENT_DATE
    `);
    
    console.log(`  今日总投注数: ${todayStats.total_bets}`);
    console.log(`  undefined 投注: ${todayStats.undefined_bets}`);
    console.log(`  null 投注: ${todayStats.null_bets}`);
    console.log(`  空值投注: ${todayStats.empty_bets}`);
    console.log(`  号码投注缺少位置: ${todayStats.null_position_bets}`);
    
    // 3. 检查最近一小时的批量投注模式
    console.log('\n3. 最近一小时的投注模式:');
    const recentPattern = await db.any(`
      SELECT 
        username,
        COUNT(*) as bet_count,
        COUNT(CASE WHEN bet_value = 'undefined' THEN 1 END) as undefined_count,
        MIN(created_at) as first_bet,
        MAX(created_at) as last_bet
      FROM bet_history
      WHERE created_at > NOW() - INTERVAL '1 hour'
      GROUP BY username
      HAVING COUNT(*) > 5
      ORDER BY bet_count DESC
      LIMIT 10
    `);
    
    if (recentPattern.length > 0) {
      console.log('批量投注用户:');
      recentPattern.forEach(user => {
        console.log(`  ${user.username}: ${user.bet_count} 笔投注`);
        if (user.undefined_count > 0) {
          console.log(`    ⚠️ 其中 ${user.undefined_count} 笔为 undefined!`);
        }
        console.log(`    时间范围: ${user.first_bet} 到 ${user.last_bet}`);
      });
    }
    
    // 4. 分析栏位映射问题的根源
    console.log('\n4. 栏位映射问题分析:');
    console.log('根据代码分析发现的问题:');
    console.log('- optimized-betting-system.js 第 56-58 行使用了错误的栏位名称');
    console.log('- 应该将 bet.betType 改为 bet.bet_type');
    console.log('- 应该将 bet.value 改为 bet.bet_value');
    console.log('');
    console.log('但从数据库查询结果来看，似乎问题已经被修复或有其他地方做了转换');
    
  } catch (error) {
    console.error('❌ 检查过程出错:', error);
  }
}

// 执行检查
checkUndefinedBets();