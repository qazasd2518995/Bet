const { Pool } = require('pg');

const pool = new Pool({
  user: 'justin',
  host: 'localhost',
  database: 'bet_game',
  password: '',
  port: 5432,
});

async function checkRebateIssues() {
  console.log('🔍 檢查退水設定問題...\n');
  
  try {
    // 1. 檢查 none 模式但仍有退水比例的代理
    console.log('❌ 檢查 None模式但仍有退水比例的代理:');
    const noneIssues = await pool.query(`
      SELECT 
        a.id as agent_id,
        a.username as agent_name,
        a.rebate_mode,
        a.rebate_percentage,
        a.max_rebate_percentage,
        a.market_type,
        p.username as parent_name,
        p.rebate_percentage as parent_rebate_percentage
      FROM agents a
      LEFT JOIN agents p ON a.parent_id = p.id
      WHERE a.rebate_mode = 'none' AND a.rebate_percentage > 0
      ORDER BY a.id
    `);
    
    if (noneIssues.rows.length > 0) {
      console.table(noneIssues.rows);
    } else {
      console.log('✅ 沒有發現 none 模式的退水問題\n');
    }

    // 2. 檢查A盤代理的總退水是否超標
    console.log('🅰️ 檢查A盤代理退水是否超標:');
    const aMarketCheck = await pool.query(`
      SELECT 
        a.id as agent_id,
        a.username as agent_name,
        a.rebate_mode,
        ROUND(a.rebate_percentage * 100, 2) as agent_rebate_pct,
        ROUND(COALESCE(p.rebate_percentage, 0) * 100, 2) as parent_rebate_pct,
        ROUND((a.rebate_percentage + COALESCE(p.rebate_percentage, 0)) * 100, 2) as total_rebate_pct,
        CASE 
          WHEN (a.rebate_percentage + COALESCE(p.rebate_percentage, 0)) > 0.011 
          THEN '❌ 超過A盤限制(1.1%)'
          ELSE '✅ 正常'
        END as status
      FROM agents a
      LEFT JOIN agents p ON a.parent_id = p.id
      WHERE a.market_type = 'A' 
      ORDER BY (a.rebate_percentage + COALESCE(p.rebate_percentage, 0)) DESC
    `);
    
    console.table(aMarketCheck.rows);

    // 3. 檢查D盤代理的總退水是否超標
    console.log('\n🇩 檢查D盤代理退水是否超標:');
    const dMarketCheck = await pool.query(`
      SELECT 
        a.id as agent_id,
        a.username as agent_name,
        a.rebate_mode,
        ROUND(a.rebate_percentage * 100, 2) as agent_rebate_pct,
        ROUND(COALESCE(p.rebate_percentage, 0) * 100, 2) as parent_rebate_pct,
        ROUND((a.rebate_percentage + COALESCE(p.rebate_percentage, 0)) * 100, 2) as total_rebate_pct,
        CASE 
          WHEN (a.rebate_percentage + COALESCE(p.rebate_percentage, 0)) > 0.041 
          THEN '❌ 超過D盤限制(4.1%)'
          ELSE '✅ 正常'
        END as status
      FROM agents a
      LEFT JOIN agents p ON a.parent_id = p.id
      WHERE a.market_type = 'D' AND (a.rebate_percentage + COALESCE(p.rebate_percentage, 0)) > 0.041
      ORDER BY (a.rebate_percentage + COALESCE(p.rebate_percentage, 0)) DESC
    `);
    
    if (dMarketCheck.rows.length > 0) {
      console.table(dMarketCheck.rows);
    } else {
      console.log('✅ 沒有發現D盤超標問題\n');
    }

    // 4. 特別檢查圖片中提到的問題代理
    console.log('🎯 檢查圖片中提到的問題代理:');
    const specificCheck = await pool.query(`
      SELECT 
        a.id as agent_id,
        a.username as agent_name,
        a.rebate_mode,
        ROUND(a.rebate_percentage * 100, 2) as agent_rebate_pct,
        p.username as parent_name,
        ROUND(COALESCE(p.rebate_percentage, 0) * 100, 2) as parent_rebate_pct,
        a.market_type,
        CASE 
          WHEN a.rebate_mode = 'none' AND a.rebate_percentage > 0 THEN '❌ none模式應該是0%'
          WHEN a.rebate_mode = 'all' AND a.rebate_percentage != (COALESCE(a.max_rebate_percentage, 0.041)) THEN '❌ all模式應該是最大值'
          WHEN a.market_type = 'A' AND (a.rebate_percentage + COALESCE(p.rebate_percentage, 0)) > 0.011 THEN '❌ 超過A盤限制'
          ELSE '✅ 正常'
        END as issue
      FROM agents a
      LEFT JOIN agents p ON a.parent_id = p.id
      WHERE a.id IN (31, 65, 30) -- 圖片中問題代理
      ORDER BY a.id
    `);
    
    console.table(specificCheck.rows);

  } catch (error) {
    console.error('檢查錯誤:', error);
  } finally {
    await pool.end();
  }
}

checkRebateIssues(); 