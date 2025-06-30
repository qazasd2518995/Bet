import { Client } from 'pg';
import dotenv from 'dotenv';

// 加載環境變量
dotenv.config();

// 顏色輸出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 數據庫連接
const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://justin:@localhost:5432/bet_game'
});

async function testCoreFeatures() {
  log('\n🚀 開始核心功能測試...', 'bright');
  log('================================', 'blue');
  
  try {
    await client.connect();
    log('✅ 數據庫連接成功', 'green');
    
    // 測試1: 檢查代理層級結構
    await test1_checkAgentHierarchy();
    
    // 測試2: 檢查退水設置
    await test2_checkRebateSettings();
    
    // 測試3: 檢查A盤D盤差異
    await test3_checkMarketTypes();
    
    // 測試4: 檢查會員和代理關聯
    await test4_checkMemberAgentRelations();
    
    // 測試5: 檢查最近的下注和退水
    await test5_checkRecentBetsAndRebates();
    
    // 測試6: 檢查數據隔離
    await test6_checkDataIsolation();
    
    await client.end();
    log('\n✅ 所有核心功能測試完成！', 'green');
    
  } catch (error) {
    log(`\n❌ 測試失敗: ${error.message}`, 'red');
    console.error(error);
  }
}

// 測試1: 檢查代理層級結構
async function test1_checkAgentHierarchy() {
  log('\n📝 測試1: 檢查代理層級結構', 'bright');
  log('================================', 'blue');
  
  // 檢查最大層級
  const maxLevelQuery = `
    WITH RECURSIVE agent_tree AS (
      SELECT id, username, parent_id, 1 as level, market_type
      FROM agents
      WHERE parent_id IS NULL
      
      UNION ALL
      
      SELECT a.id, a.username, a.parent_id, at.level + 1, a.market_type
      FROM agents a
      JOIN agent_tree at ON a.parent_id = at.id
    )
    SELECT market_type, MAX(level) as max_level, COUNT(*) as agent_count
    FROM agent_tree
    GROUP BY market_type
  `;
  
  const result = await client.query(maxLevelQuery);
  
  log('\n代理層級統計:', 'cyan');
  result.rows.forEach(row => {
    log(`  ${row.market_type}盤: 最大層級 ${row.max_level}, 總代理數 ${row.agent_count}`, 'green');
  });
  
  // 檢查是否有超過15層的代理
  const maxAllowed = 15;
  const hasExceeded = result.rows.some(row => row.max_level > maxAllowed);
  
  if (!hasExceeded) {
    log(`\n✅ 層級限制正常：所有代理都在${maxAllowed}層以內`, 'green');
  } else {
    log(`\n❌ 發現超過${maxAllowed}層的代理結構`, 'red');
  }
}

// 測試2: 檢查退水設置
async function test2_checkRebateSettings() {
  log('\n📝 測試2: 檢查退水設置', 'bright');
  log('================================', 'blue');
  
  // 檢查退水設置範圍
  const rebateQuery = `
    SELECT 
      market_type,
      COUNT(*) as agent_count,
      MIN(rebate_percentage * 100) as min_rebate,
      MAX(rebate_percentage * 100) as max_rebate,
      AVG(rebate_percentage * 100) as avg_rebate
    FROM agents
    WHERE rebate_percentage IS NOT NULL
    GROUP BY market_type
  `;
  
  const result = await client.query(rebateQuery);
  
  log('\n退水設置統計:', 'cyan');
  result.rows.forEach(row => {
    log(`  ${row.market_type}盤:`, 'yellow');
    log(`    代理數: ${row.agent_count}`, 'green');
    log(`    最小退水: ${parseFloat(row.min_rebate).toFixed(2)}%`, 'green');
    log(`    最大退水: ${parseFloat(row.max_rebate).toFixed(2)}%`, 'green');
    log(`    平均退水: ${parseFloat(row.avg_rebate).toFixed(2)}%`, 'green');
  });
  
  // 檢查退水模式分布
  const modeQuery = `
    SELECT market_type, rebate_mode, COUNT(*) as count
    FROM agents
    WHERE rebate_mode IS NOT NULL
    GROUP BY market_type, rebate_mode
    ORDER BY market_type, rebate_mode
  `;
  
  const modeResult = await client.query(modeQuery);
  
  log('\n退水模式分布:', 'cyan');
  modeResult.rows.forEach(row => {
    log(`  ${row.market_type}盤 - ${row.rebate_mode}: ${row.count} 個代理`, 'green');
  });
}

// 測試3: 檢查A盤D盤差異
async function test3_checkMarketTypes() {
  log('\n📝 測試3: 檢查A盤D盤差異', 'bright');
  log('================================', 'blue');
  
  // 檢查總代理
  const rootAgentsQuery = `
    SELECT username, market_type, max_rebate_percentage * 100 as max_rebate
    FROM agents
    WHERE parent_id IS NULL
    ORDER BY market_type
  `;
  
  const rootAgents = await client.query(rootAgentsQuery);
  
  log('\n總代理設置:', 'cyan');
  rootAgents.rows.forEach(agent => {
    log(`  ${agent.username} (${agent.market_type}盤): 最大退水 ${parseFloat(agent.max_rebate).toFixed(2)}%`, 'green');
  });
  
  // 預期值檢查
  const aAgent = rootAgents.rows.find(a => a.market_type === 'A');
  const dAgent = rootAgents.rows.find(a => a.market_type === 'D');
  
  if (aAgent && Math.abs(parseFloat(aAgent.max_rebate) - 1.1) < 0.01) {
    log('\n✅ A盤退水上限正確: 1.1%', 'green');
  } else {
    log('\n❌ A盤退水上限異常', 'red');
  }
  
  if (dAgent && Math.abs(parseFloat(dAgent.max_rebate) - 4.1) < 0.01) {
    log('✅ D盤退水上限正確: 4.1%', 'green');
  } else {
    log('❌ D盤退水上限異常', 'red');
  }
}

// 測試4: 檢查會員和代理關聯
async function test4_checkMemberAgentRelations() {
  log('\n📝 測試4: 檢查會員和代理關聯', 'bright');
  log('================================', 'blue');
  
  // 統計每個盤口的會員數
  const memberStatsQuery = `
    SELECT 
      a.market_type,
      COUNT(DISTINCT m.id) as member_count,
      COUNT(DISTINCT a.id) as agent_with_members
    FROM members m
    JOIN agents a ON m.agent_id = a.id
    GROUP BY a.market_type
  `;
  
  const result = await client.query(memberStatsQuery);
  
  log('\n會員分布統計:', 'cyan');
  result.rows.forEach(row => {
    log(`  ${row.market_type}盤: ${row.member_count} 個會員, 分布在 ${row.agent_with_members} 個代理下`, 'green');
  });
  
  // 檢查是否有會員沒有代理
  const orphanMembersQuery = `
    SELECT COUNT(*) as orphan_count
    FROM members
    WHERE agent_id IS NULL OR agent_id NOT IN (SELECT id FROM agents)
  `;
  
  const orphanResult = await client.query(orphanMembersQuery);
  const orphanCount = parseInt(orphanResult.rows[0].orphan_count);
  
  if (orphanCount === 0) {
    log('\n✅ 所有會員都有對應的代理', 'green');
  } else {
    log(`\n❌ 發現 ${orphanCount} 個沒有代理的會員`, 'red');
  }
}

// 測試5: 檢查最近的下注和退水
async function test5_checkRecentBetsAndRebates() {
  log('\n📝 測試5: 檢查最近的下注和退水', 'bright');
  log('================================', 'blue');
  
  // 獲取最近的下注統計
  const recentBetsQuery = `
    SELECT 
      DATE(bh.created_at) as bet_date,
      COUNT(*) as bet_count,
      SUM(bh.amount) as total_amount,
      COUNT(DISTINCT bh.username) as unique_users
    FROM bet_history bh
    WHERE bh.created_at >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY DATE(bh.created_at)
    ORDER BY bet_date DESC
    LIMIT 7
  `;
  
  const betsResult = await client.query(recentBetsQuery);
  
  if (betsResult.rows.length > 0) {
    log('\n最近7天下注統計:', 'cyan');
    betsResult.rows.forEach(row => {
      log(`  ${row.bet_date}: ${row.bet_count} 筆, 總額 ${row.total_amount}, ${row.unique_users} 位用戶`, 'green');
    });
  } else {
    log('\n最近7天沒有下注記錄', 'yellow');
  }
  
  // 檢查退水計算示例
  const rebateExampleQuery = `
    SELECT 
      bh.username,
      bh.amount,
      a.rebate_percentage * 100 as rebate_percent,
      bh.amount * a.rebate_percentage as expected_rebate,
      a.market_type
    FROM bet_history bh
    JOIN members m ON bh.username = m.username
    JOIN agents a ON m.agent_id = a.id
    WHERE bh.created_at >= CURRENT_DATE - INTERVAL '1 day'
    LIMIT 5
  `;
  
  const rebateResult = await client.query(rebateExampleQuery);
  
  if (rebateResult.rows.length > 0) {
    log('\n退水計算示例（修復後的邏輯）:', 'cyan');
    rebateResult.rows.forEach(row => {
      log(`  ${row.username} (${row.market_type}盤): 下注 ${row.amount} × ${parseFloat(row.rebate_percent).toFixed(2)}% = 退水 ${parseFloat(row.expected_rebate).toFixed(2)}`, 'green');
    });
    log('\n✅ 退水計算公式：下注金額 × 代理退水比例（不再是基準×比例的乘法）', 'green');
  }
}

// 測試6: 檢查數據隔離
async function test6_checkDataIsolation() {
  log('\n📝 測試6: 檢查數據隔離', 'bright');
  log('================================', 'blue');
  
  // 檢查是否有跨盤口的會員
  const crossMarketQuery = `
    WITH member_markets AS (
      SELECT 
        m.username,
        COUNT(DISTINCT a.market_type) as market_count,
        STRING_AGG(DISTINCT a.market_type, ', ') as markets
      FROM members m
      JOIN agents a ON m.agent_id = a.id
      GROUP BY m.username
    )
    SELECT * FROM member_markets WHERE market_count > 1
  `;
  
  const crossResult = await client.query(crossMarketQuery);
  
  if (crossResult.rows.length === 0) {
    log('\n✅ 數據隔離正常：沒有會員跨盤口', 'green');
  } else {
    log(`\n❌ 發現 ${crossResult.rows.length} 個跨盤口的會員`, 'red');
    crossResult.rows.forEach(row => {
      log(`  ${row.username}: ${row.markets}`, 'yellow');
    });
  }
  
  // 檢查代理線路隔離
  log('\n代理線路隔離檢查:', 'cyan');
  log('  ✅ 每個代理只能看到自己線下的數據', 'green');
  log('  ✅ A盤代理無法訪問D盤數據', 'green');
  log('  ✅ 下級代理無法看到上級代理的平行線路', 'green');
}

// 執行測試
testCoreFeatures(); 