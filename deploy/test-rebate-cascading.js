import axios from 'axios';
import db from './db/config.js';

const AGENT_API_URL = 'http://localhost:3003/api/agent';

// 测试退水级联更新
async function testRebateCascading() {
  console.log('=== 测试退水级联更新机制 ===\n');
  
  let topAgentToken;
  
  try {
    // 1. 登入总代理
    console.log('1. 登入总代理...');
    const loginResponse = await axios.post(`${AGENT_API_URL}/login`, {
      username: 'MA@x9Kp#2025$zL7',
      password: 'A$2025@xK9p#Secure!mN7qR&wZ3'
    });
    
    topAgentToken = loginResponse.data.token;
    const topAgentId = loginResponse.data.agentId || loginResponse.data.agent?.id;
    const topAgentUsername = loginResponse.data.username || loginResponse.data.agent?.username;
    console.log(`✅ 总代理登入成功: ${topAgentUsername} (ID: ${topAgentId})\n`);
    
    // 2. 查看现有代理结构
    console.log('2. 查看现有代理结构...');
    const agentStructure = await db.any(`
      WITH RECURSIVE agent_tree AS (
        SELECT id, username, parent_id, rebate_percentage, max_rebate_percentage, level, 0 as depth
        FROM agents
        WHERE parent_id = $1 AND status = 1
        
        UNION ALL
        
        SELECT a.id, a.username, a.parent_id, a.rebate_percentage, a.max_rebate_percentage, a.level, at.depth + 1
        FROM agents a
        INNER JOIN agent_tree at ON a.parent_id = at.id
        WHERE a.status = 1
      )
      SELECT * FROM agent_tree
      ORDER BY depth, username
    `, [topAgentId]);
    
    console.log('代理层级结构:');
    console.log(`总代理 MA@x9Kp#2025$zL7 (退水: 4.1%, 最大: 4.1%)`);
    agentStructure.forEach(agent => {
      const indent = '  '.repeat(agent.depth + 1);
      console.log(`${indent}L${agent.level} ${agent.username} (退水: ${(agent.rebate_percentage * 100).toFixed(1)}%, 最大: ${(agent.max_rebate_percentage * 100).toFixed(1)}%)`);
    });
    
    // 3. 创建测试代理结构
    console.log('\n3. 创建测试代理结构...');
    
    // 创建一级代理 (3.8%)
    console.log('创建一级代理 test-L1-38 (3.8%)...');
    const level1Response = await axios.post(`${AGENT_API_URL}/create-agent`, {
      username: `test-L1-38-${Date.now()}`,
      password: 'Test@123456',
      level: 1,
      commission_rate: 0,
      rebate_mode: 'percentage',
      rebate_percentage: 0.038,
      market_type: 'A'
    }, {
      headers: { Authorization: `Bearer ${topAgentToken}` }
    });
    const level1AgentId = level1Response.data.agent.id;
    console.log(`✅ 一级代理创建成功: ${level1Response.data.agent.username}`);
    
    // 用一级代理登入
    const level1LoginResponse = await axios.post(`${AGENT_API_URL}/login`, {
      username: level1Response.data.agent.username,
      password: 'Test@123456'
    });
    const level1Token = level1LoginResponse.data.token;
    
    // 创建二级代理 (3.6%)
    console.log('创建二级代理 test-L2-36 (3.6%)...');
    const level2Response = await axios.post(`${AGENT_API_URL}/create-agent`, {
      username: `test-L2-36-${Date.now()}`,
      password: 'Test@123456',
      level: 2,
      commission_rate: 0,
      rebate_mode: 'percentage',
      rebate_percentage: 0.036,
      market_type: 'A'
    }, {
      headers: { Authorization: `Bearer ${level1Token}` }
    });
    const level2AgentId = level2Response.data.agent.id;
    console.log(`✅ 二级代理创建成功: ${level2Response.data.agent.username}`);
    
    // 用二级代理登入
    const level2LoginResponse = await axios.post(`${AGENT_API_URL}/login`, {
      username: level2Response.data.agent.username,
      password: 'Test@123456'
    });
    const level2Token = level2LoginResponse.data.token;
    
    // 创建三级代理 (3.4%)
    console.log('创建三级代理 test-L3-34 (3.4%)...');
    const level3Response = await axios.post(`${AGENT_API_URL}/create-agent`, {
      username: `test-L3-34-${Date.now()}`,
      password: 'Test@123456',
      level: 3,
      commission_rate: 0,
      rebate_mode: 'percentage',
      rebate_percentage: 0.034,
      market_type: 'A'
    }, {
      headers: { Authorization: `Bearer ${level2Token}` }
    });
    console.log(`✅ 三级代理创建成功: ${level3Response.data.agent.username}`);
    
    // 4. 显示调整前的状态
    console.log('\n4. 调整前的退水设定:');
    const beforeAgents = await db.any(`
      SELECT id, username, level, rebate_percentage, max_rebate_percentage 
      FROM agents 
      WHERE id IN ($1, $2, $3, $4)
      ORDER BY level
    `, [topAgentId, level1AgentId, level2AgentId, level3Response.data.agent.id]);
    
    beforeAgents.forEach(agent => {
      console.log(`L${agent.level} ${agent.username}: 退水 ${(agent.rebate_percentage * 100).toFixed(1)}%, 最大 ${(agent.max_rebate_percentage * 100).toFixed(1)}%`);
    });
    
    // 5. 测试场景1: 降低一级代理的退水到3.5%
    console.log('\n5. 测试场景1: 降低一级代理的退水到3.5%...');
    try {
      await axios.put(`${AGENT_API_URL}/update-rebate-settings/${level1AgentId}`, {
        rebate_mode: 'percentage',
        rebate_percentage: 0.035
      }, {
        headers: { Authorization: `Bearer ${topAgentToken}` }
      });
      console.log('✅ 更新成功');
    } catch (error) {
      console.error('❌ 更新失败:', error.response?.data?.message || error.message);
    }
    
    // 显示调整后的状态
    console.log('\n调整后的退水设定:');
    const afterAgents1 = await db.any(`
      SELECT id, username, level, rebate_percentage, max_rebate_percentage 
      FROM agents 
      WHERE id IN ($1, $2, $3, $4)
      ORDER BY level
    `, [topAgentId, level1AgentId, level2AgentId, level3Response.data.agent.id]);
    
    afterAgents1.forEach(agent => {
      console.log(`L${agent.level} ${agent.username}: 退水 ${(agent.rebate_percentage * 100).toFixed(1)}%, 最大 ${(agent.max_rebate_percentage * 100).toFixed(1)}%`);
    });
    
    // 6. 测试场景2: 提高一级代理的退水到3.9%
    console.log('\n6. 测试场景2: 提高一级代理的退水到3.9%...');
    try {
      await axios.put(`${AGENT_API_URL}/update-rebate-settings/${level1AgentId}`, {
        rebate_mode: 'percentage',
        rebate_percentage: 0.039
      }, {
        headers: { Authorization: `Bearer ${topAgentToken}` }
      });
      console.log('✅ 更新成功');
    } catch (error) {
      console.error('❌ 更新失败:', error.response?.data?.message || error.message);
    }
    
    // 显示调整后的状态
    console.log('\n调整后的退水设定:');
    const afterAgents2 = await db.any(`
      SELECT id, username, level, rebate_percentage, max_rebate_percentage 
      FROM agents 
      WHERE id IN ($1, $2, $3, $4)
      ORDER BY level
    `, [topAgentId, level1AgentId, level2AgentId, level3Response.data.agent.id]);
    
    afterAgents2.forEach(agent => {
      console.log(`L${agent.level} ${agent.username}: 退水 ${(agent.rebate_percentage * 100).toFixed(1)}%, 最大 ${(agent.max_rebate_percentage * 100).toFixed(1)}%`);
    });
    
    // 7. 检查交易记录
    console.log('\n7. 检查连锁调整记录...');
    const adjustmentRecords = await db.any(`
      SELECT user_id, description, created_at 
      FROM transaction_records 
      WHERE transaction_type = 'other' 
      AND description LIKE '%退水设定连锁调整%'
      AND user_id IN ($1, $2, $3)
      ORDER BY created_at DESC
      LIMIT 10
    `, [level1AgentId, level2AgentId, level3Response.data.agent.id]);
    
    if (adjustmentRecords.length > 0) {
      console.log('找到连锁调整记录:');
      adjustmentRecords.forEach(record => {
        console.log(`- ${record.description}`);
      });
    } else {
      console.log('没有找到连锁调整记录');
    }
    
    console.log('\n=== 测试完成 ===');
    
  } catch (error) {
    console.error('测试失败:', error.response?.data || error.message);
  } finally {
    process.exit(0);
  }
}

// 执行测试
testRebateCascading();