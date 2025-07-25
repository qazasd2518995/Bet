import fs from 'fs';

console.log('=== 修复 transaction_records 期号类型问题 ===\n');

// 需要修复的档案
const files = [
  './enhanced-settlement-system.js',
  './backend.js',
  './optimized-betting-system.js',
  './improved-settlement-system.js',
  './comprehensive-settlement-system.js',
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
  
  // 修复模式 1: 在查询 transaction_records 时确保 period 的类型匹配
  // 当查询 transaction_records 表时，period 是 varchar，需要将参数转为字符串
  
  // 找到涉及 transaction_records 的查询并添加正确的类型转换
  const transactionQueries = [
    {
      // 基本模式：WHERE period = $1 在 transaction_records 表中
      pattern: /(FROM transaction_records[\s\S]*?)WHERE period = \$(\d+)(?!\s*::)/g,
      replacement: '$1WHERE period = $$$2::text'
    },
    {
      // AND 模式：AND period = $1 在 transaction_records 表中
      pattern: /(FROM transaction_records[\s\S]*?)AND period = \$(\d+)(?!\s*::)/g,
      replacement: '$1AND period = $$$2::text'
    },
    {
      // 表别名模式：tr.period = $1
      pattern: /(FROM transaction_records[\s\S]*?)([a-z]+\.)?period = \$(\d+)(?!\s*::)/g,
      replacement: '$1$2period = $$$3::text'
    }
  ];
  
  transactionQueries.forEach(({pattern, replacement}) => {
    const newContent = content.replace(pattern, replacement);
    if (newContent !== content) {
      fixCount++;
      content = newContent;
      console.log(`  修复了查询 transaction_records 的期号参数`);
    }
  });
  
  // 修复模式 2: JOIN 查询中的类型转换
  // 当 JOIN bet_history 和 transaction_records 时，需要确保 period 类型匹配
  const joinPattern = /(JOIN.*transaction_records.*ON.*period = .*\.period)(?!\s*::text)/g;
  const newContent2 = content.replace(joinPattern, '$1::text');
  if (newContent2 !== content) {
    fixCount++;
    content = newContent2;
    console.log(`  修复了 JOIN 查询中的期号类型转换`);
  }
  
  // 修复模式 3: INSERT INTO transaction_records 确保 period 参数是字符串
  // 找到所有插入 transaction_records 的语句
  const insertPattern = /INSERT INTO transaction_records[\s\S]*?VALUES[\s\S]*?\(/g;
  let matches = content.match(insertPattern);
  if (matches) {
    matches.forEach((match, index) => {
      // 检查是否包含 period 参数
      if (match.includes('period') || content.includes('period') && content.indexOf(match) > -1) {
        // 在这个插入语句后面找到对应的参数数组
        let insertIndex = content.indexOf(match);
        let afterInsert = content.substring(insertIndex);
        let valuesMatch = afterInsert.match(/VALUES.*?\((.*?)\)/);
        if (valuesMatch) {
          console.log(`  检查 INSERT 语句 ${index + 1} 的参数处理`);
        }
      }
    });
  }
  
  if (fixCount > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  ✅ 修复了 ${fixCount} 处期号类型问题`);
    totalFixed += fixCount;
  } else {
    console.log('  ℹ️ 没有找到需要修复的地方');
  }
});

console.log(`\n总共修复了 ${totalFixed} 处期号类型问题`);

// 更重要的是直接修复资料库层面的问题
console.log('\n建议的资料库修复方案：');
console.log('1. 统一所有表的 period 栏位类型');
console.log('2. 或者在应用层统一处理类型转换');
console.log('\n当前状况：');
console.log('- bet_history.period: bigint');
console.log('- result_history.period: bigint'); 
console.log('- transaction_records.period: varchar');
console.log('\n建议执行 SQL：');
console.log('ALTER TABLE transaction_records ALTER COLUMN period TYPE bigint USING period::bigint;');

if (totalFixed > 0) {
  console.log('\n⚠️ 重要提醒:');
  console.log('程式码已修复，但需要重启后端服务才能生效！');
}