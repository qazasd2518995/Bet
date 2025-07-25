import fs from 'fs';

console.log('=== 修复 transaction_records 期号类型问题 ===\n');

// 需要修复的档案
const files = [
  './enhanced-settlement-system.js',
  './backend.js',
  './optimized-betting-system.js',
  './improved-settlement-system.js',
  './comprehensive-settlement-system.js',
  './process-single-period-rebate.js',
  './agentBackend.js'
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
  
  // 修复模式 1: 在插入 transaction_records 时确保 period 是字符串
  // INSERT INTO transaction_records ... VALUES (..., $X, ...) 
  // 需要改为 VALUES (..., $X::text, ...)
  const insertPattern = /INSERT INTO transaction_records[\s\S]*?VALUES[\s\S]*?\(/g;
  let matches = content.match(insertPattern);
  if (matches) {
    matches.forEach(match => {
      // 计算 VALUES 中有多少个参数来找到 period 的位置
      // period 通常是倒数第二个或第三个参数
      if (match.includes('period') && !match.includes('::text')) {
        fixCount++;
        console.log('  找到需要修复的 INSERT 语句');
      }
    });
  }
  
  // 修复模式 2: 在查询时确保类型转换正确
  // WHERE period = $X 需要根据表来决定转换方向
  // 对于 transaction_records，period 是 varchar
  // 对于 bet_history，period 是 bigint
  
  // 当 JOIN 两个表时，需要进行类型转换
  const joinPattern = /FROM transaction_records[\s\S]*?JOIN[\s\S]*?bet_history|FROM bet_history[\s\S]*?JOIN[\s\S]*?transaction_records/g;
  matches = content.match(joinPattern);
  if (matches) {
    console.log(`  找到 ${matches.length} 处表连接，可能需要类型转换`);
  }
  
  // 修复模式 3: 特定的查询修复
  // 为 transaction_records 的 period 参数添加类型转换
  const patterns = [
    {
      // allocate-rebate API 中的插入
      pattern: /VALUES \('agent', \$1, 'rebate', \$2, \$3, \$4, \$5, \$6, NOW\(\)\)/g,
      replacement: "VALUES ('agent', $1, 'rebate', $2, $3, $4, $5, $6::text, NOW())"
    },
    {
      // processRebates 中的插入
      pattern: /VALUES \('member', \$1, 'win', \$2, \$3, \$4, \$5, NOW\(\)\)/g,
      replacement: "VALUES ('member', $1, 'win', $2, $3, $4, $5::text, NOW())"
    }
  ];
  
  patterns.forEach(({pattern, replacement}) => {
    const newContent = content.replace(pattern, replacement);
    if (newContent !== content) {
      fixCount++;
      content = newContent;
    }
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

console.log('\n建议：统一资料库中 period 栏位的类型');
console.log('目前状况：');
console.log('- bet_history.period: bigint');
console.log('- result_history.period: bigint');
console.log('- transaction_records.period: varchar');
console.log('建议将 transaction_records.period 也改为 bigint 以保持一致性');