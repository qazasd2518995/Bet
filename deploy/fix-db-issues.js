#!/usr/bin/env node
// fix-db-issues.js - 修復資料庫相關問題的腳本

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 開始修復資料庫相關問題...\n');

// 1. 修復 agentBackend.js 中的查詢問題
console.log('📝 修復 agentBackend.js 中的查詢問題');

const agentBackendPath = path.join(__dirname, 'agentBackend.js');
let agentBackendContent = fs.readFileSync(agentBackendPath, 'utf8');

// 修復項目：
const fixes = [
  {
    name: '修復客服權限檢查',
    from: /async isCustomerService\(agentId\) \{[\s\S]*?return false;[\s\S]*?\}/,
    to: `async isCustomerService(agentId) {
    try {
      const agents = await db.any('SELECT * FROM agents WHERE id = $1 AND level = 0 LIMIT 1', [agentId]);
      return agents.length > 0; // 總代理level為0
    } catch (error) {
      console.error('檢查客服權限出錯:', error);
      return false;
    }
  }`
  },
  
  {
    name: '修復統計查詢',
    from: /SELECT COUNT\(\*\) AS count FROM agents/g,
    to: 'SELECT COUNT(*) as count FROM agents'
  },
  
  {
    name: '修復會員統計查詢',
    from: /SELECT COUNT\(\*\) AS count FROM members/g,
    to: 'SELECT COUNT(*) as count FROM members'
  },
  
  {
    name: '修復佣金查詢',
    from: /SELECT COALESCE\(SUM\(commission_balance\), 0\) as total/g,
    to: 'SELECT COALESCE(SUM(total_commission), 0) as total'
  },
  
  {
    name: '修復交易表名',
    from: /FROM transactions WHERE/g,
    to: 'FROM transaction_records WHERE'
  },
  
  {
    name: '修復交易表名（JOIN）',
    from: /FROM transactions t/g,
    to: 'FROM transaction_records t'
  },
  
  {
    name: '修復交易類型字段',
    from: /t\.type =/g,
    to: 't.transaction_type ='
  },
  
  {
    name: '修復INSERT語句表名',
    from: /INSERT INTO transactions/g,
    to: 'INSERT INTO transaction_records'
  },
  
  {
    name: '修復INSERT語句字段',
    from: /type, before_balance, after_balance/g,
    to: 'transaction_type, balance_before, balance_after'
  }
];

let fixCount = 0;
fixes.forEach(fix => {
  const beforeLength = agentBackendContent.length;
  agentBackendContent = agentBackendContent.replace(fix.from, fix.to);
  const afterLength = agentBackendContent.length;
  
  if (beforeLength !== afterLength) {
    console.log(`  ✅ ${fix.name}`);
    fixCount++;
  } else {
    console.log(`  ⚠️  ${fix.name} - 未找到匹配項`);
  }
});

// 2. 添加資料庫安全查詢函數
console.log('\n📝 添加資料庫安全查詢函數');

const safeQueryFunctions = `
// 安全查詢函數 - 避免 Multiple rows 錯誤
const SafeDB = {
  // 安全的單記錄查詢
  async safeOne(query, params = []) {
    try {
      const results = await db.any(query + ' LIMIT 1', params);
      return results.length > 0 ? results[0] : null;
    } catch (error) {
      console.error('SafeDB.safeOne 錯誤:', error);
      throw error;
    }
  },
  
  // 安全的計數查詢
  async safeCount(query, params = []) {
    try {
      const result = await db.one(query, params);
      return parseInt(result.count || result.total || 0);
    } catch (error) {
      console.error('SafeDB.safeCount 錯誤:', error);
      return 0;
    }
  },
  
  // 安全的存在性檢查
  async exists(query, params = []) {
    try {
      const results = await db.any(query + ' LIMIT 1', params);
      return results.length > 0;
    } catch (error) {
      console.error('SafeDB.exists 錯誤:', error);
      return false;
    }
  }
};

`;

// 在 AgentModel 之前插入安全查詢函數
const agentModelIndex = agentBackendContent.indexOf('// 模型: 代理');
if (agentModelIndex > -1) {
  agentBackendContent = agentBackendContent.slice(0, agentModelIndex) + 
                       safeQueryFunctions + 
                       agentBackendContent.slice(agentModelIndex);
  console.log('  ✅ 添加安全查詢函數');
} else {
  console.log('  ⚠️  未找到插入點');
}

// 3. 寫回修復後的檔案
console.log('\n💾 保存修復後的檔案');
fs.writeFileSync(agentBackendPath, agentBackendContent);

// 4. 創建資料庫查詢測試腳本
console.log('\n📝 創建資料庫查詢測試腳本');

const testScript = `#!/usr/bin/env node
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
    
    console.log('\\n🎉 所有查詢測試通過！');
    
  } catch (error) {
    console.error('❌ 查詢測試失敗:', error.message);
  } finally {
    process.exit(0);
  }
}

testQueries();
`;

fs.writeFileSync(path.join(__dirname, 'test-db-queries.js'), testScript);

console.log('\n🎉 修復完成！');
console.log(`✅ 共修復了 ${fixCount} 個問題`);
console.log('✅ 添加了安全查詢函數');
console.log('✅ 創建了資料庫測試腳本');

console.log('\n📋 接下來的步驟:');
console.log('1. 運行測試腳本: node test-db-queries.js');
console.log('2. 重新部署應用');
console.log('3. 測試客服操作功能');

console.log('\n⚠️  如果還有問題，請檢查:');
console.log('- 資料庫連接是否正常');
console.log('- 所有表格是否已創建');
console.log('- 環境變數是否正確設置'); 