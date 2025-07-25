// 模拟期号 375 的控制系统行为
import { FixedDrawSystemManager } from './fixed-draw-system.js';

async function simulatePeriod375Control() {
    console.log('🔬 模拟期号 20250717375 的控制系统行为\n');

    // justin111 的下注情况
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
    console.log(`下注号码：1, 2, 3, 4, 5, 6, 7`);
    console.log(`覆盖率：70%`);
    console.log(`未下注号码：8, 9, 10`);

    // 控制配置
    const controlConfig = {
        mode: 'single_member',
        enabled: true,
        target_username: 'justin111',
        control_percentage: '90' // 90%输控制
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

    console.log('\n🎮 控制系统设定：');
    console.log(`模式：${controlConfig.mode}`);
    console.log(`目标：${controlConfig.target_username}`);
    console.log(`控制：${controlConfig.control_percentage}%输控制`);

    // 创建控制系统实例
    const drawSystem = new FixedDrawSystemManager();

    // 模拟1000次看结果分布
    console.log('\n📈 模拟1000次开奖结果：');
    
    let winCount = 0;
    let loseDecisionCount = 0; // 系统决定让用户输的次数
    let winDecisionCount = 0;  // 系统决定让用户赢的次数
    const resultDistribution = {};

    for (let i = 0; i < 1000; i++) {
        // 模拟控制决策
        const randomValue = Math.random();
        const shouldLose = randomValue < 0.9; // 90%机率让用户输
        
        if (shouldLose) {
            loseDecisionCount++;
        } else {
            winDecisionCount++;
        }

        // 生成结果
        const result = await drawSystem.generateTargetMemberResult(
            `375-SIM-${i}`,
            controlConfig,
            betAnalysis
        );

        // 检查第5名的结果
        const position5Result = result[4];
        
        // 统计结果分布
        if (!resultDistribution[position5Result]) {
            resultDistribution[position5Result] = 0;
        }
        resultDistribution[position5Result]++;

        // 检查是否中奖
        if ([1, 2, 3, 4, 5, 6, 7].includes(position5Result)) {
            winCount++;
        }
    }

    console.log(`\n决策统计：`);
    console.log(`系统决定让用户输：${loseDecisionCount}次 (${(loseDecisionCount/10).toFixed(1)}%)`);
    console.log(`系统决定让用户赢：${winDecisionCount}次 (${(winDecisionCount/10).toFixed(1)}%)`);

    console.log(`\n实际结果统计：`);
    console.log(`用户实际中奖：${winCount}次 (${(winCount/10).toFixed(1)}%)`);
    console.log(`用户实际未中奖：${1000 - winCount}次 (${((1000 - winCount)/10).toFixed(1)}%)`);

    console.log(`\n号码分布（第5名）：`);
    Object.keys(resultDistribution).sort((a, b) => a - b).forEach(num => {
        const count = resultDistribution[num];
        const percentage = (count / 10).toFixed(1);
        const isBet = [1, 2, 3, 4, 5, 6, 7].includes(parseInt(num));
        console.log(`号码${num}：${count}次 (${percentage}%) ${isBet ? '⭐已下注' : ''}`);
    });

    // 分析实际开奖结果
    console.log('\n🎯 实际开奖分析：');
    console.log('第5名开出：5（用户已下注）');
    console.log('结果：中奖');
    
    console.log('\n💡 分析结论：');
    console.log('1. 70%覆盖率下，理论中奖率应该是：');
    console.log('   - 无控制时：70%');
    console.log('   - 90%输控制时：约10-15%（取决于算法效率）');
    console.log(`2. 模拟结果显示实际中奖率：${(winCount/10).toFixed(1)}%`);
    console.log('3. 这次中奖可能是：');
    console.log('   - 属于10%"让用户赢"的情况');
    console.log('   - 或系统在70%覆盖率下无法完全避开用户下注');
    
    // 检查号码5在未下注号码中出现的频率
    const unBetNumbers = [8, 9, 10];
    let unBetCount = 0;
    Object.entries(resultDistribution).forEach(([num, count]) => {
        if (unBetNumbers.includes(parseInt(num))) {
            unBetCount += count;
        }
    });
    
    console.log(`\n4. 未下注号码(8,9,10)出现频率：${(unBetCount/10).toFixed(1)}%`);
    console.log('   - 理想情况下应接近90%（如果控制完美执行）');
    console.log(`   - 实际：${(unBetCount/10).toFixed(1)}%`);
}

// 执行模拟
simulatePeriod375Control().then(() => {
    console.log('\n✅ 模拟完成');
    process.exit(0);
}).catch(error => {
    console.error('❌ 模拟错误：', error);
    process.exit(1);
});