import fs from 'fs';

console.log('=== 修复期号类型错误 (bigint 而非 text) ===\n');

// 需要修复的档案
const files = [
  './enhanced-settlement-system.js',
  './backend.js',
  './optimized-betting-system.js',
  './improved-settlement-system.js',
  './comprehensive-settlement-system.js',
  './process-single-period-rebate.js'
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
  
  // 移除错误的 ::text 转换，改为不转换（因为 period 是 bigint）
  // 修复模式 1: 将 $1::text 改回 $1
  const pattern1 = /\$(\d+)::text/g;
  content = content.replace(pattern1, (match, num) => {
    fixCount++;
    return `$${num}`;
  });
  
  // 修复模式 2: 将数字::text 改为只有数字
  const pattern2 = /(\d{11,})::text/g;
  content = content.replace(pattern2, (match, period) => {
    fixCount++;
    return period;
  });
  
  // 修复模式 3: 修复字串形式的期号（需要将字串转为数字）
  // WHERE period = '20250716109' 改为 WHERE period = 20250716109
  const pattern3 = /WHERE period = '(\d{11,})'/g;
  content = content.replace(pattern3, (match, period) => {
    fixCount++;
    return `WHERE period = ${period}`;
  });
  
  // 修复模式 4: AND period = '数字' 的情况
  const pattern4 = /AND period = '(\d{11,})'/g;
  content = content.replace(pattern4, (match, period) => {
    fixCount++;
    return `AND period = ${period}`;
  });
  
  // 修复模式 5: 表别名的情况
  const pattern5 = /(tr\.period|bh\.period|rh\.period|t\.period|b\.period) = '(\d{11,})'/g;
  content = content.replace(pattern5, (match, table, period) => {
    fixCount++;
    return `${table} = ${period}`;
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
  console.log('ps aux | grep "node agentBackend" | grep -v grep | awk \'{print $2}\' | xargs kill');
  console.log('nohup node backend.js > backend.log 2>&1 &');
  console.log('nohup node agentBackend.js > agentBackend.log 2>&1 &');
}