// 測試 API 返回的期號數據

async function testAPI() {
    try {
        console.log('=== 測試 API 期號問題 ===\n');
        
        // 測試 recent-results API
        console.log('1. 測試 /api/recent-results:');
        const response = await fetch('http://localhost:3000/api/recent-results');
        const data = await response.json();
        
        if (data.success && data.data) {
            console.log(`   返回 ${data.data.length} 條記錄`);
            data.data.slice(0, 5).forEach((record, index) => {
                console.log(`\n   記錄 ${index + 1}:`);
                console.log(`   - 原始期號: ${record.period}`);
                console.log(`   - 期號長度: ${record.period.toString().length}`);
                
                // 測試 formatPeriodDisplay 邏輯
                const periodStr = record.period.toString();
                if (periodStr.length >= 8) {
                    const month = periodStr.substring(4, 6);
                    const day = periodStr.substring(6, 8);
                    const num = periodStr.substring(8);
                    console.log(`   - 格式化: ${month}/${day} ${num}期`);
                }
                
                console.log(`   - 結果: [${record.result ? record.result.join(', ') : 'null'}]`);
            });
        } else {
            console.log('   API 返回錯誤:', data);
        }
        
        // 測試 game-state API
        console.log('\n\n2. 測試 /api/game-state:');
        const gameResponse = await fetch('http://localhost:3000/api/game-state');
        const gameData = await gameResponse.json();
        
        if (gameData.success) {
            console.log(`   - 當前期號: ${gameData.currentPeriod}`);
            console.log(`   - 遊戲狀態: ${gameData.gameStatus}`);
            console.log(`   - 倒計時: ${gameData.countdownSeconds}秒`);
        }
        
    } catch (error) {
        console.error('測試錯誤:', error);
    }
}

// 執行測試
testAPI();