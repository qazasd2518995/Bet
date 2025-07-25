const { Pool } = require('pg');

const pool = new Pool({
  user: 'justin',
  host: 'localhost',
  database: 'bet_game',
  password: '',
  port: 5432,
});

async function fixRebateSimple() {
  console.log('🔧 修正退水設定邏輯...\n');
  
  try {
    // 1. 修正 none 模式的代理
    console.log('修正 none 模式代理（應該是0%）...');
    const noneResult = await pool.query(`
      UPDATE agents 
      SET rebate_percentage = 0 
      WHERE rebate_mode = 'none' AND rebate_percentage > 0
      RETURNING id, username, rebate_mode
    `);
    console.log(`✅ 修正了 ${noneResult.rowCount} 個 none 模式代理\n`);
    
    // 2. 修正 all 模式的代理
    console.log('修正 all 模式代理（應該是最大值）...');
    const allResult = await pool.query(`
      UPDATE agents 
      SET rebate_percentage = max_rebate_percentage 
      WHERE rebate_mode = 'all' AND rebate_percentage != max_rebate_percentage
      RETURNING id, username, rebate_mode, rebate_percentage, max_rebate_percentage
    `);
    console.log(`✅ 修正了 ${allResult.rowCount} 個 all 模式代理\n`);
    
    // 3. 檢查A盤代理是否還有超標問題
    console.log('檢查A盤代理總退水...');
    const aMarketCheck = await pool.query(`
      SELECT 
        a.id,
        a.username,
        a.rebate_mode,
        ROUND(a.rebate_percentage * 100, 2) as agent_rebate_pct,
        p.username as parent_name,
        ROUND(COALESCE(p.rebate_percentage, 0) * 100, 2) as parent_rebate_pct,
        ROUND((a.rebate_percentage + COALESCE(p.rebate_percentage, 0)) * 100, 2) as total_rebate_pct
      FROM agents a
      LEFT JOIN agents p ON a.parent_id = p.id
      WHERE a.market_type = 'A' 
        AND (a.rebate_percentage + COALESCE(p.rebate_percentage, 0)) > 0.011
      ORDER BY (a.rebate_percentage + COALESCE(p.rebate_percentage, 0)) DESC
    `);
    
    if (aMarketCheck.rows.length > 0) {
      console.log('❌ A盤仍有退水超標問題：');
      console.table(aMarketCheck.rows);
    } else {
      console.log('✅ A盤沒有退水超標問題\n');
    }
    
    // 4. 檢查D盤代理是否還有超標問題
    console.log('檢查D盤代理總退水...');
    const dMarketCheck = await pool.query(`
      SELECT 
        a.id,
        a.username,
        a.rebate_mode,
        ROUND(a.rebate_percentage * 100, 2) as agent_rebate_pct,
        p.username as parent_name,
        ROUND(COALESCE(p.rebate_percentage, 0) * 100, 2) as parent_rebate_pct,
        ROUND((a.rebate_percentage + COALESCE(p.rebate_percentage, 0)) * 100, 2) as total_rebate_pct
      FROM agents a
      LEFT JOIN agents p ON a.parent_id = p.id
      WHERE a.market_type = 'D' 
        AND (a.rebate_percentage + COALESCE(p.rebate_percentage, 0)) > 0.041
      ORDER BY (a.rebate_percentage + COALESCE(p.rebate_percentage, 0)) DESC
      LIMIT 10
    `);
    
    if (dMarketCheck.rows.length > 0) {
      console.log('❌ D盤仍有退水超標問題（前10個）：');
      console.table(dMarketCheck.rows);
    } else {
      console.log('✅ D盤沒有退水超標問題\n');
    }
    
    // 5. 顯示修正說明
    console.log('=== 退水機制修正說明 ===\n');
    console.log('✅ 正確的退水概念：');
    console.log('• 「全拿退水」(all)：本代理拿走所有退水，下級代理 rebate_percentage = 0%');
    console.log('• 「全退下級」(none)：本代理不拿退水，下級代理 rebate_percentage = 最大值');
    console.log('• 「按比例分配」(percentage)：下級代理拿設定比例，其餘歸本代理\n');
    
    console.log('⚠️  重要提醒：');
    console.log('如果代理鏈中仍有總退水超標的情況，需要：');
    console.log('1. 調整代理的退水比例設定');
    console.log('2. 重新設計代理層級結構');
    console.log('3. 確保總退水不超過盤口限制（A盤1.1%，D盤4.1%）\n');
    
    // 6. 最終檢查
    console.log('最終檢查所有代理設定...');
    const finalCheck = await pool.query(`
      SELECT 
        COUNT(*) as total_agents,
        SUM(CASE WHEN rebate_mode = 'none' AND rebate_percentage = 0 THEN 1 ELSE 0 END) as correct_none,
        SUM(CASE WHEN rebate_mode = 'all' AND rebate_percentage = max_rebate_percentage THEN 1 ELSE 0 END) as correct_all,
        SUM(CASE WHEN rebate_mode = 'percentage' AND rebate_percentage > 0 AND rebate_percentage <= max_rebate_percentage THEN 1 ELSE 0 END) as correct_percentage
      FROM agents
      WHERE level > 0
    `);
    
    const stats = finalCheck.rows[0];
    console.log(`總代理數: ${stats.total_agents}`);
    console.log(`正確的 none 模式: ${stats.correct_none}`);
    console.log(`正確的 all 模式: ${stats.correct_all}`);
    console.log(`正確的 percentage 模式: ${stats.correct_percentage}`);
    
    const correctTotal = parseInt(stats.correct_none) + parseInt(stats.correct_all) + parseInt(stats.correct_percentage);
    if (correctTotal === parseInt(stats.total_agents)) {
      console.log('\n🎉 所有代理退水設定邏輯正確！');
    } else {
      console.log(`\n⚠️  仍有 ${parseInt(stats.total_agents) - correctTotal} 個代理需要手動調整`);
    }
    
  } catch (error) {
    console.error('修正過程中發生錯誤:', error);
  } finally {
    await pool.end();
  }
}

fixRebateSimple(); 