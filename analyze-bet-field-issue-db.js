// analyze-bet-field-issue-db.js - 使用 db 模組分析 bet_history 表中的欄位問題

import db from './db/config.js';

async function analyzeBetFieldIssue() {
  console.log('🔍 開始分析 bet_history 表中的欄位問題...\n');
  
  try {
    // 1. 查詢最近的號碼類型投注
    console.log('1. 查詢最近 20 筆號碼類型投注:');
    const numberBets = await db.any(`
      SELECT 
        id,
        username,
        bet_type,
        bet_value,
        position,
        amount,
        period,
        created_at
      FROM bet_history
      WHERE bet_type = 'number'
      ORDER BY created_at DESC
      LIMIT 20
    `);
    
    if (numberBets.length > 0) {
      console.log('找到 ' + numberBets.length + ' 筆號碼投注記錄:');
      numberBets.forEach(bet => {
        console.log(`  ID: ${bet.id}, 用戶: ${bet.username}, 期號: ${bet.period}`);
        console.log(`    bet_value: "${bet.bet_value}", position: ${bet.position}`);
        console.log(`    時間: ${bet.created_at}`);
        
        // 檢查是否有欄位錯誤
        if (bet.bet_value && !isNaN(bet.bet_value) && parseInt(bet.bet_value) >= 1 && parseInt(bet.bet_value) <= 10) {
          console.log(`    ✅ bet_value 正確 (號碼: ${bet.bet_value})`);
        } else {
          console.log(`    ❌ bet_value 可能有誤: "${bet.bet_value}"`);
        }
        
        if (bet.position && !isNaN(bet.position) && bet.position >= 1 && bet.position <= 10) {
          console.log(`    ✅ position 正確 (位置: ${bet.position})`);
        } else {
          console.log(`    ❌ position 可能有誤: ${bet.position}`);
        }
        console.log('');
      });
    } else {
      console.log('  沒有找到號碼類型的投注記錄');
    }
    
    // 2. 檢查批量投注的記錄
    console.log('\n2. 檢查最近通過批量投注 API 的號碼投注:');
    const recentBatchBets = await db.any(`
      SELECT 
        id,
        username,
        bet_type,
        bet_value,
        position,
        period,
        created_at
      FROM bet_history
      WHERE bet_type = 'number'
        AND created_at > NOW() - INTERVAL '1 hour'
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    if (recentBatchBets.length > 0) {
      console.log(`找到 ${recentBatchBets.length} 筆最近一小時的記錄:`);
      recentBatchBets.forEach(bet => {
        console.log(`  ID: ${bet.id}, 用戶: ${bet.username}`);
        console.log(`    應該是: 第${bet.position}名 投注 ${bet.bet_value}號`);
        
        // 檢查是否有欄位值看起來不對
        if (bet.bet_value === 'undefined' || bet.bet_value === null || bet.bet_value === '') {
          console.log(`    ⚠️ bet_value 是空值或 undefined!`);
        }
        if (bet.position === null) {
          console.log(`    ⚠️ position 是 null!`);
        }
        console.log('');
      });
    }
    
    // 3. 查看具體的錯誤模式
    console.log('\n3. 查找可能的錯誤模式:');
    const errorPatterns = await db.any(`
      SELECT 
        bet_value,
        position,
        COUNT(*) as count
      FROM bet_history
      WHERE bet_type = 'number'
        AND created_at > NOW() - INTERVAL '24 hours'
        AND (
          bet_value = 'undefined'
          OR bet_value IS NULL
          OR bet_value = ''
          OR position IS NULL
          OR bet_value NOT IN ('1','2','3','4','5','6','7','8','9','10')
        )
      GROUP BY bet_value, position
      ORDER BY count DESC
      LIMIT 10
    `);
    
    if (errorPatterns.length > 0) {
      console.log('發現以下錯誤模式:');
      errorPatterns.forEach(pattern => {
        console.log(`  bet_value="${pattern.bet_value}", position=${pattern.position}: ${pattern.count} 次`);
      });
    } else {
      console.log('  沒有發現明顯的錯誤模式');
    }
    
    // 4. 檢查特定用戶的投注
    console.log('\n4. 檢查 justin111 的號碼投注:');
    const justinBets = await db.any(`
      SELECT 
        id,
        bet_type,
        bet_value,
        position,
        amount,
        odds,
        period,
        win,
        win_amount,
        created_at
      FROM bet_history
      WHERE username = 'justin111'
        AND bet_type = 'number'
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    if (justinBets.length > 0) {
      justinBets.forEach(bet => {
        console.log(`  期號: ${bet.period}`);
        console.log(`    投注內容: 第${bet.position}名 ${bet.bet_value}號`);
        console.log(`    金額: ${bet.amount}, 賠率: ${bet.odds}`);
        console.log(`    狀態: ${bet.win ? '中獎' : '未中'}, 獎金: ${bet.win_amount}`);
        console.log(`    時間: ${bet.created_at}`);
        console.log('');
      });
    }
    
    // 5. 檢查原始 SQL 插入語句的問題
    console.log('\n5. 分析批量插入的欄位映射問題:');
    console.log('根據程式碼分析:');
    console.log('- Frontend 發送: betType, value, position');
    console.log('- Database 期望: bet_type, bet_value, position');
    console.log('- optimized-betting-system.js 使用: bet.betType, bet.value (錯誤!)');
    console.log('- 應該使用: bet.bet_type, bet.bet_value');
    
  } catch (error) {
    console.error('❌ 分析過程出錯:', error);
  }
}

// 執行分析
analyzeBetFieldIssue();