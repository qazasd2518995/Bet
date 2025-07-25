const { Pool } = require('pg');

const pool = new Pool({
  user: 'justin',
  host: 'localhost',
  database: 'bet_game',
  password: '',
  port: 5432,
});

async function fixRebateLogic() {
  console.log('🔧 修正退水設定和分配邏輯...\n');
  
  try {
    // 1. 首先修正所有代理的退水設定
    console.log('第一步：修正代理退水設定...\n');
    
    // 修正 none 模式的代理
    await pool.query(`
      UPDATE agents 
      SET rebate_percentage = 0 
      WHERE rebate_mode = 'none' AND rebate_percentage > 0
    `);
    
    // 修正 all 模式的代理  
    await pool.query(`
      UPDATE agents 
      SET rebate_percentage = max_rebate_percentage 
      WHERE rebate_mode = 'all' AND rebate_percentage != max_rebate_percentage
    `);
    
    console.log('✅ 代理退水設定修正完成\n');
    
    // 2. 檢查並修正退水總額超標的代理鏈
    console.log('第二步：檢查退水總額超標問題...\n');
    
    // 找出所有超標的代理鏈
    const overLimitAgents = await pool.query(`
      WITH RECURSIVE agent_chain AS (
        -- 起始條件：所有有父級的代理
        SELECT 
          a.id,
          a.username,
          a.level,
          a.parent_id,
          a.rebate_percentage,
          a.max_rebate_percentage,
          a.market_type,
          ARRAY[a.id] as chain_ids,
          ARRAY[a.rebate_percentage] as chain_rebates
        FROM agents a
        WHERE a.parent_id IS NOT NULL
        
        UNION ALL
        
        -- 遞歸條件：向上查找父級
        SELECT 
          ac.id,
          ac.username,
          ac.level,
          p.parent_id,
          ac.rebate_percentage,
          ac.max_rebate_percentage,
          ac.market_type,
          array_append(ac.chain_ids, p.id) as chain_ids,
          array_append(ac.chain_rebates, p.rebate_percentage) as chain_rebates
        FROM agent_chain ac
        JOIN agents p ON ac.parent_id = p.id
        WHERE p.parent_id IS NOT NULL
      )
      SELECT DISTINCT
        id,
        username,
        level,
        rebate_percentage,
        max_rebate_percentage,
        market_type,
        (
          SELECT SUM(unnest) 
          FROM unnest(chain_rebates)
        ) as total_chain_rebate
      FROM agent_chain
      WHERE (
        (market_type = 'A' AND (
          SELECT SUM(unnest) 
          FROM unnest(chain_rebates)
        ) > 0.011)
        OR 
        (market_type = 'D' AND (
          SELECT SUM(unnest) 
          FROM unnest(chain_rebates)
        ) > 0.041)
      )
      ORDER BY total_chain_rebate DESC
    `);
    
    if (overLimitAgents.rows.length > 0) {
      console.log('❌ 發現退水總額超標的代理：');
      console.table(overLimitAgents.rows.map(agent => ({
        id: agent.id,
        username: agent.username,
        level: agent.level,
        agent_rebate: `${(agent.rebate_percentage * 100).toFixed(1)}%`,
        total_chain: `${(agent.total_chain_rebate * 100).toFixed(1)}%`,
        limit: `${(agent.max_rebate_percentage * 100).toFixed(1)}%`,
        market: agent.market_type,
        status: agent.total_chain_rebate > agent.max_rebate_percentage ? '❌ 超標' : '✅ 正常'
      })));
      
      console.log('\n⚠️  這些代理的代理鏈退水總額超過了盤口限制！');
      console.log('    建議重新設計代理鏈結構或調整退水比例。\n');
    } else {
      console.log('✅ 沒有發現退水總額超標問題\n');
    }
    
    // 3. 提供修正建議
    console.log('第三步：提供修正建議...\n');
    
    console.log('📋 正確的退水概念：');
    console.log('1. 退水總額固定：A盤最多1.1%，D盤最多4.1%');
    console.log('2. 代理之間競爭分配這個固定總額');
    console.log('3. 上級代理的退水 = 總額 - 所有下級代理的退水\n');
    
    console.log('🔧 修正分配邏輯的關鍵：');
    console.log('1. 「none」模式：本代理拿0%，全部給下級 → rebate_percentage = 0');
    console.log('2. 「all」模式：本代理拿全部 → rebate_percentage = 最大值，下級拿0%');
    console.log('3. 「percentage」模式：本代理拿設定比例，剩餘給上級\n');
    
    console.log('💡 正確的分配邏輯應該是：');
    console.log('- 總退水 = 下注金額 × 最大退水比例（A盤1.1%或D盤4.1%）');
    console.log('- 從最下級開始分配，每級代理拿自己的比例');
    console.log('- 剩餘的退水繼續向上分配，直到分配完畢\n');
    
    // 4. 檢查現在的設定狀況
    console.log('第四步：檢查修正後的設定...\n');
    
    const fixedCheck = await pool.query(`
      SELECT 
        a.id,
        a.username,
        a.rebate_mode,
        ROUND(a.rebate_percentage * 100, 2) as rebate_pct,
        ROUND(a.max_rebate_percentage * 100, 2) as max_rebate_pct,
        a.market_type,
        CASE 
          WHEN a.rebate_mode = 'none' AND a.rebate_percentage > 0 THEN '❌ none模式應該是0%'
          WHEN a.rebate_mode = 'all' AND a.rebate_percentage != a.max_rebate_percentage THEN '❌ all模式應該是最大值'
          WHEN a.rebate_mode = 'percentage' AND a.rebate_percentage > a.max_rebate_percentage THEN '❌ 比例超過最大值'
          ELSE '✅ 正常'
        END as status
      FROM agents a
      WHERE a.level > 0  -- 排除總代理
      ORDER BY a.market_type, a.level, a.id
    `);
    
    console.log('代理退水設定檢查結果：');
    console.table(fixedCheck.rows);
    
    const errorCount = fixedCheck.rows.filter(r => r.status.includes('❌')).length;
    if (errorCount === 0) {
      console.log('\n🎉 所有代理退水設定已修正完成！');
    } else {
      console.log(`\n⚠️  仍有 ${errorCount} 個代理設定需要進一步修正`);
    }
    
  } catch (error) {
    console.error('修正過程中發生錯誤:', error);
  } finally {
    await pool.end();
  }
}

fixRebateLogic(); 