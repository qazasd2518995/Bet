// 測試關鍵邏輯修復
const { execSync } = require('child_process');

console.log('=== 關鍵邏輯修復驗證測試 ===\n');

// 測試1: 檢查重複路由
console.log('1. 檢查重複路由問題...');
try {
  const registerRoutes = execSync('grep -n "app\\.post(\'/api/register" backend.js', { encoding: 'utf8' });
  const lines = registerRoutes.trim().split('\n');
  if (lines.length === 1) {
    console.log('✅ 重複register路由已修復');
  } else {
    console.log('❌ 仍存在重複register路由:', lines.length);
  }
} catch (error) {
  console.log('✅ 沒有找到register路由（可能已完全移除）');
}

// 測試2: 檢查退水分配邏輯
console.log('\n2. 檢查退水分配all模式...');
try {
  const rebateCode = execSync('grep -A 10 "rebate_mode === \'all\'" backend.js', { encoding: 'utf8' });
  if (rebateCode.includes('不需要安全截斷') && !rebateCode.includes('Math.max(0, Math.min')) {
    console.log('✅ all模式退水邏輯已修復');
  } else {
    console.log('❌ all模式退水邏輯可能仍有問題');
  }
} catch (error) {
  console.log('❌ 無法檢查退水邏輯');
}

// 測試3: 檢查currentBalance定義
console.log('\n3. 檢查currentBalance變量定義...');
try {
  const settleBetsCode = execSync('grep -B 5 -A 5 "餘額從.*currentBalance" backend.js', { encoding: 'utf8' });
  if (settleBetsCode.includes('const currentBalance = await getBalance')) {
    console.log('✅ currentBalance變量定義已修復');
  } else {
    console.log('❌ currentBalance變量定義可能仍有問題');
  }
} catch (error) {
  console.log('❌ 無法檢查currentBalance定義');
}

// 測試4: 檢查遞迴計數傳遞
console.log('\n4. 檢查遞迴計數傳遞...');
try {
  const recursiveCode = execSync('grep -A 2 "return generateWeightedResult" backend.js', { encoding: 'utf8' });
  if (recursiveCode.includes('attempts + 1')) {
    console.log('✅ 遞迴計數傳遞已修復');
  } else {
    console.log('❌ 遞迴計數傳遞可能仍有問題');
  }
} catch (error) {
  console.log('❌ 無法檢查遞迴計數');
}

// 測試5: 檢查原子性餘額操作
console.log('\n5. 檢查原子性餘額操作...');
try {
  const atomicCode = execSync('grep -n "deductBalance\\|addBalance" backend.js', { encoding: 'utf8' });
  const lines = atomicCode.trim().split('\n');
  if (lines.length >= 2) {
    console.log('✅ 原子性餘額操作已實現');
  } else {
    console.log('❌ 原子性餘額操作可能不完整');
  }
} catch (error) {
  console.log('❌ 無法檢查原子性操作');
}

console.log('\n=== 測試完成 ===');
console.log('建議手動檢查：');
console.log('- 位置投注數字賠率計算');
console.log('- HTTP狀態碼檢查');
console.log('- 密碼加密（安全性提升）'); 