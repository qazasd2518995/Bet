const { Pool } = require('pg');

// 資料庫配置
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/bet_database',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 模擬generateWeightedResult函數（修復後版本）
function generateWeightedResult(weights, attempts = 0) {
  const MAX_ATTEMPTS = 50;
  const numbers = Array.from({length: 10}, (_, i) => i + 1);
  const result = [];
  let availableNumbers = [...numbers];
  
  console.log(`🎲 生成權重結果 (第${attempts + 1}次嘗試)`);
  
  // 🔥 新增：檢查是否有100%位置控制，如果有則優先處理
  const extremePositionControls = [];
  for (let position = 0; position < 10; position++) {
    for (let num = 0; num < 10; num++) {
      const weight = weights.positions[position][num];
      if (weight > 100) {
        extremePositionControls.push({
          position: position,
          number: num + 1,
          weight: weight
        });
      }
    }
  }
  
  // 如果有100%位置控制，按權重排序並優先處理
  if (extremePositionControls.length > 0) {
    extremePositionControls.sort((a, b) => b.weight - a.weight);
    console.log(`🎯 檢測到${extremePositionControls.length}個100%位置控制:`, extremePositionControls.map(c => `位置${c.position+1}號碼${c.number}(權重:${c.weight})`).join(', '));
    
    // 預先分配100%控制的位置
    const reservedNumbers = new Set();
    const positionAssignments = Array(10).fill(null);
    
    for (const control of extremePositionControls) {
      if (!reservedNumbers.has(control.number)) {
        positionAssignments[control.position] = control.number;
        reservedNumbers.add(control.number);
        console.log(`🔒 預先分配位置${control.position + 1}號碼${control.number}`);
      } else {
        console.log(`⚠️ 號碼${control.number}已被其他位置預先分配，位置${control.position + 1}將使用隨機選擇`);
      }
    }
    
    // 更新可用號碼列表
    availableNumbers = numbers.filter(num => !reservedNumbers.has(num));
    
    // 按位置順序生成結果
    for (let position = 0; position < 10; position++) {
      if (positionAssignments[position] !== null) {
        // 使用預先分配的號碼
        const assignedNumber = positionAssignments[position];
        result.push(assignedNumber);
        console.log(`🎯 位置${position + 1}使用預先分配號碼${assignedNumber}`);
      } else {
        // 從剩餘號碼中選擇
        if (availableNumbers.length > 0) {
          let numberWeights = [];
          for (let i = 0; i < availableNumbers.length; i++) {
            const num = availableNumbers[i];
            numberWeights.push(weights.positions[position][num-1] || 1);
          }
          
          const selectedIndex = weightedRandomIndex(numberWeights);
          const selectedNumber = availableNumbers[selectedIndex];
          console.log(`🎲 位置${position + 1}權重選擇號碼${selectedNumber} (權重:${numberWeights[selectedIndex]})`);
          result.push(selectedNumber);
          availableNumbers.splice(selectedIndex, 1);
        } else {
          console.error(`❌ 位置${position + 1}沒有可用號碼！`);
          result.push(1);
        }
      }
    }
    
    console.log(`🏁 最終開獎結果: [${result.join(', ')}]`);
    return result;
  }
  
  // 原有邏輯（略）
  console.log('沒有100%位置控制，使用原有邏輯');
  return [1,2,3,4,5,6,7,8,9,10]; // 簡化返回
}

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

async function testPositionControlFix() {
  console.log('\n🧪 測試位置控制修復效果...\n');
  
  // 測試情境1：justin111第6名投注10號，100%贏控制
  console.log('📋 測試情境1：justin111第6名投注10號，100%贏控制');
  
  const weights1 = {
    positions: Array.from({ length: 10 }, () => Array(10).fill(1)),
    sumValue: Array(17).fill(1)
  };
  
  // 設置第6名(位置5)的10號(索引9)為100%贏控制
  weights1.positions[5][9] = 1000; // 100%控制使用1000倍權重
  
  console.log('權重設置：位置6號碼10 = 1000倍權重');
  
  const result1 = generateWeightedResult(weights1);
  const isSuccess1 = result1[5] === 10;
  
  console.log(`\n✅ 測試結果1: 第6名開出${result1[5]}號，預期10號，${isSuccess1 ? '成功✅' : '失敗❌'}`);
  
  // 測試情境2：多個位置控制
  console.log('\n📋 測試情境2：多個位置控制（第3名8號，第7名5號）');
  
  const weights2 = {
    positions: Array.from({ length: 10 }, () => Array(10).fill(1)),
    sumValue: Array(17).fill(1)
  };
  
  weights2.positions[2][7] = 1000; // 第3名8號
  weights2.positions[6][4] = 1000; // 第7名5號
  
  console.log('權重設置：位置3號碼8 = 1000倍權重，位置7號碼5 = 1000倍權重');
  
  const result2 = generateWeightedResult(weights2);
  const isSuccess2 = result2[2] === 8 && result2[6] === 5;
  
  console.log(`\n✅ 測試結果2: 第3名開出${result2[2]}號(預期8)，第7名開出${result2[6]}號(預期5)，${isSuccess2 ? '成功✅' : '失敗❌'}`);
  
  // 測試情境3：衝突情境（多個位置都要同一號碼）
  console.log('\n📋 測試情境3：衝突情境（第1名和第6名都要10號）');
  
  const weights3 = {
    positions: Array.from({ length: 10 }, () => Array(10).fill(1)),
    sumValue: Array(17).fill(1)
  };
  
  weights3.positions[0][9] = 1500; // 第1名10號（更高權重）
  weights3.positions[5][9] = 1000; // 第6名10號（較低權重）
  
  console.log('權重設置：位置1號碼10 = 1500倍權重，位置6號碼10 = 1000倍權重');
  
  const result3 = generateWeightedResult(weights3);
  const isSuccess3 = result3[0] === 10; // 第1名應該獲得10號
  
  console.log(`\n✅ 測試結果3: 第1名開出${result3[0]}號(預期10)，第6名開出${result3[5]}號(應該不是10)，${isSuccess3 ? '成功✅' : '失敗❌'}`);
  
  console.log('\n🎯 總結：位置控制修復效果');
  console.log(`測試1（單一位置控制）：${isSuccess1 ? '通過✅' : '失敗❌'}`);
  console.log(`測試2（多位置控制）：${isSuccess2 ? '通過✅' : '失敗❌'}`);
  console.log(`測試3（衝突處理）：${isSuccess3 ? '通過✅' : '失敗❌'}`);
  
  const allSuccess = isSuccess1 && isSuccess2 && isSuccess3;
  console.log(`\n🏆 整體測試結果：${allSuccess ? '完全成功✅' : '需要進一步調試❌'}`);
}

// 測試生產環境真實情況
async function testRealWorldScenario() {
  console.log('\n🌍 測試生產環境真實情況...\n');
  
  try {
    // 模擬justin111在第6名投注10號的場景
    const period = '20250703999'; // 測試期數
    
    // 檢查是否有真實下注記錄
    const betCheck = await pool.query(`
      SELECT bet_type, bet_value, position, amount, username
      FROM bet_history 
      WHERE username = 'justin111' AND bet_type = 'number' AND position = 6 AND bet_value = 10
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    if (betCheck.rows.length > 0) {
      console.log('✅ 找到justin111第6名投注10號的記錄：', betCheck.rows[0]);
      
      // 模擬權重計算
      const weights = {
        positions: Array.from({ length: 10 }, () => Array(10).fill(1)),
        sumValue: Array(17).fill(1)
      };
      
      // 100%贏控制
      weights.positions[5][9] = 1000;
      
      console.log('\n模擬100%贏控制權重調整...');
      const result = generateWeightedResult(weights);
      
      console.log(`\n🎯 模擬開獎結果：[${result.join(', ')}]`);
      console.log(`第6名開出：${result[5]}號`);
      console.log(`控制效果：${result[5] === 10 ? '成功，開出目標號碼10' : '失敗，未開出目標號碼10'}`);
      
    } else {
      console.log('❌ 未找到justin111第6名投注10號的記錄');
      console.log('創建模擬下注進行測試...');
      
      const weights = {
        positions: Array.from({ length: 10 }, () => Array(10).fill(1)),
        sumValue: Array(17).fill(1)
      };
      
      weights.positions[5][9] = 1000;
      const result = generateWeightedResult(weights);
      
      console.log(`模擬開獎結果：[${result.join(', ')}]`);
      console.log(`第6名開出：${result[5]}號，控制效果：${result[5] === 10 ? '成功✅' : '失敗❌'}`);
    }
    
  } catch (error) {
    console.error('❌ 測試真實情況時出錯：', error.message);
  }
}

async function main() {
  try {
    await testPositionControlFix();
    await testRealWorldScenario();
  } catch (error) {
    console.error('❌ 測試過程出錯：', error);
  } finally {
    await pool.end();
  }
}

main(); 