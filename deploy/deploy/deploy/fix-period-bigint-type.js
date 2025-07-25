import fs from 'fs';

console.log('=== 修復期號類型錯誤 (bigint 而非 text) ===\n');

// 需要修復的檔案
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
  console.log(`\n檢查檔案: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    console.log('  ❌ 檔案不存在');
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let fixCount = 0;
  
  // 移除錯誤的 ::text 轉換，改為不轉換（因為 period 是 bigint）
  // 修復模式 1: 將 $1::text 改回 $1
  const pattern1 = /\$(\d+)::text/g;
  content = content.replace(pattern1, (match, num) => {
    fixCount++;
    return `$${num}`;
  });
  
  // 修復模式 2: 將數字::text 改為只有數字
  const pattern2 = /(\d{11,})::text/g;
  content = content.replace(pattern2, (match, period) => {
    fixCount++;
    return period;
  });
  
  // 修復模式 3: 修復字串形式的期號（需要將字串轉為數字）
  // WHERE period = '20250716109' 改為 WHERE period = 20250716109
  const pattern3 = /WHERE period = '(\d{11,})'/g;
  content = content.replace(pattern3, (match, period) => {
    fixCount++;
    return `WHERE period = ${period}`;
  });
  
  // 修復模式 4: AND period = '數字' 的情況
  const pattern4 = /AND period = '(\d{11,})'/g;
  content = content.replace(pattern4, (match, period) => {
    fixCount++;
    return `AND period = ${period}`;
  });
  
  // 修復模式 5: 表別名的情況
  const pattern5 = /(tr\.period|bh\.period|rh\.period|t\.period|b\.period) = '(\d{11,})'/g;
  content = content.replace(pattern5, (match, table, period) => {
    fixCount++;
    return `${table} = ${period}`;
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