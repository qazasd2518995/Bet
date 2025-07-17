import db from './db/config.js';

async function debugSettlementTrigger() {
  try {
    console.log('=== 調試結算觸發機制 ===\n');
    
    // 檢查最近幾期的結算狀況
    const recentPeriods = await db.any(`
      SELECT DISTINCT period 
      FROM bet_history 
      WHERE period >= 20250716150 
      ORDER BY period DESC 
      LIMIT 10
    `);
    
    console.log('最近期號:', recentPeriods.map(p => p.period).join(', '));
    
    for (const periodRow of recentPeriods.slice(0, 5)) {
      const period = periodRow.period;
      console.log(`\n=== 檢查期號 ${period} ===`);
      
      // 1. 檢查下注情況
      const bets = await db.any(`
        SELECT id, username, amount, settled, win, win_amount, created_at
        FROM bet_history 
        WHERE period = $1
        ORDER BY created_at
      `, [period]);
      
      console.log(`  下注記錄: ${bets.length} 筆`);
      if (bets.length > 0) {
        bets.forEach(bet => {
          console.log(`    ID ${bet.id}: ${bet.username} $${bet.amount} ${bet.settled ? '✅已結算' : '❌未結算'} ${bet.win ? `中獎$${bet.win_amount}` : '未中'}`);
        });
      }
      
      // 2. 檢查開獎記錄
      const result = await db.oneOrNone(`
        SELECT result, created_at 
        FROM result_history 
        WHERE period = $1
      `, [period]);
      
      console.log(`  開獎記錄: ${result ? '✅' + result.result : '❌無'}`);
      
      // 3. 檢查結算日誌
      const settlementLog = await db.oneOrNone(`
        SELECT * FROM settlement_logs 
        WHERE period = $1
      `, [period]);
      
      console.log(`  結算日誌: ${settlementLog ? '✅有' : '❌無'}`);
      if (settlementLog) {
        console.log(`    結算時間: ${settlementLog.created_at}`);
        console.log(`    結算筆數: ${settlementLog.settled_count}`);
      }
      
      // 4. 檢查退水記錄
      const rebates = await db.any(`
        SELECT tr.amount, a.username as agent_username
        FROM transaction_records tr
        JOIN agents a ON tr.user_id = a.id AND tr.user_type = 'agent'
        WHERE tr.period = $1 AND tr.transaction_type = 'rebate'
      `, [period]);
      
      console.log(`  退水記錄: ${rebates.length} 筆`);
      if (rebates.length > 0) {
        rebates.forEach(r => {
          console.log(`    ${r.agent_username}: $${r.amount}`);
        });
      }
      
      // 5. 問題診斷
      const hasSettledBets = bets.some(b => b.settled);
      const hasResult = !!result;
      const hasSettlementLog = !!settlementLog;
      const hasRebates = rebates.length > 0;
      
      if (hasSettledBets && hasResult) {
        if (!hasSettlementLog && !hasRebates) {
          console.log(`  🚨 問題期號: 有結算注單和開獎但無結算日誌和退水`);
        } else if (!hasRebates && hasSettlementLog) {
          console.log(`  ⚠️ 部分問題: 有結算日誌但無退水記錄`);
        } else if (hasRebates && hasSettlementLog) {
          console.log(`  ✅ 正常期號: 結算和退水都正常`);
        }
      }
    }
    
    // 檢查後端日誌中的結算相關信息
    console.log('\n=== 檢查結算觸發邏輯 ===');
    
    // 檢查 backend.js 中的結算調用
    const fs = await import('fs');
    const backendContent = fs.readFileSync('./backend.js', 'utf8');
    
    // 查找結算相關的函數調用
    const settlementCalls = [];
    if (backendContent.includes('enhancedSettlement')) settlementCalls.push('enhancedSettlement');
    if (backendContent.includes('optimizedSettlement')) settlementCalls.push('optimizedSettlement');
    if (backendContent.includes('improvedSettleBets')) settlementCalls.push('improvedSettleBets');
    if (backendContent.includes('comprehensiveSettlement')) settlementCalls.push('comprehensiveSettlement');
    
    console.log(`後端結算函數: ${settlementCalls.join(', ')}`);
    
    // 檢查開獎完成後的邏輯
    const drawCompleteMatches = backendContent.match(/開獎完成.*[\s\S]{0,500}/g);
    if (drawCompleteMatches) {
      console.log('\n開獎完成後的邏輯:');
      drawCompleteMatches.slice(0, 2).forEach((match, i) => {
        console.log(`  片段 ${i + 1}: ${match.substring(0, 200)}...`);
      });
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('調試過程中發生錯誤:', error);
    process.exit(1);
  }
}

debugSettlementTrigger();