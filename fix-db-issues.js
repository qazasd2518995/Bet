#!/usr/bin/env node
// fix-db-issues.js - 修复资料库相关问题的脚本

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 开始修复资料库相关问题...\n');

// 1. 修复 agentBackend.js 中的查询问题
console.log('📝 修复 agentBackend.js 中的查询问题');

const agentBackendPath = path.join(__dirname, 'agentBackend.js');
let agentBackendContent = fs.readFileSync(agentBackendPath, 'utf8');

// 修复项目：
const fixes = [
  {
    name: '修复客服权限检查',
    from: /async isCustomerService\(agentId\) \{[\s\S]*?return false;[\s\S]*?\}/,
    to: `async isCustomerService(agentId) {
    try {
      const agents = await db.any('SELECT * FROM agents WHERE id = $1 AND level = 0 LIMIT 1', [agentId]);
      return agents.length > 0; // 总代理level为0
    } catch (error) {
      console.error('检查客服权限出错:', error);
      return false;
    }
  }`
  },
  
  {
    name: '修复统计查询',
    from: /SELECT COUNT\(\*\) AS count FROM agents/g,
    to: 'SELECT COUNT(*) as count FROM agents'
  },
  
  {
    name: '修复会员统计查询',
    from: /SELECT COUNT\(\*\) AS count FROM members/g,
    to: 'SELECT COUNT(*) as count FROM members'
  },
  
  {
    name: '修复佣金查询',
    from: /SELECT COALESCE\(SUM\(commission_balance\), 0\) as total/g,
    to: 'SELECT COALESCE(SUM(total_commission), 0) as total'
  },
  
  {
    name: '修复交易表名',
    from: /FROM transactions WHERE/g,
    to: 'FROM transaction_records WHERE'
  },
  
  {
    name: '修复交易表名（JOIN）',
    from: /FROM transactions t/g,
    to: 'FROM transaction_records t'
  },
  
  {
    name: '修复交易类型字段',
    from: /t\.type =/g,
    to: 't.transaction_type ='
  },
  
  {
    name: '修复INSERT语句表名',
    from: /INSERT INTO transactions/g,
    to: 'INSERT INTO transaction_records'
  },
  
  {
    name: '修复INSERT语句字段',
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
    console.log(`  ⚠️  ${fix.name} - 未找到匹配项`);
  }
});

// 2. 添加资料库安全查询函数
console.log('\n📝 添加资料库安全查询函数');

const safeQueryFunctions = `
// 安全查询函数 - 避免 Multiple rows 错误
const SafeDB = {
  // 安全的单记录查询
  async safeOne(query, params = []) {
    try {
      const results = await db.any(query + ' LIMIT 1', params);
      return results.length > 0 ? results[0] : null;
    } catch (error) {
      console.error('SafeDB.safeOne 错误:', error);
      throw error;
    }
  },
  
  // 安全的计数查询
  async safeCount(query, params = []) {
    try {
      const result = await db.one(query, params);
      return parseInt(result.count || result.total || 0);
    } catch (error) {
      console.error('SafeDB.safeCount 错误:', error);
      return 0;
    }
  },
  
  // 安全的存在性检查
  async exists(query, params = []) {
    try {
      const results = await db.any(query + ' LIMIT 1', params);
      return results.length > 0;
    } catch (error) {
      console.error('SafeDB.exists 错误:', error);
      return false;
    }
  }
};

`;

// 在 AgentModel 之前插入安全查询函数
const agentModelIndex = agentBackendContent.indexOf('// 模型: 代理');
if (agentModelIndex > -1) {
  agentBackendContent = agentBackendContent.slice(0, agentModelIndex) + 
                       safeQueryFunctions + 
                       agentBackendContent.slice(agentModelIndex);
  console.log('  ✅ 添加安全查询函数');
} else {
  console.log('  ⚠️  未找到插入点');
}

// 3. 写回修复后的档案
console.log('\n💾 保存修复后的档案');
fs.writeFileSync(agentBackendPath, agentBackendContent);

// 4. 创建资料库查询测试脚本
console.log('\n📝 创建资料库查询测试脚本');

const testScript = `#!/usr/bin/env node
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
    
    console.log('\\n🎉 所有查询测试通过！');
    
  } catch (error) {
    console.error('❌ 查询测试失败:', error.message);
  } finally {
    process.exit(0);
  }
}

testQueries();
`;

fs.writeFileSync(path.join(__dirname, 'test-db-queries.js'), testScript);

console.log('\n🎉 修复完成！');
console.log(`✅ 共修复了 ${fixCount} 个问题`);
console.log('✅ 添加了安全查询函数');
console.log('✅ 创建了资料库测试脚本');

console.log('\n📋 接下来的步骤:');
console.log('1. 运行测试脚本: node test-db-queries.js');
console.log('2. 重新部署应用');
console.log('3. 测试客服操作功能');

console.log('\n⚠️  如果还有问题，请检查:');
console.log('- 资料库连接是否正常');
console.log('- 所有表格是否已创建');
console.log('- 环境变数是否正确设置'); 