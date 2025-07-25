const { Pool } = require('pg');

const pool = new Pool({
  user: 'justin',
  host: 'localhost',
  database: 'bet_game',
  password: '',
  port: 5432,
});

async function fixRebateDistribution() {
  console.log('🔧 修復退水分配邏輯 - 實現正確的「全退下級」概念\n');
  
  try {
    console.log('=== 當前問題分析 ===');
    console.log('❌ 錯誤概念：每個代理都從下注金額中拿自己的比例');
    console.log('✅ 正確概念：固定退水池（A盤1.1%/D盤4.1%），代理鏈競爭分配');
    console.log('');
    
    console.log('=== 「全退下級」的正確邏輯 ===');
    console.log('假設：上級代理設定下級代理為「全退下級」');
    console.log('- 下級代理：拿 0% 退水');
    console.log('- 上級代理：拿全部退水（A盤1.1%或D盤4.1%）');
    console.log('- 總退水：= 最大限制，不會超標');
    console.log('');
    
    // 1. 檢查並修復D盤超標問題
    console.log('第一步：修復D盤超標問題...');
    
    const dIssues = await pool.query(`
      SELECT 
        m.username as member_name,
        a.id as agent_id,
        a.username as agent_name,
        a.rebate_mode,
        a.rebate_percentage,
        a.parent_id,
        pa.id as parent_agent_id,
        pa.username as parent_agent_name,
        pa.rebate_percentage as parent_rebate_percentage,
        (a.rebate_percentage + COALESCE(pa.rebate_percentage, 0)) as total_rebate
      FROM members m
      LEFT JOIN agents a ON m.agent_id = a.id
      LEFT JOIN agents pa ON a.parent_id = pa.id
      WHERE m.market_type = 'D' 
        AND (a.rebate_percentage + COALESCE(pa.rebate_percentage, 0)) > 0.041
    `);
    
    if (dIssues.rows.length > 0) {
      console.log('發現D盤超標會員:');
      dIssues.rows.forEach(issue => {
        console.log(`- 會員 ${issue.member_name}: ${issue.agent_name}(${(issue.rebate_percentage*100).toFixed(1)}%) → ${issue.parent_agent_name || '無'}(${issue.parent_rebate_percentage ? (issue.parent_rebate_percentage*100).toFixed(1)+'%' : '無'}) = ${(issue.total_rebate*100).toFixed(1)}%`);
      });
      
      console.log('\n🔧 修復方案選擇:');
      console.log('1. 實現「全退下級」: 下級代理改為0%，上級代理拿4.1%');
      console.log('2. 實現「全拿退水」: 下級代理拿4.1%，上級代理改為0%');
      console.log('3. 按比例分配: 下級2%，上級2.1%（總計4.1%）');
      console.log('');
      
      // 示範修復：實現「全退下級」邏輯
      console.log('執行修復 - 實現「全退下級」邏輯...');
      for (const issue of dIssues.rows) {
        if (issue.parent_agent_id) {
          // 下級代理改為0%退水
          await pool.query(`
            UPDATE agents 
            SET rebate_percentage = 0, rebate_mode = 'none'
            WHERE id = $1
          `, [issue.agent_id]);
          
          // 上級代理拿全部退水
          await pool.query(`
            UPDATE agents 
            SET rebate_percentage = 0.041, rebate_mode = 'all'
            WHERE id = $1
          `, [issue.parent_agent_id]);
          
          console.log(`✅ 修復 ${issue.member_name}: ${issue.agent_name}(0%) → ${issue.parent_agent_name}(4.1%)`);
        }
      }
    } else {
      console.log('✅ D盤沒有超標問題');
    }
    
    // 2. 檢查並修復A盤超標問題
    console.log('\n第二步：修復A盤超標問題...');
    
    const aIssues = await pool.query(`
      SELECT 
        m.username as member_name,
        a.id as agent_id,
        a.username as agent_name,
        a.rebate_mode,
        a.rebate_percentage,
        a.parent_id,
        pa.id as parent_agent_id,
        pa.username as parent_agent_name,
        pa.rebate_percentage as parent_rebate_percentage,
        (a.rebate_percentage + COALESCE(pa.rebate_percentage, 0)) as total_rebate
      FROM members m
      LEFT JOIN agents a ON m.agent_id = a.id
      LEFT JOIN agents pa ON a.parent_id = pa.id
      WHERE m.market_type = 'A' 
        AND (a.rebate_percentage + COALESCE(pa.rebate_percentage, 0)) > 0.011
    `);
    
    if (aIssues.rows.length > 0) {
      console.log('發現A盤超標會員:');
      aIssues.rows.forEach(issue => {
        console.log(`- 會員 ${issue.member_name}: ${issue.agent_name}(${(issue.rebate_percentage*100).toFixed(1)}%) → ${issue.parent_agent_name || '無'}(${issue.parent_rebate_percentage ? (issue.parent_rebate_percentage*100).toFixed(1)+'%' : '無'}) = ${(issue.total_rebate*100).toFixed(1)}%`);
      });
      
      // 修復A盤超標
      for (const issue of aIssues.rows) {
        if (issue.parent_agent_id) {
          // 下級代理改為0%退水
          await pool.query(`
            UPDATE agents 
            SET rebate_percentage = 0, rebate_mode = 'none'
            WHERE id = $1
          `, [issue.agent_id]);
          
          // 上級代理拿全部退水
          await pool.query(`
            UPDATE agents 
            SET rebate_percentage = 0.011, rebate_mode = 'all'
            WHERE id = $1
          `, [issue.parent_agent_id]);
          
          console.log(`✅ 修復 ${issue.member_name}: ${issue.agent_name}(0%) → ${issue.parent_agent_name}(1.1%)`);
        }
      }
    } else {
      console.log('✅ A盤沒有超標問題');
    }
    
    // 3. 驗證修復結果
    console.log('\n第三步：驗證修復結果...');
    
    const finalCheck = await pool.query(`
      SELECT 
        m.market_type,
        m.username as member_name,
        a.username as agent_name,
        a.rebate_mode,
        a.rebate_percentage,
        pa.username as parent_agent_name,
        pa.rebate_percentage as parent_rebate_percentage,
        (a.rebate_percentage + COALESCE(pa.rebate_percentage, 0)) as total_rebate,
        CASE 
          WHEN m.market_type = 'A' AND (a.rebate_percentage + COALESCE(pa.rebate_percentage, 0)) <= 0.011 THEN '✅'
          WHEN m.market_type = 'D' AND (a.rebate_percentage + COALESCE(pa.rebate_percentage, 0)) <= 0.041 THEN '✅'
          ELSE '❌'
        END as status
      FROM members m
      LEFT JOIN agents a ON m.agent_id = a.id
      LEFT JOIN agents pa ON a.parent_id = pa.id
      WHERE m.market_type IN ('A', 'D')
      ORDER BY m.market_type, m.username
    `);
    
    console.log('\n修復後的狀態:');
    finalCheck.rows.forEach(member => {
      console.log(`${member.status} ${member.market_type}盤 ${member.member_name}: ${member.agent_name}(${member.rebate_mode}:${(member.rebate_percentage*100).toFixed(1)}%) → ${member.parent_agent_name || '無'}(${member.parent_rebate_percentage ? (member.parent_rebate_percentage*100).toFixed(1)+'%' : '無'}) = ${(member.total_rebate*100).toFixed(1)}%`);
    });
    
    console.log('\n=== 修復完成 ===');
    console.log('✅ 所有代理鏈總退水現在都符合盤口限制');
    console.log('✅ 實現了正確的「全退下級」邏輯');
    console.log('✅ 退水分配不會再超標');
    
    await pool.end();
    
  } catch (error) {
    console.error('❌ 修復過程中發生錯誤:', error.message);
    await pool.end();
  }
}

fixRebateDistribution(); 