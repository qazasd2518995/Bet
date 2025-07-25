import axios from 'axios';
import db from './db/config.js';

const AGENT_API_URL = 'http://localhost:3003/api/agent';

async function testRebateDisplay() {
  console.log('=== 测试退水显示修复 ===\n');
  
  try {
    // 1. 查找一个退水为0.9%的一级代理
    console.log('1. 查找退水0.9%的一级代理...');
    const agent09 = await db.oneOrNone(`
      SELECT id, username, level, rebate_percentage, max_rebate_percentage, parent_id
      FROM agents
      WHERE level = 1 AND rebate_percentage = 0.009 AND status = 1
      LIMIT 1
    `);
    
    if (agent09) {
      console.log(`找到代理: ${agent09.username}`);
      console.log(`- 等级: ${agent09.level}`);
      console.log(`- 退水: ${(agent09.rebate_percentage * 100).toFixed(1)}%`);
      console.log(`- 最大退水: ${(agent09.max_rebate_percentage * 100).toFixed(1)}%`);
      
      // 2. 查看其上级代理
      const parentAgent = await db.oneOrNone(`
        SELECT id, username, level, rebate_percentage, max_rebate_percentage, market_type
        FROM agents
        WHERE id = $1
      `, [agent09.parent_id]);
      
      if (parentAgent) {
        console.log(`\n上级代理: ${parentAgent.username}`);
        console.log(`- 等级: ${parentAgent.level}`);
        console.log(`- 退水: ${(parentAgent.rebate_percentage * 100).toFixed(1)}%`);
        console.log(`- 盘口: ${parentAgent.market_type}盘`);
      }
      
      console.log('\n预期行为:');
      console.log(`- 当使用 ${agent09.username} (0.9%) 登入时`);
      console.log(`- 新增代理页面应显示最大退水: 0.9%`);
      console.log(`- 而不是盘口默认值 1.1%`);
      
    } else {
      console.log('找不到退水0.9%的一级代理');
      
      // 创建测试代理
      console.log('\n2. 创建测试代理结构...');
      
      // 找总代理
      const topAgent = await db.oneOrNone(`
        SELECT id, username, market_type
        FROM agents
        WHERE level = 0 AND market_type = 'A' AND status = 1
        LIMIT 1
      `);
      
      if (topAgent) {
        console.log(`使用总代理: ${topAgent.username} (${topAgent.market_type}盘)`);
        
        // 登入总代理
        const loginResp = await axios.post(`${AGENT_API_URL}/login`, {
          username: topAgent.username,
          password: 'A$2025@xK9p#Secure!mN7qR&wZ3' // 假设密码
        });
        
        if (loginResp.data.success) {
          const token = loginResp.data.token;
          
          // 创建一级代理 (0.9%)
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
            console.log(`\n✅ 创建测试代理成功:`);
            console.log(`- 用户名: ${createResp.data.agent.username}`);
            console.log(`- 退水: ${(createResp.data.agent.rebate_percentage * 100).toFixed(1)}%`);
            console.log(`\n请使用此代理登入并检查新增代理页面的最大退水显示`);
          }
        }
      }
    }
    
    // 3. 检查前端逻辑
    console.log('\n3. 前端逻辑说明:');
    console.log('- 总代理新增下级: 显示盘口最大值 (A盘1.1%, D盘4.1%)');
    console.log('- 一级代理新增下级: 显示自己的退水比例作为最大值');
    console.log('- 例如: 0.9%的代理新增下级时，最大只能设定0.9%');
    
    console.log('\n=== 测试完成 ===');
    
  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    process.exit(0);
  }
}

// 执行测试
testRebateDisplay();