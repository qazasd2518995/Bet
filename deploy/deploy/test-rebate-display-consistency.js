import axios from 'axios';
import db from './db/config.js';

const AGENT_API_URL = 'http://localhost:3003/api/agent';

async function testRebateDisplayConsistency() {
  console.log('=== 測試退水顯示與驗證一致性 ===\n');
  
  try {
    // 1. 查找退水為1.0%的代理
    console.log('1. 查找退水1.0%的代理...');
    const agent10 = await db.oneOrNone(`
      SELECT id, username, level, rebate_percentage, max_rebate_percentage, parent_id, market_type
      FROM agents
      WHERE rebate_percentage = 0.01 AND status = 1
      LIMIT 1
    `);
    
    if (!agent10) {
      console.log('找不到退水1.0%的代理');
      return;
    }
    
    console.log(`找到代理: ${agent10.username}`);
    console.log(`- ID: ${agent10.id}`);
    console.log(`- 等級: ${agent10.level}`);
    console.log(`- 退水: ${(agent10.rebate_percentage * 100).toFixed(1)}%`);
    console.log(`- 最大退水: ${(agent10.max_rebate_percentage * 100).toFixed(1)}%`);
    console.log(`- 盤口: ${agent10.market_type}盤`);
    
    // 2. 查看其上級代理
    if (agent10.parent_id) {
      const parentAgent = await db.oneOrNone(`
        SELECT id, username, level, rebate_percentage, max_rebate_percentage, market_type
        FROM agents
        WHERE id = $1
      `, [agent10.parent_id]);
      
      if (parentAgent) {
        console.log(`\n上級代理: ${parentAgent.username}`);
        console.log(`- 等級: ${parentAgent.level}`);
        console.log(`- 退水: ${(parentAgent.rebate_percentage * 100).toFixed(1)}%`);
        console.log(`- 盤口: ${parentAgent.market_type}盤`);
      }
    }
    
    console.log('\n3. 預期行為:');
    console.log(`當在 ${agent10.username} (退水${(agent10.rebate_percentage * 100).toFixed(1)}%) 的管理頁面新增代理時:`);
    console.log(`- 前端應該顯示: 可設定範圍 0% - ${(agent10.rebate_percentage * 100).toFixed(1)}%`);
    console.log(`- 後端應該限制: 最大 ${(agent10.rebate_percentage * 100).toFixed(1)}%`);
    console.log(`- 兩者應該一致`);
    
    // 4. 測試創建代理API
    console.log('\n4. 測試後端驗證邏輯...');
    
    // 先登入上級代理
    const parentAgent = await db.oneOrNone(`
      SELECT id, username FROM agents WHERE id = $1
    `, [agent10.parent_id]);
    
    if (parentAgent && parentAgent.username === 'MA@x9Kp#2025$zL7') {
      const loginResp = await axios.post(`${AGENT_API_URL}/login`, {
        username: parentAgent.username,
        password: 'A$2025@xK9p#Secure!mN7qR&wZ3'
      });
      
      if (loginResp.data.success) {
        const token = loginResp.data.token;
        
        // 測試創建超過限制的代理
        console.log(`\n嘗試為 ${agent10.username} 創建退水1.05%的代理（應該失敗）...`);
        try {
          await axios.post(`${AGENT_API_URL}/create-agent`, {
            username: `test-exceed-${Date.now()}`,
            password: 'Test@123456',
            level: agent10.level + 1,
            commission_rate: 0,
            rebate_mode: 'percentage',
            rebate_percentage: 0.0105,
            market_type: agent10.market_type,
            parent: agent10.id
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
          console.log('❌ 錯誤：不應該允許創建超過上級退水的代理');
        } catch (error) {
          if (error.response?.data?.message?.includes('退水比例必須在')) {
            console.log(`✅ 正確：${error.response.data.message}`);
          } else {
            console.log('❌ 錯誤：', error.response?.data?.message || error.message);
          }
        }
        
        // 測試創建符合限制的代理
        console.log(`\n嘗試為 ${agent10.username} 創建退水0.9%的代理（應該成功）...`);
        try {
          const createResp = await axios.post(`${AGENT_API_URL}/create-agent`, {
            username: `test-valid-${Date.now()}`,
            password: 'Test@123456',
            level: agent10.level + 1,
            commission_rate: 0,
            rebate_mode: 'percentage',
            rebate_percentage: 0.009,
            market_type: agent10.market_type,
            parent: agent10.id
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
          console.log(`✅ 成功創建代理: ${createResp.data.agent.username}`);
        } catch (error) {
          console.log('❌ 錯誤：', error.response?.data?.message || error.message);
        }
      }
    }
    
    console.log('\n=== 測試完成 ===');
    console.log('\n修復說明:');
    console.log('1. 前端現在使用 currentManagingAgent 來計算最大退水');
    console.log('2. 當為其他代理創建下級時，顯示該代理的退水作為上限');
    console.log('3. 確保前端顯示與後端驗證保持一致');
    
  } catch (error) {
    console.error('測試失敗:', error);
  } finally {
    process.exit(0);
  }
}

// 執行測試
testRebateDisplayConsistency();