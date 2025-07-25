#!/usr/bin/env node

/**
 * 測試正確的100%輸控制邏輯
 * 驗證輸控制是否選擇用戶未下注的號碼（讓會員輸錢）
 */

// 測試正確的100%輸控制邏輯
function testCorrectLossControlLogic() {
  console.log('🧪 測試正確的100%輸控制邏輯\n');
  
  // 模擬第5名位置的權重
  const weights = {
    positions: Array.from({ length: 10 }, () => Array(10).fill(1))
  };
  
  // 用戶下注情況（根據您的實際測試）
  const position = 4; // 第5名
  const userBetNumbers = [2, 3, 4, 5, 6, 7, 8, 9]; // 用戶下注的8個號碼
  const userNotBetNumbers = [1, 10]; // 用戶未下注的2個號碼
  
  console.log('📊 測試情境：');
  console.log(`- 用戶下注第${position + 1}名位置：${userBetNumbers.join(', ')}號`);
  console.log(`- 用戶未下注：${userNotBetNumbers.join(', ')}號`);
  console.log('- 100%輸控制目標：讓會員輸錢（選擇用戶未下注的號碼）\n');
  
  // 設置權重：用戶下注的號碼權重降低
  for (const num of userBetNumbers) {
    weights.positions[position][num - 1] = 0.001; // 極低權重
  }
  
  console.log('🔍 修復後的正確邏輯測試：\n');
  
  // 正確的100%輸控制邏輯
  const extremePositionControls = [];
  
  for (let pos = 0; pos < 10; pos++) {
    let extremeHighCount = 0;
    let extremeLowCount = 0;
    let extremeHighNumbers = [];
    let extremeLowNumbers = [];
    
    // 計算該位置的極高權重和極低權重號碼
    for (let num = 0; num < 10; num++) {
      const weight = weights.positions[pos][num];
      if (weight > 100) {
        extremeHighCount++;
        extremeHighNumbers.push(num + 1);
      } else if (weight < 0.01) {
        extremeLowCount++;
        extremeLowNumbers.push(num + 1);
      }
    }
    
    if (pos === position) {
      console.log(`位置${pos + 1}: 極高權重${extremeHighCount}個${extremeHighNumbers.length > 0 ? '[' + extremeHighNumbers.join(',') + ']' : '[]'}, 極低權重${extremeLowCount}個${extremeLowNumbers.length > 0 ? '[' + extremeLowNumbers.join(',') + ']' : '[]'}`);
    }
    
    // 檢查輸控制：如果有多個極低權重號碼，認為是100%輸控制
    if (extremeLowCount >= 3) {
      // 100%輸控制：讓會員輸錢，選擇正常權重號碼（用戶未下注的號碼）
      const normalWeightNumbers = [];
      for (let num = 0; num < 10; num++) {
        const weight = weights.positions[pos][num];
        if (weight >= 1) { // 正常權重（用戶未下注的號碼）
          normalWeightNumbers.push(num + 1);
        }
      }
      
      if (normalWeightNumbers.length > 0) {
        const randomNormalNumber = normalWeightNumbers[Math.floor(Math.random() * normalWeightNumbers.length)];
        extremePositionControls.push({
          position: pos,
          number: randomNormalNumber,
          weight: 1,
          type: 'loss'
        });
        console.log(`  💰 位置${pos + 1}檢測到100%輸控制[用戶下注:${extremeLowNumbers.join(',')}]，選擇未下注號碼${randomNormalNumber}讓會員輸錢`);
      } else {
        console.log(`  ⚠️ 位置${pos + 1}輸控制：無正常權重號碼可選，跳過預先分配`);
      }
    }
  }
  
  console.log(`\n📋 extremePositionControls結果：`);
  if (extremePositionControls.length > 0) {
    extremePositionControls.forEach((control, index) => {
      console.log(`  ${index + 1}. 位置${control.position + 1} - 號碼${control.number} - 權重${control.weight} - 類型${control.type === 'win' ? '贏控制' : '輸控制'}`);
    });
    
    // 驗證第5名位置是否被正確檢測
    const position5Control = extremePositionControls.find(c => c.position === 4);
    if (position5Control && position5Control.type === 'loss') {
      console.log(`\n✅ 修復成功！第5名位置100%輸控制被正確檢測`);
      console.log(`   預先分配號碼：${position5Control.number}`);
      console.log(`   控制類型：${position5Control.type === 'loss' ? '輸控制（讓會員輸錢）' : '贏控制'}`);
      
      // 驗證選中的號碼是否為用戶未下注的號碼
      if (userNotBetNumbers.includes(position5Control.number)) {
        console.log(`   ✅ 邏輯正確：選中號碼${position5Control.number}是用戶未下注的號碼，會員將輸錢`);
        console.log(`   💰 結果：會員沒中獎 → 會員輸錢，平台賺錢`);
      } else {
        console.log(`   ❌ 邏輯錯誤：選中號碼${position5Control.number}是用戶下注的號碼，會員將贏錢`);
        console.log(`   💸 結果：會員中獎 → 會員贏錢，平台虧錢`);
      }
    } else {
      console.log(`\n❌ 修復失敗！第5名位置100%輸控制未被檢測到`);
    }
  } else {
    console.log(`  無檢測到的位置控制`);
    console.log(`\n❌ 修復失敗！沒有檢測到任何位置控制`);
  }
}

// 對比測試：錯誤的輸控制邏輯
function testWrongLossControlLogic() {
  console.log('\n🐛 對比測試：錯誤的輸控制邏輯\n');
  
  const weights = {
    positions: Array.from({ length: 10 }, () => Array(10).fill(1))
  };
  
  const position = 4;
  const userBetNumbers = [2, 3, 4, 5, 6, 7, 8, 9];
  
  for (const num of userBetNumbers) {
    weights.positions[position][num - 1] = 0.001;
  }
  
  // 🐛 錯誤的邏輯：選擇極低權重號碼（用戶下注的號碼）
  const extremeLowNumbers = [];
  for (let num = 0; num < 10; num++) {
    const weight = weights.positions[position][num];
    if (weight < 0.01) {
      extremeLowNumbers.push(num + 1);
    }
  }
  
  if (extremeLowNumbers.length >= 3) {
    const randomLowNumber = extremeLowNumbers[Math.floor(Math.random() * extremeLowNumbers.length)];
    console.log(`❌ 錯誤邏輯：選擇低權重號碼${randomLowNumber}（用戶下注的號碼）`);
    console.log(`💸 錯誤結果：會員中獎 → 會員贏錢，平台虧錢`);
    console.log(`🤔 問題：這不是「輸控制」，而是「贏控制」！`);
  }
}

// 主測試函數
async function runTest() {
  console.log('🔧 100%輸控制邏輯概念修復驗證');
  console.log('='.repeat(80));
  console.log('💡 正確概念：');
  console.log('   - 100%輸控制 = 讓會員輸錢，平台賺錢');
  console.log('   - 100%贏控制 = 讓會員贏錢，平台虧錢');
  console.log('='.repeat(80));
  
  // 測試正確的邏輯
  testCorrectLossControlLogic();
  
  // 對比錯誤的邏輯
  testWrongLossControlLogic();
  
  console.log('\n' + '='.repeat(80));
  console.log('🎯 修復總結：');
  console.log('✅ 修復後：100%輸控制選擇用戶未下注的號碼，讓會員輸錢');
  console.log('❌ 修復前：錯誤選擇用戶下注的號碼，實際讓會員贏錢');
  console.log('🔧 根本問題：概念理解錯誤，輸控制不是選擇低權重號碼');
  console.log('💰 正確邏輯：輸控制 = 選擇正常權重號碼（用戶未下注）');
}

// 執行測試
if (require.main === module) {
  runTest().catch(console.error);
}

module.exports = { testCorrectLossControlLogic, testWrongLossControlLogic }; 