// 洗球动画修复脚本 - 自动检测和修复洗球动画卡住问题
console.log('🔧 洗球动画修复脚本已加载');

// 检查洗球动画是否卡住的函数
function checkWashingAnimationStuck() {
    try {
        // 获取当前游戏状态
        const currentGameData = window.app ? window.app.gameStatus : null;
        const isDrawingInProgress = window.app ? window.app.isDrawingInProgress : false;
        const washingBalls = document.querySelectorAll('.results-display-new .number-ball.washing-ball');
        const washingContainer = document.querySelector('.results-display-new.washing-container');
        
        // 如果在betting状态下发现洗球动画还在运行，且不在开奖流程中，强制停止
        if (currentGameData === 'betting' && !isDrawingInProgress && (washingBalls.length > 0 || washingContainer)) {
            console.log('🚨 检测到洗球动画卡住！游戏状态已是betting但动画仍在运行');
            forceStopWashingAnimation();
            // 同时调用Vue实例的完成开奖流程
            if (window.app && typeof window.app.forceCompleteDrawing === 'function') {
                window.app.forceCompleteDrawing();
            }
            return true;
        }
        
        // 检查是否有球显示问号但游戏状态不是drawing
        const questionMarkBalls = document.querySelectorAll('.results-display-new .number-ball');
        const hasQuestionMarks = Array.from(questionMarkBalls).some(ball => ball.textContent === '?');
        
        if (currentGameData === 'betting' && hasQuestionMarks) {
            console.log('🚨 检测到球显示问号但游戏状态是betting，强制更新显示');
            forceUpdateBallDisplay();
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('❌ 检查洗球动画状态时发生错误:', error);
        return false;
    }
}

// 强制停止洗球动画
function forceStopWashingAnimation() {
    console.log('🚨 开始强制停止洗球动画');
    
    try {
        const resultBalls = document.querySelectorAll('.results-display-new .number-ball');
        const resultContainer = document.querySelector('.results-display-new');
        
        // 立即停止所有球的动画
        resultBalls.forEach((ball, index) => {
            ball.classList.remove('washing-ball');
            ball.style.animation = 'none';
            ball.style.transform = 'none';
            ball.style.boxShadow = '';
            ball.style.background = '';
            ball.style.backgroundSize = '';
            
            // 恢复原始数字或使用Vue实例中的结果
            const originalText = ball.getAttribute('data-original-text');
            if (originalText && originalText !== '?') {
                ball.textContent = originalText;
            } else if (window.app && window.app.lastResults && window.app.lastResults.length > index) {
                ball.textContent = window.app.lastResults[index];
            }
        });
        
        // 停止容器动画
        if (resultContainer) {
            resultContainer.classList.remove('washing-container');
            resultContainer.style.animation = 'none';
        }
        
        console.log('✅ 强制停止洗球动画完成');
        
        // 如果Vue实例存在，也调用其方法
        if (window.app && typeof window.app.forceStopDrawEffect === 'function') {
            window.app.forceStopDrawEffect();
        }
        
        return true;
    } catch (error) {
        console.error('❌ 强制停止洗球动画时发生错误:', error);
        return false;
    }
}

// 强制更新球号显示
function forceUpdateBallDisplay() {
    console.log('🔧 强制更新球号显示');
    
    try {
        const resultBalls = document.querySelectorAll('.results-display-new .number-ball');
        
        if (window.app && window.app.lastResults && window.app.lastResults.length > 0) {
            resultBalls.forEach((ball, index) => {
                if (window.app.lastResults.length > index) {
                    ball.textContent = window.app.lastResults[index];
                    ball.setAttribute('data-original-text', window.app.lastResults[index]);
                }
            });
            console.log('✅ 球号显示更新完成');
        }
    } catch (error) {
        console.error('❌ 更新球号显示时发生错误:', error);
    }
}

// 暴露全局函数供手动调用
window.forceStopWashing = forceStopWashingAnimation;
window.checkWashingStuck = checkWashingAnimationStuck;
window.forceUpdateBalls = forceUpdateBallDisplay;

// 每3秒自动检查一次
setInterval(() => {
    const isStuck = checkWashingAnimationStuck();
    if (isStuck) {
        console.log('🔧 自动修复完成，洗球动画已正确停止');
    }
}, 3000);

console.log('✅ 洗球动画修复脚本初始化完成，可使用以下函数:');
console.log('- window.forceStopWashing() - 强制停止洗球动画');
console.log('- window.checkWashingStuck() - 检查动画是否卡住');
console.log('- window.forceUpdateBalls() - 强制更新球号显示'); 