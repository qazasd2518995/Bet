// fix-ball-color-sync.js - 修复开奖结果球色不对应问题

// 在 Vue 实例的 methods 中添加以下函数：

// 1. 添加 stopWashingAnimation 函数
stopWashingAnimation() {
    console.log('🛑 停止洗球动画并更新最新结果');
    
    // 停止洗球动画标记
    this.showWashingAnimation = false;
    
    // 清除超时保护
    if (this.animationTimeout) {
        clearTimeout(this.animationTimeout);
        this.animationTimeout = null;
    }
    
    // 重置重试计数
    this.retryCount = 0;
    
    // 确保使用最新的结果，触发 Vue 响应式更新
    if (this.lastResults && this.lastResults.length === 10) {
        console.log('📊 使用已设定的开奖结果', this.lastResults);
        // 使用 Vue.set 或数组扩展来确保响应式更新
        this.$set(this, 'lastResults', [...this.lastResults]);
        
        // 强制更新 DOM 确保显示正确
        this.$nextTick(() => {
            this.refreshBallColors();
        });
    }
},

// 2. 添加刷新球色的函数
refreshBallColors() {
    console.log('🎨 刷新球色显示...');
    const balls = document.querySelectorAll('.results-display-new .number-ball');
    
    balls.forEach((ball, index) => {
        // 移除所有颜色类别
        for (let i = 1; i <= 10; i++) {
            ball.classList.remove(`color-${i}`);
        }
        ball.classList.remove('washing-ball');
        
        // 获取当前号码
        const number = this.lastResults[index];
        if (number) {
            // 添加正确的颜色类别
            ball.classList.add(`color-${number}`);
            ball.textContent = number;
            
            // 清除所有内联样式
            ball.style = '';
            
            console.log(`球${index + 1}: 号码${number}, 颜色class=color-${number}`);
        }
    });
    
    // 也更新历史记录中的球色
    this.$nextTick(() => {
        this.refreshHistoryBallColors();
    });
    
    console.log('✅ 球色刷新完成');
},

// 3. 刷新历史记录球色
refreshHistoryBallColors() {
    // 刷新开奖纪录弹窗中的球色
    const historyBalls = document.querySelectorAll('.draw-result-number .ball');
    historyBalls.forEach(ball => {
        const number = parseInt(ball.textContent);
        if (!isNaN(number)) {
            // 移除所有颜色类别
            for (let i = 1; i <= 10; i++) {
                ball.classList.remove(`color-${i}`);
            }
            // 添加正确的颜色类别
            ball.classList.add(`color-${number}`);
        }
    });
    
    // 刷新投注记录中的球色
    const betHistoryBalls = document.querySelectorAll('.draw-numbers .number-ball');
    betHistoryBalls.forEach(ball => {
        const number = parseInt(ball.textContent);
        if (!isNaN(number)) {
            // 移除所有颜色类别
            for (let i = 1; i <= 10; i++) {
                ball.classList.remove(`color-${i}`);
            }
            // 添加正确的颜色类别
            ball.classList.add(`color-${number}`);
        }
    });
},

// 4. 修改 completeDrawingProcess 函数，在更新结果后刷新球色
completeDrawingProcess() {
    console.log('📊 开奖过程完成，处理结果显示');
    
    // ... 原有代码 ...
    
    // 从API获取最新结果
    this.getLatestResultFromHistory().then((latestResult) => {
        if (latestResult && latestResult.length === 10) {
            console.log('📊 从API获取到最新开奖结果', latestResult);
            // 更新所有结果数据
            this.lastResult = [...latestResult];
            this.lastResults = [...latestResult];
            
            // 停止动画并刷新球色
            this.stopWashingAnimation();
            
            // 稍后执行赛车动画
            setTimeout(() => {
                this.finishRaceCompetition(latestResult);
            }, 100);
        }
    });
    
    // ... 其他代码 ...
},

// 5. 在 updateGameData 中也添加球色刷新
updateGameData() {
    // ... 原有代码 ...
    
    // 当更新结果时，也刷新球色
    if (data.gameData.lastResult && data.gameData.lastResult.length > 0) {
        this.lastResult = data.gameData.lastResult;
        
        if (!this.isDrawingInProgress) {
            this.lastResults = data.gameData.lastResult;
            console.log(`🎯 更新显示结果: 期号=${serverPeriod}`);
            
            // 刷新球色
            this.$nextTick(() => {
                this.refreshBallColors();
            });
        }
    }
    
    // ... 其他代码 ...
}

// 使用说明：
// 1. 将 stopWashingAnimation 和 refreshBallColors 函数添加到 Vue 实例的 methods 中
// 2. 在需要更新结果的地方调用 refreshBallColors() 来确保球色正确
// 3. 特别是在以下情况下：
//    - 开奖动画结束时
//    - 从 API 获取新结果时
//    - 切换期号时
//    - 刷新页面时