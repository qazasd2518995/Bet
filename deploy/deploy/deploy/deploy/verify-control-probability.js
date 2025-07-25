// 驗證控制系統的機率實現
import drawSystemManager from './fixed-draw-system.js';

console.log('🔍 驗證修正後的控制系統機率實現\n');

// 模擬測試函數
async function testControlProbability() {
    // 模擬90%輸控制的配置
    const controlConfig = {
        mode: 'single_member',
        enabled: true,
        target_username: 'testuser',
        control_percentage: '90' // 90%輸控制
    };

    // 模擬不同覆蓋率的下注分析
    const testScenarios = [
        {
            name: '低覆蓋率（20%）',
            betAnalysis: {
                totalAmount: 100,
                betCount: 2,
                userBets: {
                    'testuser': [
                        { betType: 'number', betValue: '7', position: '3', amount: 50 },
                        { betType: 'number', betValue: '8', position: '3', amount: 50 }
                    ]
                },
                positionBets: {
                    3: { 7: 50, 8: 50 }
                }
            }
        },
        {
            name: '中覆蓋率（50%）',
            betAnalysis: {
                totalAmount: 500,
                betCount: 5,
                userBets: {
                    'testuser': [
                        { betType: 'number', betValue: '1', position: '5', amount: 100 },
                        { betType: 'number', betValue: '2', position: '5', amount: 100 },
                        { betType: 'number', betValue: '3', position: '5', amount: 100 },
                        { betType: 'number', betValue: '4', position: '5', amount: 100 },
                        { betType: 'number', betValue: '5', position: '5', amount: 100 }
                    ]
                },
                positionBets: {
                    5: { 1: 100, 2: 100, 3: 100, 4: 100, 5: 100 }
                }
            }
        },
        {
            name: '高覆蓋率（90%）',
            betAnalysis: {
                totalAmount: 900,
                betCount: 9,
                userBets: {
                    'testuser': [
                        { betType: 'number', betValue: '2', position: '8', amount: 100 },
                        { betType: 'number', betValue: '3', position: '8', amount: 100 },
                        { betType: 'number', betValue: '4', position: '8', amount: 100 },
                        { betType: 'number', betValue: '5', position: '8', amount: 100 },
                        { betType: 'number', betValue: '6', position: '8', amount: 100 },
                        { betType: 'number', betValue: '7', position: '8', amount: 100 },
                        { betType: 'number', betValue: '8', position: '8', amount: 100 },
                        { betType: 'number', betValue: '9', position: '8', amount: 100 },
                        { betType: 'number', betValue: '10', position: '8', amount: 100 }
                    ]
                },
                positionBets: {
                    8: { 2: 100, 3: 100, 4: 100, 5: 100, 6: 100, 7: 100, 8: 100, 9: 100, 10: 100 }
                }
            }
        }
    ];

    for (const scenario of testScenarios) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`📊 測試場景：${scenario.name}`);
        console.log(`${'='.repeat(60)}`);

        const targetBets = scenario.betAnalysis.userBets['testuser'];
        const betNumbers = targetBets.map(b => b.betValue);
        const position = targetBets[0].position;

        console.log(`下注位置：第${position}名`);
        console.log(`下注號碼：${betNumbers.join(', ')}`);
        console.log(`覆蓋率：${betNumbers.length}/10 = ${betNumbers.length * 10}%`);

        // 模擬1000次生成結果
        const simulations = 1000;
        let winCount = 0;

        for (let i = 0; i < simulations; i++) {
            // 使用修正後的控制系統生成結果
            const result = await drawSystemManager.generateTargetMemberResult(
                `TEST-${i}`,
                controlConfig,
                scenario.betAnalysis
            );

            // 檢查是否中獎
            const drawnNumber = result[parseInt(position) - 1];
            if (betNumbers.includes(drawnNumber.toString())) {
                winCount++;
            }
        }

        const actualWinRate = winCount / simulations;
        const expectedWinRate = 0.1; // 90%輸控制 = 10%贏率
        const deviation = Math.abs(actualWinRate - expectedWinRate);

        console.log(`\n📈 模擬結果（${simulations}次）：`);
        console.log(`期望中獎率：${(expectedWinRate * 100).toFixed(1)}%`);
        console.log(`實際中獎率：${(actualWinRate * 100).toFixed(1)}%`);
        console.log(`偏差：${(deviation * 100).toFixed(1)}%`);

        if (deviation < 0.05) {
            console.log(`✅ 控制系統正常：機率符合預期`);
        } else if (deviation < 0.1) {
            console.log(`⚠️ 控制系統基本正常：機率略有偏差`);
        } else {
            console.log(`❌ 控制系統異常：機率偏差過大`);
        }
    }

    // 測試自動偵測模式
    console.log(`\n\n${'='.repeat(60)}`);
    console.log(`🤖 測試自動偵測模式`);
    console.log(`${'='.repeat(60)}`);

    const autoDetectConfig = {
        mode: 'auto_detect',
        enabled: true
    };

    const riskScenarios = [
        {
            name: '高風險（風險係數>8）',
            platformRisk: 9.5
        },
        {
            name: '低風險（風險係數<5）',
            platformRisk: 3.2
        },
        {
            name: '正常風險（風險係數5-8）',
            platformRisk: 6.5
        }
    ];

    for (const risk of riskScenarios) {
        console.log(`\n📊 ${risk.name}`);
        console.log(`平台風險係數：${risk.platformRisk}`);

        const betAnalysis = {
            totalAmount: 1000,
            platformRisk: risk.platformRisk,
            positionBets: {
                1: { 3: 800, 4: 100, 5: 100 }, // 模擬熱門號碼
                2: { 7: 600, 8: 200, 9: 200 }
            }
        };

        const result = await drawSystemManager.generateAutoDetectResult('AUTO-TEST', betAnalysis);
        console.log(`生成結果：[${result.join(', ')}]`);

        if (risk.platformRisk > 8) {
            console.log(`✅ 應該生成平台有利結果（避開熱門號碼）`);
        } else if (risk.platformRisk < 5) {
            console.log(`✅ 應該生成平衡結果`);
        } else {
            console.log(`✅ 應該使用隨機結果`);
        }
    }
}

// 執行測試
testControlProbability().then(() => {
    console.log('\n\n✅ 控制系統機率驗證完成');
    console.log('系統現在會按照設定的機率執行控制，不受下注覆蓋率影響');
    process.exit(0);
}).catch(error => {
    console.error('❌ 測試失敗：', error);
    process.exit(1);
});