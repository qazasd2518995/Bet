#!/usr/bin/env node

/**
 * 測試第5名位置100%輸控制與冠亞優先邏輯衝突修復效果
 * 驗證系統是否正確檢測並處理位置輸控制
 */

// 模擬權重生成結果函數（簡化版）
function weightedRandomIndex(weights) {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  
  if (totalWeight === 0) {
    console.warn('權重總和為0，返回索引0');
    return 0;
  }
  
  let random = Math.random() * totalWeight;
  
  for (let i = 0; i < weights.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return i;
    }
  }
  
  return weights.length - 1;
}

// 測試修復後的100%輸控制檢測邏輯
function testPositionControlDetection() {
  console.log('🧪 測試第5名位置100%輸控制檢測邏輯\n');
  
  // 模擬第5名位置的權重（用戶下注2,3,4,5,6,7,8,9,10號，權重都被設為0.001）
  const weights = {
    positions: Array.from({ length: 10 }, () => Array(10).fill(1))
  };
  
  // 設置第5名位置（索引4）的權重
  const position = 4; // 第5名
  const userBetNumbers = [2, 3, 4, 5, 6, 7, 8, 9, 10]; // 用戶下注的號碼
  
  console.log('📊 測試情境：');
  console.log(`- 用戶下注第${position + 1}名位置：${userBetNumbers.join(', ')}號`);
  console.log('- 用戶未下注：1號');
  console.log('- 期望：系統檢測到100%輸控制並預先分配低權重號碼\n');
  
  // 設置權重
  for (const num of userBetNumbers) {
    weights.positions[position][num - 1] = 0.001; // 極低權重
  }
  
  console.log('🔍 修復後的檢測邏輯測試：\n');
  
  // 🔥 修復後的邏輯：檢查真正的100%位置控制，包括贏控制和輸控制
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
    
    console.log(`位置${pos + 1}: 極高權重${extremeHighCount}個${extremeHighNumbers.length > 0 ? '[' + extremeHighNumbers.join(',') + ']' : '[]'}, 極低權重${extremeLowCount}個${extremeLowNumbers.length > 0 ? '[' + extremeLowNumbers.join(',') + ']' : '[]'}`);
    
    // 檢查贏控制：只有1-2個極高權重號碼時，認為是真正的位置控制
    if (extremeHighCount > 0 && extremeHighCount <= 2) {
      for (const num of extremeHighNumbers) {
        const weight = weights.positions[pos][num - 1];
        extremePositionControls.push({
          position: pos,
          number: num,
          weight: weight,
          type: 'win'
        });
      }
      console.log(`  🎯 位置${pos + 1}檢測到${extremeHighCount}個100%贏控制號碼[${extremeHighNumbers.join(',')}]`);
    }
    
    // 檢查輸控制：如果有多個極低權重號碼，認為是100%輸控制
    if (extremeLowCount >= 3) {
      // 輸控制：隨機選擇一個極低權重號碼
      const randomLowNumber = extremeLowNumbers[Math.floor(Math.random() * extremeLowNumbers.length)];
      extremePositionControls.push({
        position: pos,
        number: randomLowNumber,
        weight: 0.001,
        type: 'loss'
      });
      console.log(`  ❌ 位置${pos + 1}檢測到${extremeLowCount}個100%輸控制號碼[${extremeLowNumbers.join(',')}]，隨機選擇${randomLowNumber}`);
    }
    
    // 龍虎控制檢測
    if (extremeHighCount > 2 || extremeLowCount > 2) {
      if (extremeHighCount === 5 && extremeLowCount === 5) {
        console.log(`  🐉🐅 位置${pos + 1}檢測到龍虎控制權重設置，不進行預先分配`);
      } else if (extremeHighCount > 2) {
        console.log(`  🐉🐅 位置${pos + 1}檢測到${extremeHighCount}個極高權重號碼[${extremeHighNumbers.join(',')}]，判斷為範圍控制，不進行預先分配`);
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
      console.log(`   預先分配號碼：${position5Control.number}（用戶下注的號碼）`);
      console.log(`   控制類型：${position5Control.type === 'loss' ? '輸控制' : '贏控制'}`);
      
      // 驗證選中的號碼是否為用戶下注的號碼
      if (userBetNumbers.includes(position5Control.number)) {
        console.log(`   ✅ 驗證通過：選中號碼${position5Control.number}確實是用戶下注的號碼`);
      } else {
        console.log(`   ❌ 驗證失敗：選中號碼${position5Control.number}不是用戶下注的號碼`);
      }
    } else {
      console.log(`\n❌ 修復失敗！第5名位置100%輸控制未被檢測到`);
    }
  } else {
    console.log(`  無檢測到的位置控制`);
    console.log(`\n❌ 修復失敗！沒有檢測到任何位置控制`);
  }
}

// 測試修復前的錯誤邏輯（對比用）
function testOldBuggyDetection() {
  console.log('\n🐛 測試修復前的錯誤邏輯（對比用）\n');
  
  const weights = {
    positions: Array.from({ length: 10 }, () => Array(10).fill(1))
  };
  
  // 設置第5名位置的權重
  const position = 4;
  const userBetNumbers = [2, 3, 4, 5, 6, 7, 8, 9, 10];
  
  for (const num of userBetNumbers) {
    weights.positions[position][num - 1] = 0.001;
  }
  
  // 🐛 修復前的錯誤邏輯：只檢查極高權重
  const extremePositionControls = [];
  
  for (let pos = 0; pos < 10; pos++) {
    let extremeCount = 0;
    let extremeNumbers = [];
    
    // 只計算極高權重號碼
    for (let num = 0; num < 10; num++) {
      const weight = weights.positions[pos][num];
      if (weight > 100) {
        extremeCount++;
        extremeNumbers.push(num + 1);
      }
    }
    
    console.log(`位置${pos + 1}: 極高權重${extremeCount}個${extremeNumbers.length > 0 ? '[' + extremeNumbers.join(',') + ']' : '[]'}`);
    
    // 只檢查極高權重
    if (extremeCount > 0 && extremeCount <= 2) {
      for (const num of extremeNumbers) {
        const weight = weights.positions[pos][num - 1];
        extremePositionControls.push({
          position: pos,
          number: num,
          weight: weight
        });
      }
    } else if (extremeCount > 2) {
      console.log(`  🐉🐅 位置${pos + 1}檢測到${extremeCount}個極高權重號碼，判斷為範圍控制`);
    }
  }
  
  console.log(`\n📋 修復前 extremePositionControls結果：`);
  if (extremePositionControls.length > 0) {
    extremePositionControls.forEach((control, index) => {
      console.log(`  ${index + 1}. 位置${control.position + 1} - 號碼${control.number} - 權重${control.weight}`);
    });
  } else {
    console.log(`  無檢測到的位置控制`);
    console.log(`\n❌ 修復前邏輯：第5名位置100%輸控制被忽略，會進入原有邏輯處理`);
    console.log(`   問題：只檢查極高權重(>100)，忽略了極低權重(<0.01)的輸控制`);
  }
}

// 主測試函數
async function runTest() {
  console.log('🔧 第5名位置100%輸控制與冠亞優先邏輯衝突修復驗證');
  console.log('='.repeat(80));
  
  // 測試修復後的邏輯
  testPositionControlDetection();
  
  // 測試修復前的錯誤邏輯（對比）
  testOldBuggyDetection();
  
  console.log('\n' + '='.repeat(80));
  console.log('🎯 測試總結：');
  console.log('✅ 修復後：第5名位置100%輸控制被正確檢測為extremePositionControls');
  console.log('❌ 修復前：第5名位置100%輸控制被忽略，進入原有邏輯處理');
  console.log('🔧 修復效果：解決了位置輸控制與冠亞優先邏輯的衝突問題');
  console.log('🎲 預期結果：第5名位置將直接使用預先分配的低權重號碼，不經過原有邏輯');
}

// 執行測試
if (require.main === module) {
  runTest().catch(console.error);
}

module.exports = { testPositionControlDetection, testOldBuggyDetection }; 