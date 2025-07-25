// fix-ball-color-sync.js - 修復開獎結果球色不對應問題

// 在 Vue 實例的 methods 中添加以下函數：

// 1. 添加 stopWashingAnimation 函數
stopWashingAnimation() {
    console.log('🛑 停止洗球動畫並更新最新结果');
    
    // 停止洗球動畫標記
    this.showWashingAnimation = false;
    
    // 清除超時保護
    if (this.animationTimeout) {
        clearTimeout(this.animationTimeout);
        this.animationTimeout = null;
    }
    
    // 重置重試計數
    this.retryCount = 0;
    
    // 確保使用最新的結果，觸發 Vue 響應式更新
    if (this.lastResults && this.lastResults.length === 10) {
        console.log('📊 使用已設定的開獎結果', this.lastResults);
        // 使用 Vue.set 或數組擴展來確保響應式更新
        this.$set(this, 'lastResults', [...this.lastResults]);
        
        // 強制更新 DOM 確保顯示正確
        this.$nextTick(() => {
            this.refreshBallColors();
        });
    }
},

// 2. 添加刷新球色的函數
refreshBallColors() {
    console.log('🎨 刷新球色顯示...');
    const balls = document.querySelectorAll('.results-display-new .number-ball');
    
    balls.forEach((ball, index) => {
        // 移除所有顏色類別
        for (let i = 1; i <= 10; i++) {
            ball.classList.remove(`color-${i}`);
        }
        ball.classList.remove('washing-ball');
        
        // 獲取當前號碼
        const number = this.lastResults[index];
        if (number) {
            // 添加正確的顏色類別
            ball.classList.add(`color-${number}`);
            ball.textContent = number;
            
            // 清除所有內聯樣式
            ball.style = '';
            
            console.log(`球${index + 1}: 號碼${number}, 顏色class=color-${number}`);
        }
    });
    
    // 也更新歷史記錄中的球色
    this.$nextTick(() => {
        this.refreshHistoryBallColors();
    });
    
    console.log('✅ 球色刷新完成');
},

// 3. 刷新歷史記錄球色
refreshHistoryBallColors() {
    // 刷新開獎紀錄彈窗中的球色
    const historyBalls = document.querySelectorAll('.draw-result-number .ball');
    historyBalls.forEach(ball => {
        const number = parseInt(ball.textContent);
        if (!isNaN(number)) {
            // 移除所有顏色類別
            for (let i = 1; i <= 10; i++) {
                ball.classList.remove(`color-${i}`);
            }
            // 添加正確的顏色類別
            ball.classList.add(`color-${number}`);
        }
    });
    
    // 刷新投注記錄中的球色
    const betHistoryBalls = document.querySelectorAll('.draw-numbers .number-ball');
    betHistoryBalls.forEach(ball => {
        const number = parseInt(ball.textContent);
        if (!isNaN(number)) {
            // 移除所有顏色類別
            for (let i = 1; i <= 10; i++) {
                ball.classList.remove(`color-${i}`);
            }
            // 添加正確的顏色類別
            ball.classList.add(`color-${number}`);
        }
    });
},

// 4. 修改 completeDrawingProcess 函數，在更新結果後刷新球色
completeDrawingProcess() {
    console.log('📊 开奖過程完成，處理結果顯示');
    
    // ... 原有代碼 ...
    
    // 從API獲取最新結果
    this.getLatestResultFromHistory().then((latestResult) => {
        if (latestResult && latestResult.length === 10) {
            console.log('📊 從API獲取到最新開獎結果', latestResult);
            // 更新所有結果數據
            this.lastResult = [...latestResult];
            this.lastResults = [...latestResult];
            
            // 停止動畫並刷新球色
            this.stopWashingAnimation();
            
            // 稍後執行賽車動畫
            setTimeout(() => {
                this.finishRaceCompetition(latestResult);
            }, 100);
        }
    });
    
    // ... 其他代碼 ...
},

// 5. 在 updateGameData 中也添加球色刷新
updateGameData() {
    // ... 原有代碼 ...
    
    // 當更新結果時，也刷新球色
    if (data.gameData.lastResult && data.gameData.lastResult.length > 0) {
        this.lastResult = data.gameData.lastResult;
        
        if (!this.isDrawingInProgress) {
            this.lastResults = data.gameData.lastResult;
            console.log(`🎯 更新顯示结果: 期号=${serverPeriod}`);
            
            // 刷新球色
            this.$nextTick(() => {
                this.refreshBallColors();
            });
        }
    }
    
    // ... 其他代碼 ...
}

// 使用說明：
// 1. 將 stopWashingAnimation 和 refreshBallColors 函數添加到 Vue 實例的 methods 中
// 2. 在需要更新結果的地方調用 refreshBallColors() 來確保球色正確
// 3. 特別是在以下情況下：
//    - 開獎動畫結束時
//    - 從 API 獲取新結果時
//    - 切換期號時
//    - 刷新頁面時