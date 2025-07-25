// fix-question-mark-display.js - 修復開獎結束後顯示問號的問題

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fixQuestionMarkDisplay() {
    try {
        console.log('🔧 修復開獎結束後顯示問號的問題...\n');
        
        const indexPath = path.join(__dirname, 'frontend/index.html');
        let content = fs.readFileSync(indexPath, 'utf8');
        
        // 1. 在新期開始時強制停止洗球動畫
        console.log('1. 修復新期開始時的動畫重置...');
        
        const newPeriodFix = `
                                if (serverStatus === 'betting') {
                                    console.log(\`新一期开始: \${serverPeriod}\`);
                                    // 強制停止洗球動畫，確保顯示數字而非問號
                                    if (this.showWashingAnimation) {
                                        console.log('⚠️ 新期開始時發現洗球動畫仍在播放，強制停止');
                                        this.stopWashingAnimation();
                                    }
                                    // 只重置必要的標誌，不影響結果顯示
                                    this.drawingResultProcessed = false;
                                    this.isDrawingInProgress = false;`;
        
        content = content.replace(
            /if \(serverStatus === 'betting'\) \{[\s\S]*?this\.isDrawingInProgress = false;/,
            newPeriodFix
        );
        
        // 2. 修改 completeDrawingProcess，添加超時保護
        console.log('2. 添加開獎結果獲取的超時保護...');
        
        // 在 completeDrawingProcess 開始處添加立即標記
        const completeDrawingProcessFix = `completeDrawingProcess() {
                    console.log('✅ 开始完成开奖流程 - 15秒开奖时间结束');
                    
                    // 檢查是否已經處理過開獎結果，防止重複執行
                    if (this.drawingResultProcessed) {
                        console.log('⚠️ 開獎結果已處理，跳過重複執行');
                        return;
                    }
                    
                    // 清除自動停止计时器
                    if (this.drawingTimeout) {
                        clearTimeout(this.drawingTimeout);
                        this.drawingTimeout = null;
                    }
                    
                    // 標記开奖流程结束和結果已處理
                    this.isDrawingInProgress = false;
                    this.drawingResultProcessed = true; // 標記已處理
                    
                    // 設置超時保護，確保動畫不會無限播放
                    const animationTimeout = setTimeout(() => {
                        if (this.showWashingAnimation) {
                            console.error('⚠️ 開獎結果獲取超時，強制停止動畫');
                            this.stopWashingAnimation();
                            // 如果有緩存的結果，使用它
                            if (this.lastResult && this.lastResult.length === 10) {
                                this.lastResults = [...this.lastResult];
                                this.$set(this, 'lastResults', [...this.lastResult]);
                            }
                        }
                    }, 5000); // 5秒超時保護
                    
                    // 繼續播放洗球動畫，直到獲取到新結果
                    console.log('📊 繼續洗球動畫，同時獲取最新開獎結果...');`;
        
        content = content.replace(
            /completeDrawingProcess\(\) \{[\s\S]*?console\.log\('📊 繼續洗球動畫，同時獲取最新開獎結果\.\.\.'\);/,
            completeDrawingProcessFix
        );
        
        // 3. 在 getLatestResultFromHistory 的 then 處理中清除超時計時器
        console.log('3. 確保成功獲取結果後清除超時計時器...');
        
        // 在所有 stopWashingAnimation 調用前添加清除超時的代碼
        const clearTimeoutBeforeStop = `
                            // 清除超時保護計時器
                            if (animationTimeout) {
                                clearTimeout(animationTimeout);
                            }
                            this.stopWashingAnimation();`;
        
        // 替換所有 this.stopWashingAnimation(); 為包含清除超時的版本
        content = content.replace(/this\.stopWashingAnimation\(\);/g, clearTimeoutBeforeStop);
        
        // 4. 修改 stopWashingAnimation 確保完全清理狀態
        console.log('4. 強化 stopWashingAnimation 函數...');
        
        const stopWashingAnimationFix = `stopWashingAnimation() {
                    console.log('🛑 停止洗球動畫並更新最新结果');
                    
                    // 停止洗球動畫標記
                    this.showWashingAnimation = false;
                    
                    // 重置重試計數
                    this.retryCount = 0;
                    
                    // 確保使用最新的結果，觸發 Vue 響應式更新
                    if (this.lastResults && this.lastResults.length === 10) {
                        console.log('📊 使用已設定的開獎結果', this.lastResults);
                        // 使用 Vue.set 或數組擴展來確保響應式更新
                        this.$set(this, 'lastResults', [...this.lastResults]);
                        
                        // 強制更新 DOM 確保顯示正確
                        this.$nextTick(() => {
                            const balls = document.querySelectorAll('.results-display-new .number-ball');
                            balls.forEach((ball, index) => {
                                ball.classList.remove('washing-ball');
                                const numberSpan = ball.querySelector('span') || ball;
                                if (this.lastResults[index]) {
                                    numberSpan.textContent = this.lastResults[index];
                                }
                            });
                        });`;
        
        content = content.replace(
            /stopWashingAnimation\(\) \{[\s\S]*?this\.\$set\(this, 'lastResults', \[\.\.\.this\.lastResults\]\);/,
            stopWashingAnimationFix
        );
        
        // 5. 在 getServerStatus 中添加額外檢查
        console.log('5. 在狀態更新時添加額外的動畫檢查...');
        
        // 在 updateFromServerStatus 結尾添加檢查
        const statusCheckFix = `
                            
                            // 額外檢查：如果狀態是 betting 但動畫還在播放，強制停止
                            if (serverStatus === 'betting' && this.showWashingAnimation) {
                                console.warn('⚠️ 檢測到異常：投注期間仍在播放洗球動畫，強制停止');
                                this.stopWashingAnimation();
                            }
                        }`;
        
        // 找到 updateFromServerStatus 函數的結尾並添加檢查
        content = content.replace(
            /(updateFromServerStatus[\s\S]*?)\n\s*\}/m,
            '$1' + statusCheckFix
        );
        
        // 寫回文件
        fs.writeFileSync(indexPath, content);
        console.log('✅ 已更新 frontend/index.html');
        
        // 部署到 deploy 目錄
        const deployPath = path.join(__dirname, 'deploy/frontend/index.html');
        fs.copyFileSync(indexPath, deployPath);
        console.log('✅ 已部署到 deploy/frontend/index.html');
        
        console.log('\n✅ 修復完成！');
        console.log('\n修復內容：');
        console.log('1. 新期開始時強制停止洗球動畫');
        console.log('2. 添加 5 秒超時保護，防止動畫無限播放');
        console.log('3. 確保獲取結果後清除超時計時器');
        console.log('4. 強化動畫停止函數，確保 DOM 正確更新');
        console.log('5. 在狀態更新時添加額外檢查');
        
    } catch (error) {
        console.error('修復失敗:', error);
    }
}

// 執行修復
fixQuestionMarkDisplay();