import fs from 'fs';

console.log('=== 修復 transaction_records 期號類型問題 ===\n');

// 需要修復的檔案
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
  console.log(`\n檢查檔案: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    console.log('  ❌ 檔案不存在');
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let fixCount = 0;
  
  // 修復模式 1: 在插入 transaction_records 時確保 period 是字符串
  // INSERT INTO transaction_records ... VALUES (..., $X, ...) 
  // 需要改為 VALUES (..., $X::text, ...)
  const insertPattern = /INSERT INTO transaction_records[\s\S]*?VALUES[\s\S]*?\(/g;
  let matches = content.match(insertPattern);
  if (matches) {
    matches.forEach(match => {
      // 計算 VALUES 中有多少個參數來找到 period 的位置
      // period 通常是倒數第二個或第三個參數
      if (match.includes('period') && !match.includes('::text')) {
        fixCount++;
        console.log('  找到需要修復的 INSERT 語句');
      }
    });
  }
  
  // 修復模式 2: 在查詢時確保類型轉換正確
  // WHERE period = $X 需要根據表來決定轉換方向
  // 對於 transaction_records，period 是 varchar
  // 對於 bet_history，period 是 bigint
  
  // 當 JOIN 兩個表時，需要進行類型轉換
  const joinPattern = /FROM transaction_records[\s\S]*?JOIN[\s\S]*?bet_history|FROM bet_history[\s\S]*?JOIN[\s\S]*?transaction_records/g;
  matches = content.match(joinPattern);
  if (matches) {
    console.log(`  找到 ${matches.length} 處表連接，可能需要類型轉換`);
  }
  
  // 修復模式 3: 特定的查詢修復
  // 為 transaction_records 的 period 參數添加類型轉換
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
    console.log(`  ✅ 修復了 ${fixCount} 處期號類型問題`);
    totalFixed += fixCount;
  } else {
    console.log('  ℹ️ 沒有找到需要修復的地方');
  }
});

console.log(`\n總共修復了 ${totalFixed} 處期號類型問題`);

if (totalFixed > 0) {
  console.log('\n⚠️ 重要提醒:');
  console.log('程式碼已修復，但需要重啟後端服務才能生效！');
  console.log('\n執行以下命令重啟:');
  console.log('ps aux | grep "node backend" | grep -v grep | awk \'{print $2}\' | xargs kill');
  console.log('ps aux | grep "node agentBackend" | grep -v grep | awk \'{print $2}\' | xargs kill');
  console.log('nohup node backend.js > backend.log 2>&1 &');
  console.log('nohup node agentBackend.js > agentBackend.log 2>&1 &');
}

console.log('\n建議：統一資料庫中 period 欄位的類型');
console.log('目前狀況：');
console.log('- bet_history.period: bigint');
console.log('- result_history.period: bigint');
console.log('- transaction_records.period: varchar');
console.log('建議將 transaction_records.period 也改為 bigint 以保持一致性');