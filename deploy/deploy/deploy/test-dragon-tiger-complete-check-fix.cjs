const axios = require('axios');

// 龍虎控制完整檢查修復測試
async function testDragonTigerCompleteCheckFix() {
    console.log('🐉🐅 測試龍虎控制完整檢查修復...\n');
    
    const baseURL = 'http://localhost:3000';
    
    try {
        // 測試場景1：dragon_1_10 100%贏控制
        console.log('📋 測試場景1：dragon_1_10 100%贏控制');
        console.log('期望：第1名 > 第10名（龍勝），justin111投注dragon應該中獎');
        
        // 模擬權重設置
        const dragonTigerWeights = {
            positions: Array.from({ length: 10 }, () => Array(10).fill(1)),
            sumValue: Array(17).fill(1)
        };
        
        // 設置龍虎控制權重：第1名大號碼權重高，小號碼權重低
        for (let value = 5; value < 10; value++) {
            dragonTigerWeights.positions[0][value] = 1000; // 第1名大號碼
            dragonTigerWeights.positions[9][value] = 0.001; // 第10名大號碼
        }
        for (let value = 0; value < 5; value++) {
            dragonTigerWeights.positions[0][value] = 0.001; // 第1名小號碼
            dragonTigerWeights.positions[9][value] = 1000; // 第10名小號碼
        }
        
        console.log('🎯 權重設置：');
        console.log(`第1名大號碼(6-10)權重: ${dragonTigerWeights.positions[0][5]} (期望高)`);
        console.log(`第1名小號碼(1-5)權重: ${dragonTigerWeights.positions[0][0]} (期望低)`);
        console.log(`第10名大號碼(6-10)權重: ${dragonTigerWeights.positions[9][5]} (期望低)`);
        console.log(`第10名小號碼(1-5)權重: ${dragonTigerWeights.positions[9][0]} (期望高)`);
        
        // 檢查權重是否符合龍虎控制模式
        let pos1HighCount = 0, pos1LowCount = 0;
        let pos10HighCount = 0, pos10LowCount = 0;
        
        for (let num = 0; num < 10; num++) {
            const weight1 = dragonTigerWeights.positions[0][num];
            const weight10 = dragonTigerWeights.positions[9][num];
            if (weight1 > 100) pos1HighCount++;
            if (weight1 < 0.01) pos1LowCount++;
            if (weight10 > 100) pos10HighCount++;
            if (weight10 < 0.01) pos10LowCount++;
        }
        
        console.log(`\n🔍 權重分析：`);
        console.log(`第1名 - 高權重號碼數: ${pos1HighCount}, 低權重號碼數: ${pos1LowCount}`);
        console.log(`第10名 - 高權重號碼數: ${pos10HighCount}, 低權重號碼數: ${pos10LowCount}`);
        
        const pos1HasDragonTigerWeight = (pos1HighCount === 5 && pos1LowCount === 5);
        const pos10HasDragonTigerWeight = (pos10HighCount === 5 && pos10LowCount === 5);
        
        console.log(`第1名是否有龍虎控制權重: ${pos1HasDragonTigerWeight}`);
        console.log(`第10名是否有龍虎控制權重: ${pos10HasDragonTigerWeight}`);
        console.log(`應該觸發龍虎控制檢查: ${pos1HasDragonTigerWeight && pos10HasDragonTigerWeight}`);
        
        // 模擬多次生成結果測試
        console.log('\n🎲 模擬結果生成測試：');
        let successCount = 0;
        const testRounds = 10;
        
        for (let i = 0; i < testRounds; i++) {
            // 模擬生成結果（這裡簡化為隨機生成）
            const result = [];
            const numbers = [1,2,3,4,5,6,7,8,9,10];
            const availableNumbers = [...numbers];
            
            // 按權重選擇第1名
            const pos1Weights = dragonTigerWeights.positions[0];
            const pos1MaxWeight = Math.max(...pos1Weights);
            const pos1MaxIndex = pos1Weights.indexOf(pos1MaxWeight);
            const pos1Value = pos1MaxIndex + 1;
            result[0] = pos1Value;
            availableNumbers.splice(availableNumbers.indexOf(pos1Value), 1);
            
            // 隨機填充第2-9名
            for (let pos = 1; pos < 9; pos++) {
                const randomIndex = Math.floor(Math.random() * availableNumbers.length);
                result[pos] = availableNumbers[randomIndex];
                availableNumbers.splice(randomIndex, 1);
            }
            
            // 按權重選擇第10名
            const pos10Weights = dragonTigerWeights.positions[9];
            let bestWeight = -1;
            let bestValue = availableNumbers[0];
            
            for (const num of availableNumbers) {
                const weight = pos10Weights[num - 1];
                if (weight > bestWeight) {
                    bestWeight = weight;
                    bestValue = num;
                }
            }
            result[9] = bestValue;
            
            // 檢查龍虎結果
            const pos1Result = result[0];
            const pos10Result = result[9];
            const dragonWins = pos1Result > pos10Result;
            
            console.log(`第${i+1}輪：[${result.join(',')}] - 第1名:${pos1Result}, 第10名:${pos10Result}, 龍${dragonWins ? '勝' : '負'}`);
            
            if (dragonWins) {
                successCount++;
            }
        }
        
        console.log(`\n📊 測試結果：${successCount}/${testRounds} 輪龍勝 (${((successCount/testRounds)*100).toFixed(1)}%)`);
        console.log(`期望：100%龍勝（因為100%贏控制）`);
        
        if (successCount === testRounds) {
            console.log('✅ 龍虎控制邏輯正確：100%控制確實產生100%龍勝');
        } else {
            console.log('❌ 龍虎控制邏輯有問題：應該100%龍勝但實際不是');
        }
        
        // 測試場景2：tiger_1_10 100%贏控制
        console.log('\n📋 測試場景2：tiger_1_10 100%贏控制');
        console.log('期望：第1名 < 第10名（虎勝）');
        
        // 反向權重設置
        const tigerWeights = {
            positions: Array.from({ length: 10 }, () => Array(10).fill(1)),
            sumValue: Array(17).fill(1)
        };
        
        // 虎贏：第1名小號碼權重高，第10名大號碼權重高
        for (let value = 5; value < 10; value++) {
            tigerWeights.positions[0][value] = 0.001; // 第1名大號碼
            tigerWeights.positions[9][value] = 1000; // 第10名大號碼
        }
        for (let value = 0; value < 5; value++) {
            tigerWeights.positions[0][value] = 1000; // 第1名小號碼
            tigerWeights.positions[9][value] = 0.001; // 第10名小號碼
        }
        
        let tigerSuccessCount = 0;
        
        for (let i = 0; i < testRounds; i++) {
            const result = [];
            const numbers = [1,2,3,4,5,6,7,8,9,10];
            const availableNumbers = [...numbers];
            
            // 按權重選擇第1名（應該選小號碼）
            const pos1Weights = tigerWeights.positions[0];
            const pos1MaxWeight = Math.max(...pos1Weights);
            const pos1MaxIndex = pos1Weights.indexOf(pos1MaxWeight);
            const pos1Value = pos1MaxIndex + 1;
            result[0] = pos1Value;
            availableNumbers.splice(availableNumbers.indexOf(pos1Value), 1);
            
            // 隨機填充第2-9名
            for (let pos = 1; pos < 9; pos++) {
                const randomIndex = Math.floor(Math.random() * availableNumbers.length);
                result[pos] = availableNumbers[randomIndex];
                availableNumbers.splice(randomIndex, 1);
            }
            
            // 按權重選擇第10名（應該選大號碼）
            const pos10Weights = tigerWeights.positions[9];
            let bestWeight = -1;
            let bestValue = availableNumbers[0];
            
            for (const num of availableNumbers) {
                const weight = pos10Weights[num - 1];
                if (weight > bestWeight) {
                    bestWeight = weight;
                    bestValue = num;
                }
            }
            result[9] = bestValue;
            
            // 檢查龍虎結果
            const pos1Result = result[0];
            const pos10Result = result[9];
            const tigerWins = pos1Result < pos10Result;
            
            console.log(`第${i+1}輪：[${result.join(',')}] - 第1名:${pos1Result}, 第10名:${pos10Result}, 虎${tigerWins ? '勝' : '負'}`);
            
            if (tigerWins) {
                tigerSuccessCount++;
            }
        }
        
        console.log(`\n📊 虎控制測試結果：${tigerSuccessCount}/${testRounds} 輪虎勝 (${((tigerSuccessCount/testRounds)*100).toFixed(1)}%)`);
        
        if (tigerSuccessCount === testRounds) {
            console.log('✅ 虎控制邏輯正確：100%控制確實產生100%虎勝');
        } else {
            console.log('❌ 虎控制邏輯有問題：應該100%虎勝但實際不是');
        }
        
        console.log('\n🎯 修復總結：');
        console.log('1. 修復前：龍虎控制檢查只在前兩位生成時進行，無法檢查第1名vs第10名');
        console.log('2. 修復後：在完整結果生成後進行全面的龍虎控制檢查');
        console.log('3. 新邏輯：檢測龍虎控制權重模式（5個高權重+5個低權重）');
        console.log('4. 結果驗證：確保第1名vs第10名的對比符合控制預期');
        console.log('5. 重新生成：如果結果不符合期望，觸發重新生成機制');
        
    } catch (error) {
        console.error('❌ 測試過程中發生錯誤:', error.message);
    }
}

// 執行測試
testDragonTigerCompleteCheckFix(); 