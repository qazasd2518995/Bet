// 洗球動畫修復腳本 - 自動檢測和修復洗球動畫卡住問題
console.log('🔧 洗球動畫修復腳本已加載');

// 檢查洗球動畫是否卡住的函數
function checkWashingAnimationStuck() {
    try {
        // 獲取當前遊戲狀態
        const currentGameData = window.app ? window.app.gameStatus : null;
        const washingBalls = document.querySelectorAll('.results-display-new .number-ball.washing-ball');
        const washingContainer = document.querySelector('.results-display-new.washing-container');
        
        // 如果在betting狀態下發現洗球動畫還在運行，強制停止
        if (currentGameData === 'betting' && (washingBalls.length > 0 || washingContainer)) {
            console.log('🚨 檢測到洗球動畫卡住！遊戲狀態已是betting但動畫仍在運行');
            forceStopWashingAnimation();
            return true;
        }
        
        // 檢查是否有球顯示問號但遊戲狀態不是drawing
        const questionMarkBalls = document.querySelectorAll('.results-display-new .number-ball');
        const hasQuestionMarks = Array.from(questionMarkBalls).some(ball => ball.textContent === '?');
        
        if (currentGameData === 'betting' && hasQuestionMarks) {
            console.log('🚨 檢測到球顯示問號但遊戲狀態是betting，強制更新顯示');
            forceUpdateBallDisplay();
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('❌ 檢查洗球動畫狀態時發生錯誤:', error);
        return false;
    }
}

// 強制停止洗球動畫
function forceStopWashingAnimation() {
    console.log('🚨 開始強制停止洗球動畫');
    
    try {
        const resultBalls = document.querySelectorAll('.results-display-new .number-ball');
        const resultContainer = document.querySelector('.results-display-new');
        
        // 立即停止所有球的動畫
        resultBalls.forEach((ball, index) => {
            ball.classList.remove('washing-ball');
            ball.style.animation = 'none';
            ball.style.transform = 'none';
            ball.style.boxShadow = '';
            ball.style.background = '';
            ball.style.backgroundSize = '';
            
            // 恢復原始數字或使用Vue實例中的結果
            const originalText = ball.getAttribute('data-original-text');
            if (originalText && originalText !== '?') {
                ball.textContent = originalText;
            } else if (window.app && window.app.lastResults && window.app.lastResults.length > index) {
                ball.textContent = window.app.lastResults[index];
            }
        });
        
        // 停止容器動畫
        if (resultContainer) {
            resultContainer.classList.remove('washing-container');
            resultContainer.style.animation = 'none';
        }
        
        console.log('✅ 強制停止洗球動畫完成');
        
        // 如果Vue實例存在，也調用其方法
        if (window.app && typeof window.app.forceStopDrawEffect === 'function') {
            window.app.forceStopDrawEffect();
        }
        
        return true;
    } catch (error) {
        console.error('❌ 強制停止洗球動畫時發生錯誤:', error);
        return false;
    }
}

// 強制更新球號顯示
function forceUpdateBallDisplay() {
    console.log('🔧 強制更新球號顯示');
    
    try {
        const resultBalls = document.querySelectorAll('.results-display-new .number-ball');
        
        if (window.app && window.app.lastResults && window.app.lastResults.length > 0) {
            resultBalls.forEach((ball, index) => {
                if (window.app.lastResults.length > index) {
                    ball.textContent = window.app.lastResults[index];
                    ball.setAttribute('data-original-text', window.app.lastResults[index]);
                }
            });
            console.log('✅ 球號顯示更新完成');
        }
    } catch (error) {
        console.error('❌ 更新球號顯示時發生錯誤:', error);
    }
}

// 暴露全局函數供手動調用
window.forceStopWashing = forceStopWashingAnimation;
window.checkWashingStuck = checkWashingAnimationStuck;
window.forceUpdateBalls = forceUpdateBallDisplay;

// 每3秒自動檢查一次
setInterval(() => {
    const isStuck = checkWashingAnimationStuck();
    if (isStuck) {
        console.log('🔧 自動修復完成，洗球動畫已正確停止');
    }
}, 3000);

console.log('✅ 洗球動畫修復腳本初始化完成，可使用以下函數:');
console.log('- window.forceStopWashing() - 強制停止洗球動畫');
console.log('- window.checkWashingStuck() - 檢查動畫是否卡住');
console.log('- window.forceUpdateBalls() - 強制更新球號顯示'); 