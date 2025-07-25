import db from './db/config.js';

async function checkBetBalanceIssue() {
  try {
    console.log('=== 检查下注余额问题 ===');
    
    // 1. 检查期号 20250715107 的下注记录
    console.log('\n1. 检查期号 20250715107 的下注记录:');
    const bets = await db.any(`
      SELECT * FROM bet_history 
      WHERE period = $1 
      ORDER BY created_at DESC
    `, ['20250715107']);
    
    console.log(`找到 ${bets.length} 笔下注记录`);
    for (const bet of bets) {
      console.log(`\nID: ${bet.id}`);
      console.log(`用户: ${bet.username}`);
      console.log(`金额: ${bet.amount}`);
      console.log(`类型: ${bet.bet_type} - ${bet.bet_value}`);
      console.log(`位置: ${bet.position}`);
      console.log(`赔率: ${bet.odds}`);
      console.log(`结算: ${bet.settled ? '是' : '否'}`);
      console.log(`中奖: ${bet.win ? '是' : '否'}`);
      console.log(`创建时间: ${bet.created_at}`);
    }
    
    // 2. 检查 justin111 的交易记录
    console.log('\n2. 检查 justin111 最近的交易记录:');
    const transactions = await db.any(`
      SELECT * FROM transaction_records 
      WHERE user_type = 'member' 
        AND user_id = (SELECT id FROM members WHERE username = 'justin111')
        AND created_at > NOW() - INTERVAL '1 hour'
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    for (const tx of transactions) {
      console.log(`\n时间: ${tx.created_at}`);
      console.log(`类型: ${tx.transaction_type}`);
      console.log(`金额: ${tx.amount}`);
      console.log(`余额前: ${tx.balance_before}`);
      console.log(`余额后: ${tx.balance_after}`);
      console.log(`描述: ${tx.description}`);
    }
    
    // 3. 检查当前余额
    console.log('\n3. 当前余额:');
    const member = await db.oneOrNone('SELECT username, balance FROM members WHERE username = $1', ['justin111']);
    const agents = await db.any(`
      SELECT username, balance FROM agents 
      WHERE username IN ($1, $2)
      ORDER BY username
    `, ['justin2025A', 'ti2025A']);
    
    if (member) {
      console.log(`justin111: ${member.balance} 元`);
    }
    
    for (const agent of agents) {
      console.log(`${agent.username}: ${agent.balance} 元`);
    }
    
    // 4. 检查该期号的结算状态
    console.log('\n4. 检查期号 20250715107 的结算状态:');
    const drawResult = await db.oneOrNone(`
      SELECT * FROM result_history 
      WHERE period = $1
    `, ['20250715107']);
    
    if (drawResult) {
      console.log('开奖结果:', drawResult.result);
      console.log('开奖时间:', drawResult.created_at);
    } else {
      console.log('该期号尚未开奖');
    }
    
    // 5. 检查是否有退水记录
    console.log('\n5. 检查该期号的退水记录:');
    const rebates = await db.any(`
      SELECT * FROM transaction_records 
      WHERE transaction_type = 'rebate' 
        AND period = $1
      ORDER BY created_at DESC
    `, ['20250715107']);
    
    console.log(`找到 ${rebates.length} 笔退水记录`);
    for (const rebate of rebates) {
      const user = await db.oneOrNone(
        rebate.user_type === 'agent' 
          ? 'SELECT username FROM agents WHERE id = $1'
          : 'SELECT username FROM members WHERE id = $1',
        [rebate.user_id]
      );
      console.log(`${rebate.created_at}: ${user?.username || '未知'} 获得退水 ${rebate.amount} 元`);
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

checkBetBalanceIssue();