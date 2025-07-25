// 模擬期號 375 的控制系統行為
import { FixedDrawSystemManager } from './fixed-draw-system.js';

async function simulatePeriod375Control() {
    console.log('🔬 模擬期號 20250717375 的控制系統行為\n');

    // justin111 的下注情況
    const justinBets = [
        { betType: 'number', betValue: '1', position: '5', amount: 1 },
        { betType: 'number', betValue: '2', position: '5', amount: 1 },
        { betType: 'number', betValue: '3', position: '5', amount: 1 },
        { betType: 'number', betValue: '4', position: '5', amount: 1 },
        { betType: 'number', betValue: '5', position: '5', amount: 1 },
        { betType: 'number', betValue: '6', position: '5', amount: 1 },
        { betType: 'number', betValue: '7', position: '5', amount: 1 }
    ];

    console.log('📊 下注分析：');
    console.log(`位置：第5名`);
    console.log(`下注號碼：1, 2, 3, 4, 5, 6, 7`);
    console.log(`覆蓋率：70%`);
    console.log(`未下注號碼：8, 9, 10`);

    // 控制配置
    const controlConfig = {
        mode: 'single_member',
        enabled: true,
        target_username: 'justin111',
        control_percentage: '90' // 90%輸控制
    };

    // 下注分析
    const betAnalysis = {
        totalAmount: 7,
        betCount: 7,
        userBets: {
            'justin111': justinBets
        },
        positionBets: {
            5: {
                1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1
            }
        },
        platformRisk: 1
    };

    console.log('\n🎮 控制系統設定：');
    console.log(`模式：${controlConfig.mode}`);
    console.log(`目標：${controlConfig.target_username}`);
    console.log(`控制：${controlConfig.control_percentage}%輸控制`);

    // 創建控制系統實例
    const drawSystem = new FixedDrawSystemManager();

    // 模擬1000次看結果分布
    console.log('\n📈 模擬1000次開獎結果：');
    
    let winCount = 0;
    let loseDecisionCount = 0; // 系統決定讓用戶輸的次數
    let winDecisionCount = 0;  // 系統決定讓用戶贏的次數
    const resultDistribution = {};

    for (let i = 0; i < 1000; i++) {
        // 模擬控制決策
        const randomValue = Math.random();
        const shouldLose = randomValue < 0.9; // 90%機率讓用戶輸
        
        if (shouldLose) {
            loseDecisionCount++;
        } else {
            winDecisionCount++;
        }

        // 生成結果
        const result = await drawSystem.generateTargetMemberResult(
            `375-SIM-${i}`,
            controlConfig,
            betAnalysis
        );

        // 檢查第5名的結果
        const position5Result = result[4];
        
        // 統計結果分布
        if (!resultDistribution[position5Result]) {
            resultDistribution[position5Result] = 0;
        }
        resultDistribution[position5Result]++;

        // 檢查是否中獎
        if ([1, 2, 3, 4, 5, 6, 7].includes(position5Result)) {
            winCount++;
        }
    }

    console.log(`\n決策統計：`);
    console.log(`系統決定讓用戶輸：${loseDecisionCount}次 (${(loseDecisionCount/10).toFixed(1)}%)`);
    console.log(`系統決定讓用戶贏：${winDecisionCount}次 (${(winDecisionCount/10).toFixed(1)}%)`);

    console.log(`\n實際結果統計：`);
    console.log(`用戶實際中獎：${winCount}次 (${(winCount/10).toFixed(1)}%)`);
    console.log(`用戶實際未中獎：${1000 - winCount}次 (${((1000 - winCount)/10).toFixed(1)}%)`);

    console.log(`\n號碼分布（第5名）：`);
    Object.keys(resultDistribution).sort((a, b) => a - b).forEach(num => {
        const count = resultDistribution[num];
        const percentage = (count / 10).toFixed(1);
        const isBet = [1, 2, 3, 4, 5, 6, 7].includes(parseInt(num));
        console.log(`號碼${num}：${count}次 (${percentage}%) ${isBet ? '⭐已下注' : ''}`);
    });

    // 分析實際開獎結果
    console.log('\n🎯 實際開獎分析：');
    console.log('第5名開出：5（用戶已下注）');
    console.log('結果：中獎');
    
    console.log('\n💡 分析結論：');
    console.log('1. 70%覆蓋率下，理論中獎率應該是：');
    console.log('   - 無控制時：70%');
    console.log('   - 90%輸控制時：約10-15%（取決於算法效率）');
    console.log(`2. 模擬結果顯示實際中獎率：${(winCount/10).toFixed(1)}%`);
    console.log('3. 這次中獎可能是：');
    console.log('   - 屬於10%"讓用戶贏"的情況');
    console.log('   - 或系統在70%覆蓋率下無法完全避開用戶下注');
    
    // 檢查號碼5在未下注號碼中出現的頻率
    const unBetNumbers = [8, 9, 10];
    let unBetCount = 0;
    Object.entries(resultDistribution).forEach(([num, count]) => {
        if (unBetNumbers.includes(parseInt(num))) {
            unBetCount += count;
        }
    });
    
    console.log(`\n4. 未下注號碼(8,9,10)出現頻率：${(unBetCount/10).toFixed(1)}%`);
    console.log('   - 理想情況下應接近90%（如果控制完美執行）');
    console.log(`   - 實際：${(unBetCount/10).toFixed(1)}%`);
}

// 執行模擬
simulatePeriod375Control().then(() => {
    console.log('\n✅ 模擬完成');
    process.exit(0);
}).catch(error => {
    console.error('❌ 模擬錯誤：', error);
    process.exit(1);
});