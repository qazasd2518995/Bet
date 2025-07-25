import fs from 'fs';

console.log('=== 修复期号类型错误 ===\n');

// 需要修复的档案
const files = [
  './enhanced-settlement-system.js',
  './backend.js'
];

let totalFixed = 0;

files.forEach(filePath => {
  console.log(`\n检查档案: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    console.log('  ❌ 档案不存在');
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let fixCount = 0;
  
  // 修复模式 1: WHERE period = $1 的情况
  const pattern1 = /WHERE period = \$(\d+)(?!\s*::)/g;
  content = content.replace(pattern1, (match, num) => {
    fixCount++;
    return `WHERE period = $${num}::text`;
  });
  
  // 修复模式 2: AND period = $1 的情况
  const pattern2 = /AND period = \$(\d+)(?!\s*::)/g;
  content = content.replace(pattern2, (match, num) => {
    fixCount++;
    return `AND period = $${num}::text`;
  });
  
  // 修复模式 3: 直接使用期号数字的情况（在 SQL 字串中）
  const pattern3 = /WHERE period = (\d{11,})/g;
  content = content.replace(pattern3, (match, period) => {
    fixCount++;
    return `WHERE period = '${period}'`;
  });
  
  // 修复模式 4: AND period = 数字的情况
  const pattern4 = /AND period = (\d{11,})/g;
  content = content.replace(pattern4, (match, period) => {
    fixCount++;
    return `AND period = '${period}'`;
  });
  
  // 修复模式 5: tr.period = 或 bh.period = 的情况
  const pattern5 = /(tr\.period|bh\.period|rh\.period) = \$(\d+)(?!\s*::)/g;
  content = content.replace(pattern5, (match, table, num) => {
    fixCount++;
    return `${table} = $${num}::text`;
  });
  
  if (fixCount > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  ✅ 修复了 ${fixCount} 处期号类型问题`);
    totalFixed += fixCount;
  } else {
    console.log('  ℹ️ 没有找到需要修复的地方');
  }
});

console.log(`\n总共修复了 ${totalFixed} 处期号类型问题`);

if (totalFixed > 0) {
  console.log('\n⚠️ 重要提醒:');
  console.log('程式码已修复，但需要重启后端服务才能生效！');
  console.log('\n执行以下命令重启:');
  console.log('ps aux | grep "node backend" | grep -v grep | awk \'{print $2}\' | xargs kill');
  console.log('nohup node backend.js > backend.log 2>&1 &');
}