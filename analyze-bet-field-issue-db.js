// analyze-bet-field-issue-db.js - 使用 db 模组分析 bet_history 表中的栏位问题

import db from './db/config.js';

async function analyzeBetFieldIssue() {
  console.log('🔍 开始分析 bet_history 表中的栏位问题...\n');
  
  try {
    // 1. 查询最近的号码类型投注
    console.log('1. 查询最近 20 笔号码类型投注:');
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
      console.log('找到 ' + numberBets.length + ' 笔号码投注记录:');
      numberBets.forEach(bet => {
        console.log(`  ID: ${bet.id}, 用户: ${bet.username}, 期号: ${bet.period}`);
        console.log(`    bet_value: "${bet.bet_value}", position: ${bet.position}`);
        console.log(`    时间: ${bet.created_at}`);
        
        // 检查是否有栏位错误
        if (bet.bet_value && !isNaN(bet.bet_value) && parseInt(bet.bet_value) >= 1 && parseInt(bet.bet_value) <= 10) {
          console.log(`    ✅ bet_value 正确 (号码: ${bet.bet_value})`);
        } else {
          console.log(`    ❌ bet_value 可能有误: "${bet.bet_value}"`);
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
    
    // 2. 检查批量投注的记录
    console.log('\n2. 检查最近通过批量投注 API 的号码投注:');
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
      console.log(`找到 ${recentBatchBets.length} 笔最近一小时的记录:`);
      recentBatchBets.forEach(bet => {
        console.log(`  ID: ${bet.id}, 用户: ${bet.username}`);
        console.log(`    应该是: 第${bet.position}名 投注 ${bet.bet_value}号`);
        
        // 检查是否有栏位值看起来不对
        if (bet.bet_value === 'undefined' || bet.bet_value === null || bet.bet_value === '') {
          console.log(`    ⚠️ bet_value 是空值或 undefined!`);
        }
        if (bet.position === null) {
          console.log(`    ⚠️ position 是 null!`);
        }
        console.log('');
      });
    }
    
    // 3. 查看具体的错误模式
    console.log('\n3. 查找可能的错误模式:');
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
      console.log('发现以下错误模式:');
      errorPatterns.forEach(pattern => {
        console.log(`  bet_value="${pattern.bet_value}", position=${pattern.position}: ${pattern.count} 次`);
      });
    } else {
      console.log('  没有发现明显的错误模式');
    }
    
    // 4. 检查特定用户的投注
    console.log('\n4. 检查 justin111 的号码投注:');
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
        console.log(`  期号: ${bet.period}`);
        console.log(`    投注内容: 第${bet.position}名 ${bet.bet_value}号`);
        console.log(`    金额: ${bet.amount}, 赔率: ${bet.odds}`);
        console.log(`    状态: ${bet.win ? '中奖' : '未中'}, 奖金: ${bet.win_amount}`);
        console.log(`    时间: ${bet.created_at}`);
        console.log('');
      });
    }
    
    // 5. 检查原始 SQL 插入语句的问题
    console.log('\n5. 分析批量插入的栏位映射问题:');
    console.log('根据程式码分析:');
    console.log('- Frontend 发送: betType, value, position');
    console.log('- Database 期望: bet_type, bet_value, position');
    console.log('- optimized-betting-system.js 使用: bet.betType, bet.value (错误!)');
    console.log('- 应该使用: bet.bet_type, bet.bet_value');
    
  } catch (error) {
    console.error('❌ 分析过程出错:', error);
  }
}

// 执行分析
analyzeBetFieldIssue();