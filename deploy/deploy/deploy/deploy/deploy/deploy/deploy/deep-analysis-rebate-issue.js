import db from './db/config.js';

async function deepAnalysisRebateIssue() {
  console.log('=== 深度分析退水機制未觸發原因 ===\n');
  
  console.log('🔍 分析架構:');
  console.log('1. backend.js 調用 settleBets()');
  console.log('2. settleBets() 嘗試使用三個結算系統:');
  console.log('   a) enhancedSettlement (主要)');
  console.log('   b) optimizedSettlement (備用1)');
  console.log('   c) improvedSettleBets (備用2)');
  console.log('3. 退水處理邏輯:');
  console.log('   - enhancedSettlement: ✅ 內部調用 processRebates');
  console.log('   - optimizedSettlement: ⚠️ 只有空的 processRebatesAsync 函數');
  console.log('   - improvedSettleBets: ✅ 內部調用 processRebates\n');
  
  // 檢查最近使用哪個結算系統
  console.log('📊 檢查最近的結算模式:');
  
  // 查詢最近的結算記錄，看看是否有錯誤日誌
  const recentPeriods = await db.any(`
    SELECT DISTINCT period 
    FROM bet_history 
    WHERE settled = true 
      AND created_at > NOW() - INTERVAL '24 hours'
    ORDER BY period DESC
    LIMIT 10
  `);
  
  console.log('最近已結算的期號:');
  for (const p of recentPeriods) {
    // 檢查每個期號的退水情況
    const rebateCount = await db.oneOrNone(`
      SELECT COUNT(*) as count 
      FROM transaction_records 
      WHERE period = $1 AND transaction_type = 'rebate'
    `, [p.period]);
    
    const betCount = await db.oneOrNone(`
      SELECT COUNT(*) as count, SUM(amount) as total
      FROM bet_history 
      WHERE period = $1 AND settled = true
    `, [p.period]);
    
    const hasRebate = rebateCount && parseInt(rebateCount.count) > 0;
    console.log(`  ${p.period}: ${betCount.count}筆下注, 總額$${betCount.total || 0}, 退水: ${hasRebate ? '✅' : '❌'}`);
  }
  
  console.log('\n🔎 根本原因分析:');
  console.log('1. 如果 enhancedSettlement 失敗，系統會使用備用結算系統');
  console.log('2. optimizedSettlement 的 processRebatesAsync 是空函數，不會處理退水');
  console.log('3. 這解釋了為什麼有些期號結算成功但沒有退水\n');
  
  console.log('🛠️ 建議修復方案:');
  console.log('1. 修復 optimizedSettlement 中的 processRebatesAsync 函數');
  console.log('2. 在 settleBets 函數中，無論使用哪個結算系統，都確保調用退水處理');
  console.log('3. 添加退水處理的獨立檢查機制，確保不會遺漏\n');
  
  // 生成修復代碼
  console.log('📝 建議的修復代碼:\n');
  console.log(`// 在 optimized-betting-system.js 中修復 processRebatesAsync:
async function processRebatesAsync(period) {
    try {
        console.log(\`開始處理期號 \${period} 的退水...\`);
        // 引入 enhanced-settlement-system 的退水處理
        const { processRebates } = await import('./enhanced-settlement-system.js');
        await processRebates(period);
    } catch (error) {
        console.error(\`退水處理失敗: \${error.message}\`);
    }
}

// 在 backend.js 的 settleBets 函數末尾添加退水檢查:
async function settleBets(period, winResult) {
    // ... 現有的結算邏輯 ...
    
    // 確保退水處理（獨立檢查）
    try {
        const hasRebates = await db.oneOrNone(\`
            SELECT COUNT(*) as count FROM transaction_records
            WHERE period = $1 AND transaction_type = 'rebate'
        \`, [period]);
        
        if (!hasRebates || parseInt(hasRebates.count) === 0) {
            console.log(\`⚠️ 檢測到期號 \${period} 未處理退水，立即處理...\`);
            const { processRebates } = await import('./enhanced-settlement-system.js');
            await processRebates(period);
        }
    } catch (rebateError) {
        console.error(\`退水檢查失敗: \${rebateError.message}\`);
    }
}`);
  
  process.exit(0);
}

deepAnalysisRebateIssue().catch(err => {
  console.error('分析失敗:', err);
  process.exit(1);
});