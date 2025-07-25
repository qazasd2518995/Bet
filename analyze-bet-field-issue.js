// analyze-bet-field-issue.js - 分析 bet_history 表中的 position 和 bet_value 栏位问题

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// 强制使用生产环境配置
process.env.NODE_ENV = 'production';

const pool = new Pool({
  connectionString: 'postgresql://bet_db_user:XrJnKdzkfimK0RxJWtGA8dKexSEy8GJJ@dpg-cs5t5flds78s73b9q2cg-a.oregon-postgres.render.com/bet_db',
  ssl: { rejectUnauthorized: false }
});

async function analyzeBetFieldIssue() {
  console.log('🔍 开始分析 bet_history 表中的栏位问题...\n');
  
  try {
    // 1. 查询最近的号码类型投注
    console.log('1. 查询最近 20 笔号码类型投注:');
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
      console.log('找到 ' + numberBets.rows.length + ' 笔号码投注记录:');
      numberBets.rows.forEach(bet => {
        console.log(`  ID: ${bet.id}, 用户: ${bet.username}, 期号: ${bet.period}`);
        console.log(`    bet_value: ${bet.bet_value}, position: ${bet.position}`);
        console.log(`    时间: ${bet.created_at}`);
        
        // 检查是否有栏位错误
        if (bet.bet_value && !isNaN(bet.bet_value) && bet.bet_value >= 1 && bet.bet_value <= 10) {
          console.log(`    ✅ bet_value 正确 (号码: ${bet.bet_value})`);
        } else {
          console.log(`    ❌ bet_value 可能有误: ${bet.bet_value}`);
        }
        
        if (bet.position && !isNaN(bet.position) && bet.position >= 1 && bet.position <= 10) {
          console.log(`    ✅ position 正确 (位置: ${bet.position})`);
        } else {
          console.log(`    ❌ position 可能有误: ${bet.position}`);
        }
        console.log('');
      });
    } else {
      console.log('  没有找到号码类型的投注记录');
    }
    
    // 2. 分析可能的栏位交换问题
    console.log('\n2. 检查是否有 position 和 bet_value 交换的情况:');
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
          -- position 看起来像号码 (1-10)
          (position IS NOT NULL AND position::text ~ '^[1-9]$|^10$')
          -- bet_value 看起来不像号码
          OR (bet_value IS NOT NULL AND bet_value NOT IN ('1','2','3','4','5','6','7','8','9','10'))
        )
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    if (suspiciousBets.rows.length > 0) {
      console.log(`找到 ${suspiciousBets.rows.length} 笔可疑记录:`);
      suspiciousBets.rows.forEach(bet => {
        console.log(`  ID: ${bet.id}, 期号: ${bet.period}`);
        console.log(`    bet_value: "${bet.bet_value}" (应该是 1-10 的号码)`);
        console.log(`    position: "${bet.position}" (应该是 1-10 的位置)`);
        console.log('');
      });
    } else {
      console.log('  没有发现明显的栏位交换问题');
    }
    
    // 3. 统计各种 bet_value 的分布
    console.log('\n3. 统计号码投注的 bet_value 分布:');
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
      console.log('bet_value 值分布:');
      valueDistribution.rows.forEach(row => {
        console.log(`  "${row.bet_value}": ${row.count} 次`);
      });
    }
    
    // 4. 统计各种 position 的分布
    console.log('\n4. 统计号码投注的 position 分布:');
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
      console.log('position 值分布:');
      positionDistribution.rows.forEach(row => {
        console.log(`  ${row.position || 'NULL'}: ${row.count} 次`);
      });
    }
    
    // 5. 查找特定用户的投注记录
    console.log('\n5. 查询 justin111 的最近号码投注:');
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
        console.log(`  期号: ${bet.period}, 投注: 第${bet.position}名 ${bet.bet_value}号`);
        console.log(`    金额: ${bet.amount}, 赔率: ${bet.odds}`);
        console.log(`    结果: ${bet.win ? '中奖' : '未中'}, 奖金: ${bet.win_amount}`);
        console.log('');
      });
    } else {
      console.log('  没有找到 justin111 的号码投注记录');
    }
    
  } catch (error) {
    console.error('❌ 分析过程出错:', error);
  } finally {
    await pool.end();
  }
}

// 执行分析
analyzeBetFieldIssue();