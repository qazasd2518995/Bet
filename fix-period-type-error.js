import fs from 'fs';

console.log('=== 修復期號類型錯誤 ===\n');

// 需要修復的檔案
const files = [
  './enhanced-settlement-system.js',
  './backend.js'
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
  
  // 修復模式 1: WHERE period = $1 的情況
  const pattern1 = /WHERE period = \$(\d+)(?!\s*::)/g;
  content = content.replace(pattern1, (match, num) => {
    fixCount++;
    return `WHERE period = $${num}::text`;
  });
  
  // 修復模式 2: AND period = $1 的情況
  const pattern2 = /AND period = \$(\d+)(?!\s*::)/g;
  content = content.replace(pattern2, (match, num) => {
    fixCount++;
    return `AND period = $${num}::text`;
  });
  
  // 修復模式 3: 直接使用期號數字的情況（在 SQL 字串中）
  const pattern3 = /WHERE period = (\d{11,})/g;
  content = content.replace(pattern3, (match, period) => {
    fixCount++;
    return `WHERE period = '${period}'`;
  });
  
  // 修復模式 4: AND period = 數字的情況
  const pattern4 = /AND period = (\d{11,})/g;
  content = content.replace(pattern4, (match, period) => {
    fixCount++;
    return `AND period = '${period}'`;
  });
  
  // 修復模式 5: tr.period = 或 bh.period = 的情況
  const pattern5 = /(tr\.period|bh\.period|rh\.period) = \$(\d+)(?!\s*::)/g;
  content = content.replace(pattern5, (match, table, num) => {
    fixCount++;
    return `${table} = $${num}::text`;
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
  console.log('nohup node backend.js > backend.log 2>&1 &');
}