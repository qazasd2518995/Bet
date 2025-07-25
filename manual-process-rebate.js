import db from './db/config.js';
import { processRebates } from './enhanced-settlement-system.js';

async function manualProcessRebate() {
  try {
    console.log('=== 手动处理期号 20250715107 的退水 ===');
    
    // 1. 检查该期的下注情况
    console.log('\n1. 检查该期下注情况:');
    const bets = await db.any(`
      SELECT username, SUM(amount) as total_amount, COUNT(*) as bet_count
      FROM bet_history
      WHERE period = $1 AND settled = true
      GROUP BY username
    `, ['20250715107']);
    
    console.log(`期号 20250715107 共有 ${bets.length} 位会员下注:`);
    for (const bet of bets) {
      console.log(`- ${bet.username}: ${bet.bet_count} 笔，总额 ${bet.total_amount} 元`);
    }
    
    // 2. 检查是否已有退水记录
    console.log('\n2. 检查现有退水记录:');
    const existingRebates = await db.any(`
      SELECT COUNT(*) as count
      FROM transaction_records
      WHERE transaction_type = 'rebate' AND period = $1
    `, ['20250715107']);
    
    if (existingRebates[0].count > 0) {
      console.log(`该期已有 ${existingRebates[0].count} 笔退水记录，跳过处理`);
      process.exit(0);
    }
    
    // 3. 执行退水处理
    console.log('\n3. 开始处理退水...');
    try {
      await processRebates('20250715107');
      console.log('✅ 退水处理成功');
    } catch (error) {
      console.error('退水处理失败:', error);
      
      // 如果自动处理失败，尝试手动计算
      console.log('\n尝试手动计算退水...');
      await manualCalculateRebate(bets);
    }
    
    // 4. 验证结果
    console.log('\n4. 验证退水结果:');
    const newRebates = await db.any(`
      SELECT 
        tr.amount,
        tr.description,
        CASE 
          WHEN tr.user_type = 'agent' THEN a.username
          ELSE 'unknown'
        END as username
      FROM transaction_records tr
      LEFT JOIN agents a ON tr.user_type = 'agent' AND tr.user_id = a.id
      WHERE tr.transaction_type = 'rebate' AND tr.period = $1
      ORDER BY tr.created_at
    `, ['20250715107']);
    
    if (newRebates.length > 0) {
      console.log('退水记录:');
      let totalRebate = 0;
      for (const rebate of newRebates) {
        console.log(`- ${rebate.username}: ${rebate.amount} 元`);
        totalRebate += parseFloat(rebate.amount);
      }
      console.log(`总退水金额: ${totalRebate.toFixed(2)} 元`);
    } else {
      console.log('⚠️ 没有找到退水记录');
    }
    
    // 5. 检查最新余额
    console.log('\n5. 最新代理余额:');
    const agents = await db.any(`
      SELECT username, balance FROM agents 
      WHERE username IN ($1, $2)
      ORDER BY username
    `, ['justin2025A', 'ti2025A']);
    
    for (const agent of agents) {
      console.log(`${agent.username}: ${agent.balance} 元`);
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

// 手动计算退水
async function manualCalculateRebate(bets) {
  for (const bet of bets) {
    if (bet.username === 'justin111') {
      const betAmount = parseFloat(bet.total_amount);
      const totalRebate = betAmount * 0.011; // A盘 1.1%
      
      console.log(`\n计算 ${bet.username} 的退水:`);
      console.log(`下注金额: ${betAmount}`);
      console.log(`总退水池: ${totalRebate.toFixed(2)} (1.1%)`);
      
      // justin2025A 获得 0.5%
      const justin2025ARebate = betAmount * 0.005;
      console.log(`justin2025A 应获得: ${justin2025ARebate.toFixed(2)} (0.5%)`);
      
      // ti2025A 获得剩余的 0.6%
      const ti2025ARebate = betAmount * 0.006;
      console.log(`ti2025A 应获得: ${ti2025ARebate.toFixed(2)} (0.6%)`);
    }
  }
}

manualProcessRebate();