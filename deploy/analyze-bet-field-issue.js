// analyze-bet-field-issue.js - 分析 bet_history 表中的 position 和 bet_value 欄位問題

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// 強制使用生產環境配置
process.env.NODE_ENV = 'production';

const pool = new Pool({
  connectionString: 'postgresql://bet_db_user:XrJnKdzkfimK0RxJWtGA8dKexSEy8GJJ@dpg-cs5t5flds78s73b9q2cg-a.oregon-postgres.render.com/bet_db',
  ssl: { rejectUnauthorized: false }
});

async function analyzeBetFieldIssue() {
  console.log('🔍 開始分析 bet_history 表中的欄位問題...\n');
  
  try {
    // 1. 查詢最近的號碼類型投注
    console.log('1. 查詢最近 20 筆號碼類型投注:');
    const numberBets = await pool.query(`
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
    
    if (numberBets.rows.length > 0) {
      console.log('找到 ' + numberBets.rows.length + ' 筆號碼投注記錄:');
      numberBets.rows.forEach(bet => {
        console.log(`  ID: ${bet.id}, 用戶: ${bet.username}, 期號: ${bet.period}`);
        console.log(`    bet_value: ${bet.bet_value}, position: ${bet.position}`);
        console.log(`    時間: ${bet.created_at}`);
        
        // 檢查是否有欄位錯誤
        if (bet.bet_value && !isNaN(bet.bet_value) && bet.bet_value >= 1 && bet.bet_value <= 10) {
          console.log(`    ✅ bet_value 正確 (號碼: ${bet.bet_value})`);
        } else {
          console.log(`    ❌ bet_value 可能有誤: ${bet.bet_value}`);
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
    
    // 2. 分析可能的欄位交換問題
    console.log('\n2. 檢查是否有 position 和 bet_value 交換的情況:');
    const suspiciousBets = await pool.query(`
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
        AND (
          -- position 看起來像號碼 (1-10)
          (position IS NOT NULL AND position::text ~ '^[1-9]$|^10$')
          -- bet_value 看起來不像號碼
          OR (bet_value IS NOT NULL AND bet_value NOT IN ('1','2','3','4','5','6','7','8','9','10'))
        )
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    if (suspiciousBets.rows.length > 0) {
      console.log(`找到 ${suspiciousBets.rows.length} 筆可疑記錄:`);
      suspiciousBets.rows.forEach(bet => {
        console.log(`  ID: ${bet.id}, 期號: ${bet.period}`);
        console.log(`    bet_value: "${bet.bet_value}" (應該是 1-10 的號碼)`);
        console.log(`    position: "${bet.position}" (應該是 1-10 的位置)`);
        console.log('');
      });
    } else {
      console.log('  沒有發現明顯的欄位交換問題');
    }
    
    // 3. 統計各種 bet_value 的分佈
    console.log('\n3. 統計號碼投注的 bet_value 分佈:');
    const valueDistribution = await pool.query(`
      SELECT 
        bet_value,
        COUNT(*) as count
      FROM bet_history
      WHERE bet_type = 'number'
        AND created_at > NOW() - INTERVAL '7 days'
      GROUP BY bet_value
      ORDER BY count DESC
      LIMIT 20
    `);
    
    if (valueDistribution.rows.length > 0) {
      console.log('bet_value 值分佈:');
      valueDistribution.rows.forEach(row => {
        console.log(`  "${row.bet_value}": ${row.count} 次`);
      });
    }
    
    // 4. 統計各種 position 的分佈
    console.log('\n4. 統計號碼投注的 position 分佈:');
    const positionDistribution = await pool.query(`
      SELECT 
        position,
        COUNT(*) as count
      FROM bet_history
      WHERE bet_type = 'number'
        AND created_at > NOW() - INTERVAL '7 days'
      GROUP BY position
      ORDER BY count DESC
      LIMIT 20
    `);
    
    if (positionDistribution.rows.length > 0) {
      console.log('position 值分佈:');
      positionDistribution.rows.forEach(row => {
        console.log(`  ${row.position || 'NULL'}: ${row.count} 次`);
      });
    }
    
    // 5. 查找特定用戶的投注記錄
    console.log('\n5. 查詢 justin111 的最近號碼投注:');
    const justinBets = await pool.query(`
      SELECT 
        id,
        bet_type,
        bet_value,
        position,
        amount,
        odds,
        win,
        win_amount,
        period,
        created_at
      FROM bet_history
      WHERE username = 'justin111'
        AND bet_type = 'number'
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    if (justinBets.rows.length > 0) {
      justinBets.rows.forEach(bet => {
        console.log(`  期號: ${bet.period}, 投注: 第${bet.position}名 ${bet.bet_value}號`);
        console.log(`    金額: ${bet.amount}, 賠率: ${bet.odds}`);
        console.log(`    結果: ${bet.win ? '中獎' : '未中'}, 獎金: ${bet.win_amount}`);
        console.log('');
      });
    } else {
      console.log('  沒有找到 justin111 的號碼投注記錄');
    }
    
  } catch (error) {
    console.error('❌ 分析過程出錯:', error);
  } finally {
    await pool.end();
  }
}

// 執行分析
analyzeBetFieldIssue();