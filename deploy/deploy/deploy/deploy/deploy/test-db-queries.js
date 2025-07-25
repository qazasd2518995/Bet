#!/usr/bin/env node
// test-db-queries.js - 測試資料庫查詢

import db from './db/config.js';

async function testQueries() {
  console.log('🧪 測試資料庫查詢...');
  
  try {
    // 測試計數查詢
    const agentCount = await db.one('SELECT COUNT(*) as count FROM agents');
    console.log('✅ 代理計數查詢成功:', agentCount.count);
    
    const memberCount = await db.one('SELECT COUNT(*) as count FROM members');
    console.log('✅ 會員計數查詢成功:', memberCount.count);
    
    // 測試交易記錄查詢
    const transactionCount = await db.one('SELECT COUNT(*) as count FROM transaction_records');
    console.log('✅ 交易記錄計數查詢成功:', transactionCount.count);
    
    // 測試開獎記錄查詢
    const drawCount = await db.one('SELECT COUNT(*) as count FROM draw_records');
    console.log('✅ 開獎記錄計數查詢成功:', drawCount.count);
    
    console.log('\n🎉 所有查詢測試通過！');
    
  } catch (error) {
    console.error('❌ 查詢測試失敗:', error.message);
  } finally {
    process.exit(0);
  }
}

testQueries();
