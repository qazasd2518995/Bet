import db from './db/config.js';

async function checkSettlementTimeline() {
  try {
    console.log('=== 检查结算时间线和流程 ===\n');
    
    const periods = ['20250716001', '20250716013', '20250716031'];
    
    for (const period of periods) {
      console.log(`\n期号 ${period}:`);
      
      // 1. 检查下注和结算时间
      const betInfo = await db.any(`
        SELECT 
          id,
          username,
          amount,
          created_at,
          settled,
          settled_at,
          win,
          win_amount
        FROM bet_history
        WHERE period = $1
        ORDER BY id
      `, [period]);
      
      if (betInfo.length === 0) continue;
      
      console.log(`  下注数: ${betInfo.length} 笔`);
      const firstBetTime = betInfo[0].created_at;
      const lastBetTime = betInfo[betInfo.length - 1].created_at;
      const firstSettleTime = betInfo[0].settled_at;
      const lastSettleTime = betInfo[betInfo.length - 1].settled_at;
      
      console.log(`  下注时间: ${firstBetTime} - ${lastBetTime}`);
      console.log(`  结算时间: ${firstSettleTime} - ${lastSettleTime}`);
      
      // 计算时间差
      if (firstSettleTime) {
        const timeDiff = (new Date(firstSettleTime) - new Date(lastBetTime)) / 1000;
        console.log(`  下注到结算的时间差: ${timeDiff} 秒`);
      }
      
      // 2. 检查开奖时间
      const drawResult = await db.oneOrNone(`
        SELECT created_at
        FROM result_history
        WHERE period = $1
      `, [period]);
      
      if (drawResult) {
        console.log(`  开奖时间: ${drawResult.created_at}`);
      }
      
      // 3. 检查是否有中奖记录
      const winRecords = await db.any(`
        SELECT COUNT(*) as count, MIN(created_at) as first_time
        FROM transaction_records
        WHERE period = $1 AND transaction_type = 'win'
      `, [period]);
      
      console.log(`  中奖记录: ${winRecords[0].count} 笔`);
      if (winRecords[0].count > 0) {
        console.log(`  中奖记录时间: ${winRecords[0].first_time}`);
      }
      
      // 4. 检查退水记录时间
      const rebateRecords = await db.any(`
        SELECT COUNT(*) as count, MIN(created_at) as first_time
        FROM transaction_records
        WHERE period = $1 AND transaction_type = 'rebate'
      `, [period]);
      
      if (rebateRecords[0].count > 0) {
        console.log(`  退水记录: ${rebateRecords[0].count} 笔`);
        console.log(`  退水时间: ${rebateRecords[0].first_time}`);
      } else {
        console.log(`  退水记录: 无`);
      }
      
      // 5. 分析结算模式
      console.log('\n  分析:');
      
      // 检查是否所有投注的 settled_at 时间完全相同
      const uniqueSettleTimes = [...new Set(betInfo.map(b => b.settled_at?.toISOString()))];
      console.log(`  结算时间点数: ${uniqueSettleTimes.length}`);
      
      if (uniqueSettleTimes.length === 1) {
        console.log(`  ⚠️ 所有投注在同一时间点结算，可能是批量结算`);
      }
      
      // 检查 win_amount 是否都为 0
      const hasWinAmount = betInfo.some(b => b.win_amount > 0);
      if (!hasWinAmount) {
        console.log(`  ⚠️ 没有任何 win_amount > 0，可能使用了不更新 win_amount 的结算系统`);
      }
    }
    
    console.log('\n\n=== 结论 ===');
    console.log('问题原因:');
    console.log('1. 投注在 settleBets 被调用之前就已经被标记为 settled = true');
    console.log('2. 可能是其他结算逻辑先执行了（例如在开奖时直接更新）');
    console.log('3. enhancedSettlement 看到所有投注都已结算，所以跳过处理');
    console.log('4. 后续的退水检查机制可能因为某些原因失败');
    
    console.log('\n建议检查:');
    console.log('- 在开奖逻辑中是否有直接更新 bet_history.settled = true 的代码');
    console.log('- 是否有其他地方调用了结算逻辑');
    console.log('- backend.js 的独立退水检查为何失效');
    
    process.exit(0);
    
  } catch (error) {
    console.error('检查过程中发生错误:', error);
    process.exit(1);
  }
}

checkSettlementTimeline();