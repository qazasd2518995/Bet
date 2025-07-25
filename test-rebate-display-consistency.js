import axios from 'axios';
import db from './db/config.js';

const AGENT_API_URL = 'http://localhost:3003/api/agent';

async function testRebateDisplayConsistency() {
  console.log('=== 测试退水显示与验证一致性 ===\n');
  
  try {
    // 1. 查找退水为1.0%的代理
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
    console.log(`- 等级: ${agent10.level}`);
    console.log(`- 退水: ${(agent10.rebate_percentage * 100).toFixed(1)}%`);
    console.log(`- 最大退水: ${(agent10.max_rebate_percentage * 100).toFixed(1)}%`);
    console.log(`- 盘口: ${agent10.market_type}盘`);
    
    // 2. 查看其上级代理
    if (agent10.parent_id) {
      const parentAgent = await db.oneOrNone(`
        SELECT id, username, level, rebate_percentage, max_rebate_percentage, market_type
        FROM agents
        WHERE id = $1
      `, [agent10.parent_id]);
      
      if (parentAgent) {
        console.log(`\n上级代理: ${parentAgent.username}`);
        console.log(`- 等级: ${parentAgent.level}`);
        console.log(`- 退水: ${(parentAgent.rebate_percentage * 100).toFixed(1)}%`);
        console.log(`- 盘口: ${parentAgent.market_type}盘`);
      }
    }
    
    console.log('\n3. 预期行为:');
    console.log(`当在 ${agent10.username} (退水${(agent10.rebate_percentage * 100).toFixed(1)}%) 的管理页面新增代理时:`);
    console.log(`- 前端应该显示: 可设定范围 0% - ${(agent10.rebate_percentage * 100).toFixed(1)}%`);
    console.log(`- 后端应该限制: 最大 ${(agent10.rebate_percentage * 100).toFixed(1)}%`);
    console.log(`- 两者应该一致`);
    
    // 4. 测试创建代理API
    console.log('\n4. 测试后端验证逻辑...');
    
    // 先登入上级代理
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
        
        // 测试创建超过限制的代理
        console.log(`\n尝试为 ${agent10.username} 创建退水1.05%的代理（应该失败）...`);
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
          console.log('❌ 错误：不应该允许创建超过上级退水的代理');
        } catch (error) {
          if (error.response?.data?.message?.includes('退水比例必须在')) {
            console.log(`✅ 正确：${error.response.data.message}`);
          } else {
            console.log('❌ 错误：', error.response?.data?.message || error.message);
          }
        }
        
        // 测试创建符合限制的代理
        console.log(`\n尝试为 ${agent10.username} 创建退水0.9%的代理（应该成功）...`);
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
          console.log(`✅ 成功创建代理: ${createResp.data.agent.username}`);
        } catch (error) {
          console.log('❌ 错误：', error.response?.data?.message || error.message);
        }
      }
    }
    
    console.log('\n=== 测试完成 ===');
    console.log('\n修复说明:');
    console.log('1. 前端现在使用 currentManagingAgent 来计算最大退水');
    console.log('2. 当为其他代理创建下级时，显示该代理的退水作为上限');
    console.log('3. 确保前端显示与后端验证保持一致');
    
  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    process.exit(0);
  }
}

// 执行测试
testRebateDisplayConsistency();