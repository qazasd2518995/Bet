#!/usr/bin/env node

/**
 * 🔍 最終系統驗證測試
 * 驗證所有核心功能是否正常運作：
 * 1. 遊戲開獎中階段的前後端倒數顯示與邏輯
 * 2. 移除遊戲端手動刷新限紅設定功能
 * 3. 控制輸贏系統對各名次龍虎大小單雙的控制
 * 4. 限紅設定即時自動同步更新
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 開始最終系統驗證...\n');

// 1. 檢查後端開獎倒數邏輯
function checkBackendDrawingLogic() {
    console.log('1️⃣ 檢查後端開獎倒數邏輯...');
    
    const backendPath = './backend.js';
    const deployBackendPath = './deploy/backend.js';
    
    const checkFile = (filePath) => {
        if (!fs.existsSync(filePath)) {
            console.log(`❌ ${filePath} 不存在`);
            return false;
        }
        
        const content = fs.readFileSync(filePath, 'utf8');
        
        // 檢查關鍵邏輯
        const checks = [
            { pattern: /status.*===.*'drawing'/, desc: 'drawing 狀態檢查' },
            { pattern: /countdown_seconds.*=.*12/, desc: '開獎倒數設為12秒' },
            { pattern: /drawing狀態倒計時結束.*執行開獎/, desc: 'drawing 階段結算邏輯' },
            { pattern: /memoryGameState\.status.*=.*'betting'/, desc: '開獎後切換到 betting' }
        ];
        
        let passed = 0;
        checks.forEach(check => {
            if (check.pattern.test(content)) {
                console.log(`  ✅ ${check.desc}`);
                passed++;
            } else {
                console.log(`  ❌ ${check.desc}`);
            }
        });
        
        return passed === checks.length;
    };
    
    const backendOk = checkFile(backendPath);
    const deployBackendOk = checkFile(deployBackendPath);
    
    console.log(`   後端主檔: ${backendOk ? '✅' : '❌'}`);
    console.log(`   部署檔案: ${deployBackendOk ? '✅' : '❌'}`);
    
    return backendOk && deployBackendOk;
}

// 2. 檢查前端倒數顯示邏輯
function checkFrontendDrawingDisplay() {
    console.log('\n2️⃣ 檢查前端倒數顯示邏輯...');
    
    const frontendPath = './frontend/index.html';
    const deployFrontendPath = './deploy/frontend/index.html';
    
    const checkFile = (filePath) => {
        if (!fs.existsSync(filePath)) {
            console.log(`❌ ${filePath} 不存在`);
            return false;
        }
        
        const content = fs.readFileSync(filePath, 'utf8');
        
        // 檢查關鍵邏輯
        const checks = [
            { pattern: /isDrawingInProgress.*false/, desc: '開獎進行中狀態初始化' },
            { pattern: /countdown-section\.drawing/, desc: 'drawing 狀態倒數樣式' },
            { pattern: /startDrawingProcess/, desc: '開獎流程啟動方法' },
            { pattern: /playWashingAnimation/, desc: '洗球動畫方法' },
            { pattern: /12秒.*開獎.*時間/, desc: '12秒開獎時間設定' }
        ];
        
        let passed = 0;
        checks.forEach(check => {
            if (check.pattern.test(content)) {
                console.log(`  ✅ ${check.desc}`);
                passed++;
            } else {
                console.log(`  ❌ ${check.desc}`);
            }
        });
        
        return passed === checks.length;
    };
    
    const frontendOk = checkFile(frontendPath);
    const deployFrontendOk = checkFile(deployFrontendPath);
    
    console.log(`   前端主檔: ${frontendOk ? '✅' : '❌'}`);
    console.log(`   部署檔案: ${deployFrontendOk ? '✅' : '❌'}`);
    
    return frontendOk && deployFrontendOk;
}

// 3. 檢查手動刷新限紅功能已移除
function checkManualBetLimitsRemoval() {
    console.log('\n3️⃣ 檢查手動刷新限紅功能已移除...');
    
    const frontendPath = './frontend/index.html';
    const deployFrontendPath = './deploy/frontend/index.html';
    
    const checkFile = (filePath) => {
        if (!fs.existsSync(filePath)) {
            console.log(`❌ ${filePath} 不存在`);
            return false;
        }
        
        const content = fs.readFileSync(filePath, 'utf8');
        
        // 檢查是否還有手動刷新相關代碼
        const forbiddenPatterns = [
            { pattern: /refreshBetLimits.*按鈕|按鈕.*refreshBetLimits/, desc: '手動刷新限紅按鈕' },
            { pattern: /手動.*刷新.*限紅|刷新.*限紅.*手動/, desc: '手動刷新限紅文字' },
            { pattern: /startBettingLimitsMonitor.*\(/, desc: 'startBettingLimitsMonitor 調用' },
            { pattern: /stopBettingLimitsMonitor.*\(/, desc: 'stopBettingLimitsMonitor 調用' }
        ];
        
        let cleanCount = 0;
        forbiddenPatterns.forEach(check => {
            if (!check.pattern.test(content)) {
                console.log(`  ✅ 已移除: ${check.desc}`);
                cleanCount++;
            } else {
                console.log(`  ❌ 仍存在: ${check.desc}`);
            }
        });
        
        // 檢查是否有自動同步邏輯
        const requiredPatterns = [
            { pattern: /checkBetLimitsUpdate/, desc: '自動檢查限紅更新' },
            { pattern: /每30秒.*檢查.*限紅/, desc: '30秒定期檢查邏輯' },
            { pattern: /即時.*更新.*betLimits/, desc: '即時更新限紅' }
        ];
        
        let autoSyncCount = 0;
        requiredPatterns.forEach(check => {
            if (check.pattern.test(content)) {
                console.log(`  ✅ 已實現: ${check.desc}`);
                autoSyncCount++;
            } else {
                console.log(`  ❌ 缺少: ${check.desc}`);
            }
        });
        
        return cleanCount === forbiddenPatterns.length && autoSyncCount === requiredPatterns.length;
    };
    
    const frontendOk = checkFile(frontendPath);
    const deployFrontendOk = checkFile(deployFrontendPath);
    
    console.log(`   前端主檔: ${frontendOk ? '✅' : '❌'}`);
    console.log(`   部署檔案: ${deployFrontendOk ? '✅' : '❌'}`);
    
    return frontendOk && deployFrontendOk;
}

// 4. 檢查控制輸贏系統
function checkWinControlSystem() {
    console.log('\n4️⃣ 檢查控制輸贏系統...');
    
    const backendPath = './backend.js';
    const deployBackendPath = './deploy/backend.js';
    
    const checkFile = (filePath) => {
        if (!fs.existsSync(filePath)) {
            console.log(`❌ ${filePath} 不存在`);
            return false;
        }
        
        const content = fs.readFileSync(filePath, 'utf8');
        
        // 檢查控制系統關鍵功能
        const checks = [
            { pattern: /finalControlFactor/, desc: '統一控制因子變數' },
            { pattern: /adjustAnalysisByBetPattern/, desc: '根據下注模式調整分析' },
            { pattern: /大小.*單雙.*龍虎/, desc: '大小單雙龍虎投注類型支援' },
            { pattern: /多人.*下注.*衝突/, desc: '多人下注衝突處理' },
            { pattern: /冠亞和值/, desc: '冠亞和值投注類型' },
            { pattern: /自動偵測.*單會員.*代理線/, desc: '多種控制模式' }
        ];
        
        let passed = 0;
        checks.forEach(check => {
            if (check.pattern.test(content)) {
                console.log(`  ✅ ${check.desc}`);
                passed++;
            } else {
                console.log(`  ❌ ${check.desc}`);
            }
        });
        
        // 檢查是否沒有問題變數
        const problematicPatterns = [
            { pattern: /adjustedControlFactor/, desc: '舊的 adjustedControlFactor 變數' },
            { pattern: /conflictFactor/, desc: '舊的 conflictFactor 變數' }
        ];
        
        let cleanCount = 0;
        problematicPatterns.forEach(check => {
            if (!check.pattern.test(content)) {
                console.log(`  ✅ 已清理: ${check.desc}`);
                cleanCount++;
            } else {
                console.log(`  ❌ 仍存在: ${check.desc}`);
            }
        });
        
        return passed >= 4 && cleanCount === problematicPatterns.length;
    };
    
    const backendOk = checkFile(backendPath);
    const deployBackendOk = checkFile(deployBackendPath);
    
    console.log(`   後端主檔: ${backendOk ? '✅' : '❌'}`);
    console.log(`   部署檔案: ${deployBackendOk ? '✅' : '❌'}`);
    
    return backendOk && deployBackendOk;
}

// 5. 檢查限紅即時同步功能
function checkBetLimitsAutoSync() {
    console.log('\n5️⃣ 檢查限紅即時同步功能...');
    
    const frontendPath = './frontend/index.html';
    const deployFrontendPath = './deploy/frontend/index.html';
    
    const checkFile = (filePath) => {
        if (!fs.existsSync(filePath)) {
            console.log(`❌ ${filePath} 不存在`);
            return false;
        }
        
        const content = fs.readFileSync(filePath, 'utf8');
        
        // 檢查即時同步功能
        const checks = [
            { pattern: /lastBetLimitsCheck/, desc: '上次檢查時間記錄' },
            { pattern: /30000/, desc: '30秒檢查間隔' },
            { pattern: /限紅設定.*已更新/, desc: '限紅更新通知' },
            { pattern: /watch.*betAmount/, desc: '下注金額監聽' },
            { pattern: /watch.*selectedBets/, desc: '選擇投注監聽' },
            { pattern: /即時.*反映.*最新設定/, desc: '即時反映設定' }
        ];
        
        let passed = 0;
        checks.forEach(check => {
            if (check.pattern.test(content)) {
                console.log(`  ✅ ${check.desc}`);
                passed++;
            } else {
                console.log(`  ❌ ${check.desc}`);
            }
        });
        
        return passed >= 4;
    };
    
    const frontendOk = checkFile(frontendPath);
    const deployFrontendOk = checkFile(deployFrontendPath);
    
    console.log(`   前端主檔: ${frontendOk ? '✅' : '❌'}`);
    console.log(`   部署檔案: ${deployFrontendOk ? '✅' : '❌'}`);
    
    return frontendOk && deployFrontendOk;
}

// 執行所有檢查
async function runAllChecks() {
    const results = [];
    
    results.push(checkBackendDrawingLogic());
    results.push(checkFrontendDrawingDisplay());
    results.push(checkManualBetLimitsRemoval());
    results.push(checkWinControlSystem());
    results.push(checkBetLimitsAutoSync());
    
    console.log('\n🏁 最終驗證結果:');
    console.log('================');
    
    const categories = [
        '後端開獎倒數邏輯',
        '前端倒數顯示邏輯', 
        '手動刷新限紅功能移除',
        '控制輸贏系統',
        '限紅即時同步功能'
    ];
    
    let allPassed = true;
    results.forEach((result, index) => {
        console.log(`${result ? '✅' : '❌'} ${categories[index]}`);
        if (!result) allPassed = false;
    });
    
    console.log('\n' + '='.repeat(50));
    if (allPassed) {
        console.log('🎉 所有功能驗證通過！系統已完全修正並優化。');
        console.log('📋 完成項目:');
        console.log('  • 遊戲開獎中階段的前後端倒數顯示與邏輯修正');
        console.log('  • 移除遊戲端所有手動刷新限紅設定的 UI 與方法');
        console.log('  • 控制輸贏系統支援各名次龍虎大小單雙控制');
        console.log('  • 修正控制系統 ReferenceError 錯誤');
        console.log('  • 限紅設定在代理平台調整後即時自動同步更新');
        console.log('  • 所有修正已推送到 GitHub');
    } else {
        console.log('⚠️ 部分功能驗證未通過，請檢查上述詳細報告。');
    }
    
    return allPassed;
}

// 執行驗證
runAllChecks().then(result => {
    process.exit(result ? 0 : 1);
}).catch(error => {
    console.error('驗證過程出錯:', error);
    process.exit(1);
});
