#!/usr/bin/env node
// test-db-queries.js - 测试资料库查询

import db from './db/config.js';

async function testQueries() {
  console.log('🧪 测试资料库查询...');
  
  try {
    // 测试计数查询
    const agentCount = await db.one('SELECT COUNT(*) as count FROM agents');
    console.log('✅ 代理计数查询成功:', agentCount.count);
    
    const memberCount = await db.one('SELECT COUNT(*) as count FROM members');
    console.log('✅ 会员计数查询成功:', memberCount.count);
    
    // 测试交易记录查询
    const transactionCount = await db.one('SELECT COUNT(*) as count FROM transaction_records');
    console.log('✅ 交易记录计数查询成功:', transactionCount.count);
    
    // 测试开奖记录查询
    const drawCount = await db.one('SELECT COUNT(*) as count FROM draw_records');
    console.log('✅ 开奖记录计数查询成功:', drawCount.count);
    
    console.log('\n🎉 所有查询测试通过！');
    
  } catch (error) {
    console.error('❌ 查询测试失败:', error.message);
  } finally {
    process.exit(0);
  }
}

testQueries();
