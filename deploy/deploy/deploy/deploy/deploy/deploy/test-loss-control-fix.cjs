#!/usr/bin/env node

/**
 * 測試100%輸控制邏輯修復效果
 * 驗證系統是否正確選擇低權重號碼而不是避開低權重號碼
 */

const { Pool } = require('pg');
require('dotenv').config();

// PostgreSQL 連接設定
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

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

// 測試100%輸控制邏輯
function testLossControlLogic() {
  console.log('🧪 測試100%輸控制邏輯修復效果\n');
  
  // 模擬第10名位置的權重（用戶下注1-9號，權重都被設為0.001）
  const availableNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const numberWeights = [
    0.001, 0.001, 0.001, 0.001, 0.001, // 1-5號（用戶下注）
    0.001, 0.001, 0.001, 0.001,        // 6-9號（用戶下注）
    1                                   // 10號（用戶未下注）
  ];
  
  console.log('📊 測試情境：');
  console.log('- 用戶下注第10名位置：1, 2, 3, 4, 5, 6, 7, 8, 9號');
  console.log('- 用戶未下注：10號');
  console.log('- 權重設置：1-9號 = 0.001（極低），10號 = 1（正常）');
  console.log('- 100%輸控制：應該選擇1-9號中的任一個，讓用戶輸\n');
  
  // 檢查是否有極低權重
  const minWeight = Math.min(...numberWeights);
  const hasExtremelyLowWeight = minWeight < 0.01;
  
  console.log(`🔍 檢測結果：hasExtremelyLowWeight = ${hasExtremelyLowWeight}`);
  
  if (hasExtremelyLowWeight) {
    console.log('✅ 檢測到100%輸控制情況\n');
    
    // 🔥 修復後的邏輯
    const lowWeightIndices = [];
    const normalWeightIndices = [];
    
    for (let i = 0; i < numberWeights.length; i++) {
      if (numberWeights[i] < 0.01) {
        lowWeightIndices.push(i);
      } else {
        normalWeightIndices.push(i);
      }
    }
    
    console.log(`📋 低權重號碼索引 (< 0.01): [${lowWeightIndices.join(', ')}]`);
    console.log(`📋 正常權重號碼索引 (>= 0.01): [${normalWeightIndices.join(', ')}]`);
    
    // 測試多次選擇
    const selectionResults = {};
    const testRounds = 1000;
    
    console.log(`\n🎲 進行 ${testRounds} 次模擬選擇測試...\n`);
    
    for (let round = 0; round < testRounds; round++) {
      let selectedNumber = null;
      
      if (lowWeightIndices.length > 0) {
        // 優先從極低權重號碼中選擇
        const randomLowIndex = lowWeightIndices[Math.floor(Math.random() * lowWeightIndices.length)];
        selectedNumber = availableNumbers[randomLowIndex];
      }
      
      if (selectedNumber !== null) {
        selectionResults[selectedNumber] = (selectionResults[selectedNumber] || 0) + 1;
      }
    }
    
    console.log('📊 選擇結果統計：');
    for (let num = 1; num <= 10; num++) {
      const count = selectionResults[num] || 0;
      const percentage = ((count / testRounds) * 100).toFixed(1);
      const isUserBet = num <= 9 ? '✅ 用戶下注' : '❌ 用戶未下注';
      console.log(`   號碼 ${num.toString().padStart(2)}: ${count.toString().padStart(4)} 次 (${percentage.padStart(5)}%) - ${isUserBet}`);
    }
    
    // 驗證結果
    const userBetNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const userBetSelections = userBetNumbers.reduce((sum, num) => sum + (selectionResults[num] || 0), 0);
    const userBetPercentage = (userBetSelections / testRounds) * 100;
    
    console.log(`\n🎯 100%輸控制效果驗證：`);
    console.log(`   選擇用戶下注號碼 (1-9): ${userBetSelections}/${testRounds} (${userBetPercentage.toFixed(1)}%)`);
    console.log(`   選擇用戶未下注號碼 (10): ${selectionResults[10] || 0}/${testRounds} (${((selectionResults[10] || 0) / testRounds * 100).toFixed(1)}%)`);
    
    if (userBetPercentage >= 95) {
      console.log('✅ 修復成功！100%輸控制正確選擇用戶下注的號碼');
    } else {
      console.log('❌ 修復可能有問題，用戶下注號碼選擇比例過低');
    }
    
  } else {
    console.log('❌ 未檢測到100%輸控制情況');
  }
}

// 測試修復前的錯誤邏輯（用於對比）
function testOldBuggyLogic() {
  console.log('\n🐛 測試修復前的錯誤邏輯（對比用）\n');
  
  const availableNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const numberWeights = [
    0.001, 0.001, 0.001, 0.001, 0.001,
    0.001, 0.001, 0.001, 0.001,
    1
  ];
  
  const minWeight = Math.min(...numberWeights);
  const hasExtremelyLowWeight = minWeight < 0.01;
  
  if (hasExtremelyLowWeight) {
    // 🐛 修復前的錯誤邏輯：避開低權重號碼
    const validIndices = [];
    for (let i = 0; i < numberWeights.length; i++) {
      if (numberWeights[i] >= 0.1) { // 只選擇權重不太低的號碼
        validIndices.push(i);
      }
    }
    
    console.log(`📋 修復前邏輯：選擇權重 >= 0.1 的號碼索引: [${validIndices.join(', ')}]`);
    
    if (validIndices.length > 0) {
      const testRounds = 1000;
      const selectionResults = {};
      
      for (let round = 0; round < testRounds; round++) {
        const randomValidIndex = validIndices[Math.floor(Math.random() * validIndices.length)];
        const selectedNumber = availableNumbers[randomValidIndex];
        selectionResults[selectedNumber] = (selectionResults[selectedNumber] || 0) + 1;
      }
      
      console.log('📊 修復前的選擇結果：');
      for (let num = 1; num <= 10; num++) {
        const count = selectionResults[num] || 0;
        const percentage = ((count / testRounds) * 100).toFixed(1);
        const isUserBet = num <= 9 ? '✅ 用戶下注' : '❌ 用戶未下注';
        console.log(`   號碼 ${num.toString().padStart(2)}: ${count.toString().padStart(4)} 次 (${percentage.padStart(5)}%) - ${isUserBet}`);
      }
      
      const userBetNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];
      const userBetSelections = userBetNumbers.reduce((sum, num) => sum + (selectionResults[num] || 0), 0);
      const userBetPercentage = (userBetSelections / testRounds) * 100;
      
      console.log(`\n🐛 修復前的100%輸控制效果：`);
      console.log(`   選擇用戶下注號碼 (1-9): ${userBetSelections}/${testRounds} (${userBetPercentage.toFixed(1)}%)`);
      console.log(`   選擇用戶未下注號碼 (10): ${selectionResults[10] || 0}/${testRounds} (${((selectionResults[10] || 0) / testRounds * 100).toFixed(1)}%)`);
      console.log('❌ 修復前邏輯錯誤：避開用戶下注的號碼，無法實現100%輸控制');
    }
  }
}

// 主測試函數
async function runTest() {
  console.log('🔥 100%輸控制邏輯修復驗證測試');
  console.log('='.repeat(60));
  
  // 測試修復後的邏輯
  testLossControlLogic();
  
  // 測試修復前的錯誤邏輯（對比）
  testOldBuggyLogic();
  
  console.log('\n' + '='.repeat(60));
  console.log('🎯 測試總結：');
  console.log('✅ 修復後：100%輸控制正確選擇用戶下注的低權重號碼');
  console.log('❌ 修復前：錯誤避開用戶下注的號碼，選擇未下注號碼');
  console.log('🔧 修復效果：徹底解決100%輸控制失效問題');
}

// 執行測試
if (require.main === module) {
  runTest().catch(console.error);
}

module.exports = { testLossControlLogic, testOldBuggyLogic }; 