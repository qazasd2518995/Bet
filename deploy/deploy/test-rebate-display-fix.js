import axios from 'axios';
import db from './db/config.js';

const AGENT_API_URL = 'http://localhost:3003/api/agent';

async function testRebateDisplay() {
  console.log('=== 測試退水顯示修復 ===\n');
  
  try {
    // 1. 查找一個退水為0.9%的一級代理
    console.log('1. 查找退水0.9%的一級代理...');
    const agent09 = await db.oneOrNone(`
      SELECT id, username, level, rebate_percentage, max_rebate_percentage, parent_id
      FROM agents
      WHERE level = 1 AND rebate_percentage = 0.009 AND status = 1
      LIMIT 1
    `);
    
    if (agent09) {
      console.log(`找到代理: ${agent09.username}`);
      console.log(`- 等級: ${agent09.level}`);
      console.log(`- 退水: ${(agent09.rebate_percentage * 100).toFixed(1)}%`);
      console.log(`- 最大退水: ${(agent09.max_rebate_percentage * 100).toFixed(1)}%`);
      
      // 2. 查看其上級代理
      const parentAgent = await db.oneOrNone(`
        SELECT id, username, level, rebate_percentage, max_rebate_percentage, market_type
        FROM agents
        WHERE id = $1
      `, [agent09.parent_id]);
      
      if (parentAgent) {
        console.log(`\n上級代理: ${parentAgent.username}`);
        console.log(`- 等級: ${parentAgent.level}`);
        console.log(`- 退水: ${(parentAgent.rebate_percentage * 100).toFixed(1)}%`);
        console.log(`- 盤口: ${parentAgent.market_type}盤`);
      }
      
      console.log('\n預期行為:');
      console.log(`- 當使用 ${agent09.username} (0.9%) 登入時`);
      console.log(`- 新增代理頁面應顯示最大退水: 0.9%`);
      console.log(`- 而不是盤口默認值 1.1%`);
      
    } else {
      console.log('找不到退水0.9%的一級代理');
      
      // 創建測試代理
      console.log('\n2. 創建測試代理結構...');
      
      // 找總代理
      const topAgent = await db.oneOrNone(`
        SELECT id, username, market_type
        FROM agents
        WHERE level = 0 AND market_type = 'A' AND status = 1
        LIMIT 1
      `);
      
      if (topAgent) {
        console.log(`使用總代理: ${topAgent.username} (${topAgent.market_type}盤)`);
        
        // 登入總代理
        const loginResp = await axios.post(`${AGENT_API_URL}/login`, {
          username: topAgent.username,
          password: 'A$2025@xK9p#Secure!mN7qR&wZ3' // 假設密碼
        });
        
        if (loginResp.data.success) {
          const token = loginResp.data.token;
          
          // 創建一級代理 (0.9%)
          const createResp = await axios.post(`${AGENT_API_URL}/create-agent`, {
            username: `test-09-${Date.now()}`,
            password: 'Test@123456',
            level: 1,
            commission_rate: 0,
            rebate_mode: 'percentage',
            rebate_percentage: 0.009,
            market_type: 'A'
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (createResp.data.success) {
            console.log(`\n✅ 創建測試代理成功:`);
            console.log(`- 用戶名: ${createResp.data.agent.username}`);
            console.log(`- 退水: ${(createResp.data.agent.rebate_percentage * 100).toFixed(1)}%`);
            console.log(`\n請使用此代理登入並檢查新增代理頁面的最大退水顯示`);
          }
        }
      }
    }
    
    // 3. 檢查前端邏輯
    console.log('\n3. 前端邏輯說明:');
    console.log('- 總代理新增下級: 顯示盤口最大值 (A盤1.1%, D盤4.1%)');
    console.log('- 一級代理新增下級: 顯示自己的退水比例作為最大值');
    console.log('- 例如: 0.9%的代理新增下級時，最大只能設定0.9%');
    
    console.log('\n=== 測試完成 ===');
    
  } catch (error) {
    console.error('測試失敗:', error);
  } finally {
    process.exit(0);
  }
}

// 執行測試
testRebateDisplay();