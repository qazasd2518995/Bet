import fs from 'fs';

console.log('=== 修復 transaction_records 期號類型問題 ===\n');

// 需要修復的檔案
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
  console.log(`\n檢查檔案: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    console.log('  ❌ 檔案不存在');
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let fixCount = 0;
  
  // 修復模式 1: 在查詢 transaction_records 時確保 period 的類型匹配
  // 當查詢 transaction_records 表時，period 是 varchar，需要將參數轉為字符串
  
  // 找到涉及 transaction_records 的查詢並添加正確的類型轉換
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
      // 表別名模式：tr.period = $1
      pattern: /(FROM transaction_records[\s\S]*?)([a-z]+\.)?period = \$(\d+)(?!\s*::)/g,
      replacement: '$1$2period = $$$3::text'
    }
  ];
  
  transactionQueries.forEach(({pattern, replacement}) => {
    const newContent = content.replace(pattern, replacement);
    if (newContent !== content) {
      fixCount++;
      content = newContent;
      console.log(`  修復了查詢 transaction_records 的期號參數`);
    }
  });
  
  // 修復模式 2: JOIN 查詢中的類型轉換
  // 當 JOIN bet_history 和 transaction_records 時，需要確保 period 類型匹配
  const joinPattern = /(JOIN.*transaction_records.*ON.*period = .*\.period)(?!\s*::text)/g;
  const newContent2 = content.replace(joinPattern, '$1::text');
  if (newContent2 !== content) {
    fixCount++;
    content = newContent2;
    console.log(`  修復了 JOIN 查詢中的期號類型轉換`);
  }
  
  // 修復模式 3: INSERT INTO transaction_records 確保 period 參數是字符串
  // 找到所有插入 transaction_records 的語句
  const insertPattern = /INSERT INTO transaction_records[\s\S]*?VALUES[\s\S]*?\(/g;
  let matches = content.match(insertPattern);
  if (matches) {
    matches.forEach((match, index) => {
      // 檢查是否包含 period 參數
      if (match.includes('period') || content.includes('period') && content.indexOf(match) > -1) {
        // 在這個插入語句後面找到對應的參數數組
        let insertIndex = content.indexOf(match);
        let afterInsert = content.substring(insertIndex);
        let valuesMatch = afterInsert.match(/VALUES.*?\((.*?)\)/);
        if (valuesMatch) {
          console.log(`  檢查 INSERT 語句 ${index + 1} 的參數處理`);
        }
      }
    });
  }
  
  if (fixCount > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  ✅ 修復了 ${fixCount} 處期號類型問題`);
    totalFixed += fixCount;
  } else {
    console.log('  ℹ️ 沒有找到需要修復的地方');
  }
});

console.log(`\n總共修復了 ${totalFixed} 處期號類型問題`);

// 更重要的是直接修復資料庫層面的問題
console.log('\n建議的資料庫修復方案：');
console.log('1. 統一所有表的 period 欄位類型');
console.log('2. 或者在應用層統一處理類型轉換');
console.log('\n當前狀況：');
console.log('- bet_history.period: bigint');
console.log('- result_history.period: bigint'); 
console.log('- transaction_records.period: varchar');
console.log('\n建議執行 SQL：');
console.log('ALTER TABLE transaction_records ALTER COLUMN period TYPE bigint USING period::bigint;');

if (totalFixed > 0) {
  console.log('\n⚠️ 重要提醒:');
  console.log('程式碼已修復，但需要重啟後端服務才能生效！');
}