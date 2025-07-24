// check-undefined-bets.js - 檢查是否有 undefined 或錯誤的投注值

import db from './db/config.js';

async function checkUndefinedBets() {
  console.log('🔍 檢查 undefined 或錯誤的投注值...\n');
  
  try {
    // 1. 查找 bet_value 為 'undefined' 的記錄
    console.log('1. 查找 bet_value 為 "undefined" 的記錄:');
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
      console.log(`找到 ${undefinedBets.length} 筆問題記錄:`);
      undefinedBets.forEach(bet => {
        console.log(`  ID: ${bet.id}, 用戶: ${bet.username}, 期號: ${bet.period}`);
        console.log(`    bet_type: ${bet.bet_type}, bet_value: "${bet.bet_value}", position: ${bet.position}`);
        console.log(`    時間: ${bet.created_at}`);
      });
    } else {
      console.log('  ✅ 沒有找到 bet_value 為 undefined 的記錄');
    }
    
    // 2. 查找今天通過批量 API 創建的投注
    console.log('\n2. 檢查今天通過批量 API 的投注統計:');
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
    
    console.log(`  今日總投注數: ${todayStats.total_bets}`);
    console.log(`  undefined 投注: ${todayStats.undefined_bets}`);
    console.log(`  null 投注: ${todayStats.null_bets}`);
    console.log(`  空值投注: ${todayStats.empty_bets}`);
    console.log(`  號碼投注缺少位置: ${todayStats.null_position_bets}`);
    
    // 3. 檢查最近一小時的批量投注模式
    console.log('\n3. 最近一小時的投注模式:');
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
      console.log('批量投注用戶:');
      recentPattern.forEach(user => {
        console.log(`  ${user.username}: ${user.bet_count} 筆投注`);
        if (user.undefined_count > 0) {
          console.log(`    ⚠️ 其中 ${user.undefined_count} 筆為 undefined!`);
        }
        console.log(`    時間範圍: ${user.first_bet} 到 ${user.last_bet}`);
      });
    }
    
    // 4. 分析欄位映射問題的根源
    console.log('\n4. 欄位映射問題分析:');
    console.log('根據代碼分析發現的問題:');
    console.log('- optimized-betting-system.js 第 56-58 行使用了錯誤的欄位名稱');
    console.log('- 應該將 bet.betType 改為 bet.bet_type');
    console.log('- 應該將 bet.value 改為 bet.bet_value');
    console.log('');
    console.log('但從數據庫查詢結果來看，似乎問題已經被修復或有其他地方做了轉換');
    
  } catch (error) {
    console.error('❌ 檢查過程出錯:', error);
  }
}

// 執行檢查
checkUndefinedBets();