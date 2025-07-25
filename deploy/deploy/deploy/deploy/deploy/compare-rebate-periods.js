import db from './db/config.js';

async function compareRebatePeriods() {
  try {
    console.log('=== 比較期號 20250716109 和 20250716121 的退水金額 ===\n');
    
    const periods = ['20250716109', '20250716121'];
    
    for (const period of periods) {
      console.log(`\n期號 ${period}:`);
      console.log('='.repeat(50));
      
      // 1. 檢查下注記錄
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
      
      console.log(`\n下注記錄 (共 ${bets.length} 筆):`);
      let totalBetAmount = 0;
      bets.forEach(bet => {
        console.log(`  - ${bet.username}: $${bet.amount} on ${bet.bet_type}-${bet.bet_value}`);
        console.log(`    結果: ${bet.win ? '贏' : '輸'}, 贏得金額: $${bet.win_amount || 0}`);
        console.log(`    結算: ${bet.settled ? '✅' : '❌'}`);
        totalBetAmount += parseFloat(bet.amount);
      });
      console.log(`  總下注金額: $${totalBetAmount.toFixed(2)}`);
      
      // 2. 檢查退水記錄
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
      
      console.log(`\n退水記錄 (共 ${rebates.length} 筆):`);
      let totalRebateAmount = 0;
      rebates.forEach(rebate => {
        console.log(`  - ${rebate.agent_username} (層級 ${rebate.agent_level}): $${rebate.amount}`);
        console.log(`    時間: ${new Date(rebate.created_at).toLocaleString()}`);
        totalRebateAmount += parseFloat(rebate.amount);
      });
      console.log(`  總退水金額: $${totalRebateAmount.toFixed(2)}`);
      
      // 3. 計算退水率
      if (totalBetAmount > 0) {
        const rebateRate = (totalRebateAmount / totalBetAmount * 100).toFixed(2);
        console.log(`  退水率: ${rebateRate}%`);
      }
      
      // 4. 檢查代理層級和退水設定
      if (rebates.length > 0) {
        console.log(`\n代理退水設定分析:`);
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
            console.log(`    層級: ${agentInfo.level}`);
            console.log(`    退水比例: ${agentInfo.rebate_percentage || 'N/A'}%`);
          }
        }
      }
      
      // 5. 檢查開獎結果
      const result = await db.oneOrNone(`
        SELECT * FROM result_history
        WHERE period = $1
      `, [period]);
      
      if (result) {
        console.log(`\n開獎結果: ${result.result}`);
        console.log(`開獎時間: ${new Date(result.created_at).toLocaleString()}`);
      }
    }
    
    // 6. 比較分析
    console.log('\n\n=== 比較分析 ===');
    console.log('檢查兩個期號的退水計算是否有模式或錯誤...');
    
    // 獲取兩個期號的詳細數據進行比較
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
        console.log(`\n期號 ${period} 統計:`);
        console.log(`  - 代理數量: ${analysis.agent_count}`);
        console.log(`  - 退水筆數: ${analysis.rebate_count}`);
        console.log(`  - 總退水: $${parseFloat(analysis.total_rebate).toFixed(2)}`);
        console.log(`  - 最高退水: $${parseFloat(analysis.max_rebate).toFixed(2)}`);
        console.log(`  - 最低退水: $${parseFloat(analysis.min_rebate).toFixed(2)}`);
        console.log(`  - 平均退水: $${parseFloat(analysis.avg_rebate).toFixed(2)}`);
      }
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('查詢過程中發生錯誤:', error);
    process.exit(1);
  }
}

compareRebatePeriods();