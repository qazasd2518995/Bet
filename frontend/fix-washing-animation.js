// 快速修復洗球動畫不停止的問題
(function() {
    console.log('🔧 加載洗球動畫修復模組');
    
    // 強制停止洗球動畫的函數
    function forceStopWashingAnimation() {
        console.log('🚨 執行強制停止洗球動畫');
        
        const resultBalls = document.querySelectorAll('.results-display-new .number-ball');
        const resultContainer = document.querySelector('.results-display-new');
        
        // 立即停止所有球的動畫
        resultBalls.forEach((ball, index) => {
            ball.classList.remove('washing-ball');
            ball.style.animation = '';
            ball.style.transform = '';
            ball.style.boxShadow = '';
            ball.style.background = '';
            ball.style.backgroundSize = '';
            
            // 恢復原始數字
            const originalText = ball.getAttribute('data-original-text');
            if (originalText && originalText !== '?') {
                ball.textContent = originalText;
            }
        });
        
        // 停止容器動畫
        if (resultContainer) {
            resultContainer.classList.remove('washing-container');
            resultContainer.style.animation = '';
        }
        
        console.log('🚨 強制停止完成');
    }
    
    // 每2秒檢查一次，如果發現異常洗球動畫就強制停止
    setInterval(() => {
        const washingBalls = document.querySelectorAll('.washing-ball');
        if (washingBalls.length > 0) {
            // 檢查是否已經過了合理的洗球時間（比如10秒）
            const gameStatus = window.vueApp?.gameStatus;
            if (gameStatus === 'betting') {
                console.log('🚨 檢測到betting狀態下仍有洗球動畫，強制停止');
                forceStopWashingAnimation();
            }
        }
    }, 2000);
    
    // 全局函數，供手動調用
    window.forceStopWashing = forceStopWashingAnimation;
    
    console.log('✅ 洗球動畫修復模組加載完成');
})(); 