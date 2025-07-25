// 洗球動畫修復腳本 - 自動检测和修復洗球動畫卡住问题
console.log('🔧 洗球動畫修復腳本已加载');

// 检查洗球動畫是否卡住的函數
function checkWashingAnimationStuck() {
    try {
        // 获取当前遊戲状态
        const currentGameData = window.app ? window.app.gameStatus : null;
        const isDrawingInProgress = window.app ? window.app.isDrawingInProgress : false;
        const washingBalls = document.querySelectorAll('.results-display-new .number-ball.washing-ball');
        const washingContainer = document.querySelector('.results-display-new.washing-container');
        
        // 如果在betting状态下发现洗球動畫还在运行，且不在开奖流程中，强制停止
        if (currentGameData === 'betting' && !isDrawingInProgress && (washingBalls.length > 0 || washingContainer)) {
            console.log('🚨 检测到洗球動畫卡住！遊戲状态已是betting但動畫仍在运行');
            forceStopWashingAnimation();
            // 同时調用Vue實例的完成开奖流程
            if (window.app && typeof window.app.forceCompleteDrawing === 'function') {
                window.app.forceCompleteDrawing();
            }
            return true;
        }
        
        // 检查是否有球显示问號但遊戲状态不是drawing
        const questionMarkBalls = document.querySelectorAll('.results-display-new .number-ball');
        const hasQuestionMarks = Array.from(questionMarkBalls).some(ball => ball.textContent === '?');
        
        if (currentGameData === 'betting' && hasQuestionMarks) {
            console.log('🚨 检测到球显示问號但遊戲状态是betting，强制更新显示');
            forceUpdateBallDisplay();
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('❌ 检查洗球動畫状态时發生错误:', error);
        return false;
    }
}

// 强制停止洗球動畫
function forceStopWashingAnimation() {
    console.log('🚨 开始强制停止洗球動畫');
    
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
            
            // 恢復原始數字或使用Vue實例中的结果
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
        
        console.log('✅ 强制停止洗球動畫完成');
        
        // 如果Vue實例存在，也調用其方法
        if (window.app && typeof window.app.forceStopDrawEffect === 'function') {
            window.app.forceStopDrawEffect();
        }
        
        return true;
    } catch (error) {
        console.error('❌ 强制停止洗球動畫时發生错误:', error);
        return false;
    }
}

// 强制更新球號显示
function forceUpdateBallDisplay() {
    console.log('🔧 强制更新球號显示');
    
    try {
        const resultBalls = document.querySelectorAll('.results-display-new .number-ball');
        
        if (window.app && window.app.lastResults && window.app.lastResults.length > 0) {
            resultBalls.forEach((ball, index) => {
                if (window.app.lastResults.length > index) {
                    ball.textContent = window.app.lastResults[index];
                    ball.setAttribute('data-original-text', window.app.lastResults[index]);
                }
            });
            console.log('✅ 球號显示更新完成');
        }
    } catch (error) {
        console.error('❌ 更新球號显示时發生错误:', error);
    }
}

// 暴露全局函數供手動調用
window.forceStopWashing = forceStopWashingAnimation;
window.checkWashingStuck = checkWashingAnimationStuck;
window.forceUpdateBalls = forceUpdateBallDisplay;

// 每3秒自動检查一次
setInterval(() => {
    const isStuck = checkWashingAnimationStuck();
    if (isStuck) {
        console.log('🔧 自動修復完成，洗球動畫已正確停止');
    }
}, 3000);

console.log('✅ 洗球動畫修復腳本初始化完成，可使用以下函數:');
console.log('- window.forceStopWashing() - 强制停止洗球動畫');
console.log('- window.checkWashingStuck() - 检查動畫是否卡住');
console.log('- window.forceUpdateBalls() - 强制更新球號显示'); 