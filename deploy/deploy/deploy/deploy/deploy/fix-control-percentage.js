// 修復控制百分比權重計算的腳本

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 需要修改的文件
const filesToFix = [
    './backend.js',
    './deploy/backend.js'
];

// 新的權重計算函數
const newWeightCalculation = `
      // 🎯 計算統一的控制係數，包含衝突處理
      const baseControlFactor = parseFloat(control.control_percentage) / 100; // 基礎控制係數 (0-1)
      const conflictMultiplier = Math.min(1.0 + (userCount - 1) * 0.2, 2.0); // 衝突倍數：每多1人增加20%，最高200%
      const finalControlFactor = Math.min(baseControlFactor * conflictMultiplier, 1.0); // 最終控制係數，不超過100%
      
      console.log(\`📋 處理合併下注: \${betKey}, 類型=\${bet.bet_type}, 值=\${bet.bet_value}, 位置=\${bet.position}\`);
      console.log(\`💰 總金額=\${totalAmount}, 用戶數=\${userCount}, 基礎控制=\${(baseControlFactor*100).toFixed(1)}%, 衝突倍數=\${conflictMultiplier.toFixed(2)}, 最終控制=\${(finalControlFactor*100).toFixed(1)}%\`);
      
      if (bet.bet_type === 'number') {
        const position = parseInt(bet.position) - 1;
        const value = parseInt(bet.bet_value) - 1;
        if (position >= 0 && position < 10 && value >= 0 && value < 10) {
          if (control.win_control) {
            // 贏控制：確保目標下注更容易中獎
            // 改進的權重計算公式，讓控制效果更明顯
            if (finalControlFactor >= 0.95) {
              weights.positions[position][value] = 10000; // 95%以上控制時使用極高權重
            } else if (finalControlFactor <= 0.05) {
              weights.positions[position][value] = 1; // 5%以下控制時不調整權重
            } else {
              // 使用指數函數增強控制效果
              // 新公式：W = e^(k * controlFactor) 其中 k 是放大係數
              const k = 6; // 放大係數，讓控制效果更明顯
              const exponentialFactor = Math.exp(k * finalControlFactor);
              
              // 計算該位置的目標號碼數量
              const samePositionBets = Object.keys(betConflicts).filter(key => 
                key.startsWith(\`number_\${bet.position}_\`)
              ).length;
              
              const targetCount = samePositionBets;
              const nonTargetCount = 10 - targetCount;
              
              // 結合指數放大和原有的權重公式
              const baseWeight = (finalControlFactor * nonTargetCount) / ((1 - finalControlFactor) * Math.max(targetCount, 1));
              const targetWeight = baseWeight * exponentialFactor / 10; // 除以10避免權重過大
              
              weights.positions[position][value] = Math.max(targetWeight, 0.1);
              
              console.log(\`📊 [贏控制] 位置\${position+1}: \${targetCount}個目標號碼, \${nonTargetCount}個非目標號碼`);
              console.log(\`    基礎權重=\${baseWeight.toFixed(3)}, 指數因子=\${exponentialFactor.toFixed(2)}, 最終權重=\${targetWeight.toFixed(3)}\`);
            }
            
            console.log(\`✅ 增加位置\${position+1}號碼\${value+1}的權重 (贏控制), 最終權重=\${weights.positions[position][value].toFixed(3)}, 用戶數=\${userCount}\`);
          } else if (control.loss_control) {
            // 輸控制：確保目標下注更難中獎
            if (finalControlFactor >= 0.95) {
              weights.positions[position][value] = 0.0001; // 95%以上控制時使用極低權重
            } else if (finalControlFactor <= 0.05) {
              weights.positions[position][value] = 1; // 5%以下控制時不調整權重
            } else {
              // 使用負指數函數增強輸控制效果
              const k = 6; // 放大係數
              const exponentialFactor = Math.exp(-k * finalControlFactor);
              
              const samePositionBets = Object.keys(betConflicts).filter(key => 
                key.startsWith(\`number_\${bet.position}_\`)
              ).length;
              
              const targetCount = samePositionBets;
              const nonTargetCount = 10 - targetCount;
              const winProbability = 1 - finalControlFactor; // 會員實際中獎機率
              
              // 計算輸控制權重
              const baseWeight = (winProbability * nonTargetCount) / ((1 - winProbability) * Math.max(targetCount, 1));
              const targetWeight = baseWeight * exponentialFactor;
              
              weights.positions[position][value] = Math.max(targetWeight, 0.0001);
              
              console.log(\`📊 [輸控制] 位置\${position+1}: \${targetCount}個目標號碼, 中獎機率=\${(winProbability*100).toFixed(1)}%\`);
              console.log(\`    基礎權重=\${baseWeight.toFixed(3)}, 指數因子=\${exponentialFactor.toFixed(2)}, 最終權重=\${targetWeight.toFixed(3)}\`);
            }
            
            console.log(\`❌ 設置位置\${position+1}號碼\${value+1}的權重 (輸控制), 最終權重=\${weights.positions[position][value].toFixed(3)}, 用戶數=\${userCount}\`);
          }
        }
      } else if (bet.bet_type === 'sumValue') {
        if (!isNaN(parseInt(bet.bet_value))) {
          const sumIndex = parseInt(bet.bet_value) - 3;
          if (sumIndex >= 0 && sumIndex < 17) {
            if (control.win_control) {
              // 贏控制：增加該和值的權重（使用指數函數）
              if (finalControlFactor >= 0.95) {
                weights.sumValue[sumIndex] = 10000; // 極高控制時使用極高權重
              } else if (finalControlFactor <= 0.05) {
                weights.sumValue[sumIndex] = 1; // 極低控制時不調整
              } else {
                const k = 5; // 和值的放大係數
                const exponentialFactor = Math.exp(k * finalControlFactor);
                weights.sumValue[sumIndex] *= exponentialFactor;
              }
              console.log(\`✅ 增加和值\${bet.bet_value}的權重 (贏控制), 最終權重=\${weights.sumValue[sumIndex].toFixed(3)}, 用戶數=\${userCount}\`);
            } else if (control.loss_control) {
              // 輸控制：減少該和值的權重（使用負指數函數）
              if (finalControlFactor >= 0.95) {
                weights.sumValue[sumIndex] = 0.0001; // 極高控制時使用極低權重
              } else if (finalControlFactor <= 0.05) {
                weights.sumValue[sumIndex] = 1; // 極低控制時不調整
              } else {
                const k = 5; // 和值的放大係數
                const exponentialFactor = Math.exp(-k * finalControlFactor);
                weights.sumValue[sumIndex] *= exponentialFactor;
              }
              console.log(\`❌ 減少和值\${bet.bet_value}的權重 (輸控制), 最終權重=\${weights.sumValue[sumIndex].toFixed(3)}, 用戶數=\${userCount}\`);
            }
          }
        }
      }`;

// 查找並替換權重計算邏輯
function fixWeightCalculation() {
    console.log('🔧 開始修復控制百分比權重計算...\n');
    
    filesToFix.forEach(filePath => {
        const fullPath = path.join(__dirname, filePath);
        
        try {
            console.log(`📄 處理文件: ${filePath}`);
            
            // 讀取文件內容
            let content = fs.readFileSync(fullPath, 'utf8');
            
            // 查找需要替換的部分
            const startMarker = '// 🎯 計算統一的控制係數，包含衝突處理';
            const endMarker = '} else if (control.loss_control) {';
            
            // 使用更精確的正則表達式來匹配整個權重計算部分
            const regex = /\/\/ 🎯 計算統一的控制係數[\s\S]*?(?=\s*}\s*}\s*}\s*}\);)/;
            
            if (content.includes(startMarker)) {
                // 備份原文件
                const backupPath = fullPath + '.backup.' + Date.now();
                fs.writeFileSync(backupPath, content);
                console.log(`  ✅ 已創建備份: ${path.basename(backupPath)}`);
                
                // 替換內容
                content = content.replace(regex, newWeightCalculation.trim());
                
                // 寫入修改後的內容
                fs.writeFileSync(fullPath, content);
                console.log(`  ✅ 已更新權重計算邏輯`);
                console.log(`  📊 改進內容：`);
                console.log(`     - 使用指數函數增強控制效果`);
                console.log(`     - 95%以上控制使用更高權重(10000)`);
                console.log(`     - 輸控制使用更低權重(0.0001)`);
                console.log(`     - 添加詳細的調試日誌`);
            } else {
                console.log(`  ⚠️  未找到權重計算標記，可能文件已被修改`);
            }
            
            console.log('');
            
        } catch (error) {
            console.error(`  ❌ 處理文件失敗: ${error.message}`);
        }
    });
    
    console.log('✨ 修復完成！');
    console.log('\n📌 重要提醒：');
    console.log('1. 請重啟遊戲後端服務以應用更改');
    console.log('2. 新的權重計算使用指數函數，控制效果會更明顯');
    console.log('3. 建議測試不同百分比的控制效果');
}

// 執行修復
fixWeightCalculation();