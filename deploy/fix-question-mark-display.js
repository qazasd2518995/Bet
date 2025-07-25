// fix-question-mark-display.js - 修复开奖结束后显示问号的问题

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fixQuestionMarkDisplay() {
    try {
        console.log('🔧 修复开奖结束后显示问号的问题...\n');
        
        const indexPath = path.join(__dirname, 'frontend/index.html');
        let content = fs.readFileSync(indexPath, 'utf8');
        
        // 1. 在新期开始时强制停止洗球动画
        console.log('1. 修复新期开始时的动画重置...');
        
        const newPeriodFix = `
                                if (serverStatus === 'betting') {
                                    console.log(\`新一期开始: \${serverPeriod}\`);
                                    // 强制停止洗球动画，确保显示数字而非问号
                                    if (this.showWashingAnimation) {
                                        console.log('⚠️ 新期开始时发现洗球动画仍在播放，强制停止');
                                        this.stopWashingAnimation();
                                    }
                                    // 只重置必要的标志，不影响结果显示
                                    this.drawingResultProcessed = false;
                                    this.isDrawingInProgress = false;`;
        
        content = content.replace(
            /if \(serverStatus === 'betting'\) \{[\s\S]*?this\.isDrawingInProgress = false;/,
            newPeriodFix
        );
        
        // 2. 修改 completeDrawingProcess，添加超时保护
        console.log('2. 添加开奖结果获取的超时保护...');
        
        // 在 completeDrawingProcess 开始处添加立即标记
        const completeDrawingProcessFix = `completeDrawingProcess() {
                    console.log('✅ 开始完成开奖流程 - 15秒开奖时间结束');
                    
                    // 检查是否已经处理过开奖结果，防止重复执行
                    if (this.drawingResultProcessed) {
                        console.log('⚠️ 开奖结果已处理，跳过重复执行');
                        return;
                    }
                    
                    // 清除自动停止计时器
                    if (this.drawingTimeout) {
                        clearTimeout(this.drawingTimeout);
                        this.drawingTimeout = null;
                    }
                    
                    // 标记开奖流程结束和结果已处理
                    this.isDrawingInProgress = false;
                    this.drawingResultProcessed = true; // 标记已处理
                    
                    // 设置超时保护，确保动画不会无限播放
                    const animationTimeout = setTimeout(() => {
                        if (this.showWashingAnimation) {
                            console.error('⚠️ 开奖结果获取超时，强制停止动画');
                            this.stopWashingAnimation();
                            // 如果有缓存的结果，使用它
                            if (this.lastResult && this.lastResult.length === 10) {
                                this.lastResults = [...this.lastResult];
                                this.$set(this, 'lastResults', [...this.lastResult]);
                            }
                        }
                    }, 5000); // 5秒超时保护
                    
                    // 继续播放洗球动画，直到获取到新结果
                    console.log('📊 继续洗球动画，同时获取最新开奖结果...');`;
        
        content = content.replace(
            /completeDrawingProcess\(\) \{[\s\S]*?console\.log\('📊 继续洗球动画，同时获取最新开奖结果\.\.\.'\);/,
            completeDrawingProcessFix
        );
        
        // 3. 在 getLatestResultFromHistory 的 then 处理中清除超时计时器
        console.log('3. 确保成功获取结果后清除超时计时器...');
        
        // 在所有 stopWashingAnimation 调用前添加清除超时的代码
        const clearTimeoutBeforeStop = `
                            // 清除超时保护计时器
                            if (animationTimeout) {
                                clearTimeout(animationTimeout);
                            }
                            this.stopWashingAnimation();`;
        
        // 替换所有 this.stopWashingAnimation(); 为包含清除超时的版本
        content = content.replace(/this\.stopWashingAnimation\(\);/g, clearTimeoutBeforeStop);
        
        // 4. 修改 stopWashingAnimation 确保完全清理状态
        console.log('4. 强化 stopWashingAnimation 函数...');
        
        const stopWashingAnimationFix = `stopWashingAnimation() {
                    console.log('🛑 停止洗球动画并更新最新结果');
                    
                    // 停止洗球动画标记
                    this.showWashingAnimation = false;
                    
                    // 重置重试计数
                    this.retryCount = 0;
                    
                    // 确保使用最新的结果，触发 Vue 响应式更新
                    if (this.lastResults && this.lastResults.length === 10) {
                        console.log('📊 使用已设定的开奖结果', this.lastResults);
                        // 使用 Vue.set 或数组扩展来确保响应式更新
                        this.$set(this, 'lastResults', [...this.lastResults]);
                        
                        // 强制更新 DOM 确保显示正确
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
        
        // 5. 在 getServerStatus 中添加额外检查
        console.log('5. 在状态更新时添加额外的动画检查...');
        
        // 在 updateFromServerStatus 结尾添加检查
        const statusCheckFix = `
                            
                            // 额外检查：如果状态是 betting 但动画还在播放，强制停止
                            if (serverStatus === 'betting' && this.showWashingAnimation) {
                                console.warn('⚠️ 检测到异常：投注期间仍在播放洗球动画，强制停止');
                                this.stopWashingAnimation();
                            }
                        }`;
        
        // 找到 updateFromServerStatus 函数的结尾并添加检查
        content = content.replace(
            /(updateFromServerStatus[\s\S]*?)\n\s*\}/m,
            '$1' + statusCheckFix
        );
        
        // 写回文件
        fs.writeFileSync(indexPath, content);
        console.log('✅ 已更新 frontend/index.html');
        
        // 部署到 deploy 目录
        const deployPath = path.join(__dirname, 'deploy/frontend/index.html');
        fs.copyFileSync(indexPath, deployPath);
        console.log('✅ 已部署到 deploy/frontend/index.html');
        
        console.log('\n✅ 修复完成！');
        console.log('\n修复内容：');
        console.log('1. 新期开始时强制停止洗球动画');
        console.log('2. 添加 5 秒超时保护，防止动画无限播放');
        console.log('3. 确保获取结果后清除超时计时器');
        console.log('4. 强化动画停止函数，确保 DOM 正确更新');
        console.log('5. 在状态更新时添加额外检查');
        
    } catch (error) {
        console.error('修复失败:', error);
    }
}

// 执行修复
fixQuestionMarkDisplay();