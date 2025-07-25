// 测试 API 返回的期号数据

async function testAPI() {
    try {
        console.log('=== 测试 API 期号问题 ===\n');
        
        // 测试 recent-results API
        console.log('1. 测试 /api/recent-results:');
        const response = await fetch('http://localhost:3000/api/recent-results');
        const data = await response.json();
        
        if (data.success && data.data) {
            console.log(`   返回 ${data.data.length} 条记录`);
            data.data.slice(0, 5).forEach((record, index) => {
                console.log(`\n   记录 ${index + 1}:`);
                console.log(`   - 原始期号: ${record.period}`);
                console.log(`   - 期号长度: ${record.period.toString().length}`);
                
                // 测试 formatPeriodDisplay 逻辑
                const periodStr = record.period.toString();
                if (periodStr.length >= 8) {
                    const month = periodStr.substring(4, 6);
                    const day = periodStr.substring(6, 8);
                    const num = periodStr.substring(8);
                    console.log(`   - 格式化: ${month}/${day} ${num}期`);
                }
                
                console.log(`   - 结果: [${record.result ? record.result.join(', ') : 'null'}]`);
            });
        } else {
            console.log('   API 返回错误:', data);
        }
        
        // 测试 game-state API
        console.log('\n\n2. 测试 /api/game-state:');
        const gameResponse = await fetch('http://localhost:3000/api/game-state');
        const gameData = await gameResponse.json();
        
        if (gameData.success) {
            console.log(`   - 当前期号: ${gameData.currentPeriod}`);
            console.log(`   - 游戏状态: ${gameData.gameStatus}`);
            console.log(`   - 倒计时: ${gameData.countdownSeconds}秒`);
        }
        
    } catch (error) {
        console.error('测试错误:', error);
    }
}

// 执行测试
testAPI();