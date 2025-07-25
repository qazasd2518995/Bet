import db from './db/config.js';

async function deepAnalysisRebateIssue() {
  console.log('=== 深度分析退水机制未触发原因 ===\n');
  
  console.log('🔍 分析架构:');
  console.log('1. backend.js 调用 settleBets()');
  console.log('2. settleBets() 尝试使用三个结算系统:');
  console.log('   a) enhancedSettlement (主要)');
  console.log('   b) optimizedSettlement (备用1)');
  console.log('   c) improvedSettleBets (备用2)');
  console.log('3. 退水处理逻辑:');
  console.log('   - enhancedSettlement: ✅ 内部调用 processRebates');
  console.log('   - optimizedSettlement: ⚠️ 只有空的 processRebatesAsync 函数');
  console.log('   - improvedSettleBets: ✅ 内部调用 processRebates\n');
  
  // 检查最近使用哪个结算系统
  console.log('📊 检查最近的结算模式:');
  
  // 查询最近的结算记录，看看是否有错误日志
  const recentPeriods = await db.any(`
    SELECT DISTINCT period 
    FROM bet_history 
    WHERE settled = true 
      AND created_at > NOW() - INTERVAL '24 hours'
    ORDER BY period DESC
    LIMIT 10
  `);
  
  console.log('最近已结算的期号:');
  for (const p of recentPeriods) {
    // 检查每个期号的退水情况
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
    console.log(`  ${p.period}: ${betCount.count}笔下注, 总额$${betCount.total || 0}, 退水: ${hasRebate ? '✅' : '❌'}`);
  }
  
  console.log('\n🔎 根本原因分析:');
  console.log('1. 如果 enhancedSettlement 失败，系统会使用备用结算系统');
  console.log('2. optimizedSettlement 的 processRebatesAsync 是空函数，不会处理退水');
  console.log('3. 这解释了为什么有些期号结算成功但没有退水\n');
  
  console.log('🛠️ 建议修复方案:');
  console.log('1. 修复 optimizedSettlement 中的 processRebatesAsync 函数');
  console.log('2. 在 settleBets 函数中，无论使用哪个结算系统，都确保调用退水处理');
  console.log('3. 添加退水处理的独立检查机制，确保不会遗漏\n');
  
  // 生成修复代码
  console.log('📝 建议的修复代码:\n');
  console.log(`// 在 optimized-betting-system.js 中修复 processRebatesAsync:
async function processRebatesAsync(period) {
    try {
        console.log(\`开始处理期号 \${period} 的退水...\`);
        // 引入 enhanced-settlement-system 的退水处理
        const { processRebates } = await import('./enhanced-settlement-system.js');
        await processRebates(period);
    } catch (error) {
        console.error(\`退水处理失败: \${error.message}\`);
    }
}

// 在 backend.js 的 settleBets 函数末尾添加退水检查:
async function settleBets(period, winResult) {
    // ... 现有的结算逻辑 ...
    
    // 确保退水处理（独立检查）
    try {
        const hasRebates = await db.oneOrNone(\`
            SELECT COUNT(*) as count FROM transaction_records
            WHERE period = $1 AND transaction_type = 'rebate'
        \`, [period]);
        
        if (!hasRebates || parseInt(hasRebates.count) === 0) {
            console.log(\`⚠️ 检测到期号 \${period} 未处理退水，立即处理...\`);
            const { processRebates } = await import('./enhanced-settlement-system.js');
            await processRebates(period);
        }
    } catch (rebateError) {
        console.error(\`退水检查失败: \${rebateError.message}\`);
    }
}`);
  
  process.exit(0);
}

deepAnalysisRebateIssue().catch(err => {
  console.error('分析失败:', err);
  process.exit(1);
});