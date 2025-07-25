import db from './db/config.js';

async function compareRebatePeriods() {
  try {
    console.log('=== 比较期号 20250716109 和 20250716121 的退水金额 ===\n');
    
    const periods = ['20250716109', '20250716121'];
    
    for (const period of periods) {
      console.log(`\n期号 ${period}:`);
      console.log('='.repeat(50));
      
      // 1. 检查下注记录
      const bets = await db.any(`
        SELECT 
          id,
          username,
          amount,
          bet_type,
          bet_value,
          win,
          win_amount,
          settled,
          created_at,
          settled_at
        FROM bet_history
        WHERE period = $1
        ORDER BY created_at
      `, [period]);
      
      console.log(`\n下注记录 (共 ${bets.length} 笔):`);
      let totalBetAmount = 0;
      bets.forEach(bet => {
        console.log(`  - ${bet.username}: $${bet.amount} on ${bet.bet_type}-${bet.bet_value}`);
        console.log(`    结果: ${bet.win ? '赢' : '输'}, 赢得金额: $${bet.win_amount || 0}`);
        console.log(`    结算: ${bet.settled ? '✅' : '❌'}`);
        totalBetAmount += parseFloat(bet.amount);
      });
      console.log(`  总下注金额: $${totalBetAmount.toFixed(2)}`);
      
      // 2. 检查退水记录
      const rebates = await db.any(`
        SELECT 
          tr.*,
          a.username as agent_username,
          a.level as agent_level
        FROM transaction_records tr
        LEFT JOIN agents a ON tr.user_type = 'agent' AND tr.user_id = a.id
        WHERE tr.period = $1 
          AND tr.transaction_type = 'rebate'
        ORDER BY tr.created_at
      `, [period]);
      
      console.log(`\n退水记录 (共 ${rebates.length} 笔):`);
      let totalRebateAmount = 0;
      rebates.forEach(rebate => {
        console.log(`  - ${rebate.agent_username} (层级 ${rebate.agent_level}): $${rebate.amount}`);
        console.log(`    时间: ${new Date(rebate.created_at).toLocaleString()}`);
        totalRebateAmount += parseFloat(rebate.amount);
      });
      console.log(`  总退水金额: $${totalRebateAmount.toFixed(2)}`);
      
      // 3. 计算退水率
      if (totalBetAmount > 0) {
        const rebateRate = (totalRebateAmount / totalBetAmount * 100).toFixed(2);
        console.log(`  退水率: ${rebateRate}%`);
      }
      
      // 4. 检查代理层级和退水设定
      if (rebates.length > 0) {
        console.log(`\n代理退水设定分析:`);
        const agentIds = [...new Set(rebates.map(r => r.user_id))];
        
        for (const agentId of agentIds) {
          const agentInfo = await db.oneOrNone(`
            SELECT 
              a.username,
              a.level,
              ars.rebate_percentage
            FROM agents a
            LEFT JOIN agent_rebate_settings ars ON a.id = ars.agent_id
            WHERE a.id = $1
          `, [agentId]);
          
          if (agentInfo) {
            console.log(`  - ${agentInfo.username} (ID: ${agentId}):`);
            console.log(`    层级: ${agentInfo.level}`);
            console.log(`    退水比例: ${agentInfo.rebate_percentage || 'N/A'}%`);
          }
        }
      }
      
      // 5. 检查开奖结果
      const result = await db.oneOrNone(`
        SELECT * FROM result_history
        WHERE period = $1
      `, [period]);
      
      if (result) {
        console.log(`\n开奖结果: ${result.result}`);
        console.log(`开奖时间: ${new Date(result.created_at).toLocaleString()}`);
      }
    }
    
    // 6. 比较分析
    console.log('\n\n=== 比较分析 ===');
    console.log('检查两个期号的退水计算是否有模式或错误...');
    
    // 获取两个期号的详细数据进行比较
    for (const period of periods) {
      const analysis = await db.oneOrNone(`
        SELECT 
          COUNT(DISTINCT tr.user_id) as agent_count,
          COUNT(tr.id) as rebate_count,
          SUM(tr.amount) as total_rebate,
          MAX(tr.amount) as max_rebate,
          MIN(tr.amount) as min_rebate,
          AVG(tr.amount) as avg_rebate
        FROM transaction_records tr
        WHERE tr.period = $1 
          AND tr.transaction_type = 'rebate'
      `, [period]);
      
      if (analysis && analysis.rebate_count > 0) {
        console.log(`\n期号 ${period} 统计:`);
        console.log(`  - 代理数量: ${analysis.agent_count}`);
        console.log(`  - 退水笔数: ${analysis.rebate_count}`);
        console.log(`  - 总退水: $${parseFloat(analysis.total_rebate).toFixed(2)}`);
        console.log(`  - 最高退水: $${parseFloat(analysis.max_rebate).toFixed(2)}`);
        console.log(`  - 最低退水: $${parseFloat(analysis.min_rebate).toFixed(2)}`);
        console.log(`  - 平均退水: $${parseFloat(analysis.avg_rebate).toFixed(2)}`);
      }
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('查询过程中发生错误:', error);
    process.exit(1);
  }
}

compareRebatePeriods();