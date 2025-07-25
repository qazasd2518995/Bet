// 修复控制百分比权重计算的脚本

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

// 新的权重计算函数
const newWeightCalculation = `
      // 🎯 计算统一的控制系数，包含冲突处理
      const baseControlFactor = parseFloat(control.control_percentage) / 100; // 基础控制系数 (0-1)
      const conflictMultiplier = Math.min(1.0 + (userCount - 1) * 0.2, 2.0); // 冲突倍数：每多1人增加20%，最高200%
      const finalControlFactor = Math.min(baseControlFactor * conflictMultiplier, 1.0); // 最终控制系数，不超过100%
      
      console.log(\`📋 处理合并下注: \${betKey}, 类型=\${bet.bet_type}, 值=\${bet.bet_value}, 位置=\${bet.position}\`);
      console.log(\`💰 总金额=\${totalAmount}, 用户数=\${userCount}, 基础控制=\${(baseControlFactor*100).toFixed(1)}%, 冲突倍数=\${conflictMultiplier.toFixed(2)}, 最终控制=\${(finalControlFactor*100).toFixed(1)}%\`);
      
      if (bet.bet_type === 'number') {
        const position = parseInt(bet.position) - 1;
        const value = parseInt(bet.bet_value) - 1;
        if (position >= 0 && position < 10 && value >= 0 && value < 10) {
          if (control.win_control) {
            // 赢控制：确保目标下注更容易中奖
            // 改进的权重计算公式，让控制效果更明显
            if (finalControlFactor >= 0.95) {
              weights.positions[position][value] = 10000; // 95%以上控制时使用极高权重
            } else if (finalControlFactor <= 0.05) {
              weights.positions[position][value] = 1; // 5%以下控制时不调整权重
            } else {
              // 使用指数函数增强控制效果
              // 新公式：W = e^(k * controlFactor) 其中 k 是放大系数
              const k = 6; // 放大系数，让控制效果更明显
              const exponentialFactor = Math.exp(k * finalControlFactor);
              
              // 计算该位置的目标号码数量
              const samePositionBets = Object.keys(betConflicts).filter(key => 
                key.startsWith(\`number_\${bet.position}_\`)
              ).length;
              
              const targetCount = samePositionBets;
              const nonTargetCount = 10 - targetCount;
              
              // 结合指数放大和原有的权重公式
              const baseWeight = (finalControlFactor * nonTargetCount) / ((1 - finalControlFactor) * Math.max(targetCount, 1));
              const targetWeight = baseWeight * exponentialFactor / 10; // 除以10避免权重过大
              
              weights.positions[position][value] = Math.max(targetWeight, 0.1);
              
              console.log(\`📊 [赢控制] 位置\${position+1}: \${targetCount}个目标号码, \${nonTargetCount}个非目标号码`);
              console.log(\`    基础权重=\${baseWeight.toFixed(3)}, 指数因子=\${exponentialFactor.toFixed(2)}, 最终权重=\${targetWeight.toFixed(3)}\`);
            }
            
            console.log(\`✅ 增加位置\${position+1}号码\${value+1}的权重 (赢控制), 最终权重=\${weights.positions[position][value].toFixed(3)}, 用户数=\${userCount}\`);
          } else if (control.loss_control) {
            // 输控制：确保目标下注更难中奖
            if (finalControlFactor >= 0.95) {
              weights.positions[position][value] = 0.0001; // 95%以上控制时使用极低权重
            } else if (finalControlFactor <= 0.05) {
              weights.positions[position][value] = 1; // 5%以下控制时不调整权重
            } else {
              // 使用负指数函数增强输控制效果
              const k = 6; // 放大系数
              const exponentialFactor = Math.exp(-k * finalControlFactor);
              
              const samePositionBets = Object.keys(betConflicts).filter(key => 
                key.startsWith(\`number_\${bet.position}_\`)
              ).length;
              
              const targetCount = samePositionBets;
              const nonTargetCount = 10 - targetCount;
              const winProbability = 1 - finalControlFactor; // 会员实际中奖机率
              
              // 计算输控制权重
              const baseWeight = (winProbability * nonTargetCount) / ((1 - winProbability) * Math.max(targetCount, 1));
              const targetWeight = baseWeight * exponentialFactor;
              
              weights.positions[position][value] = Math.max(targetWeight, 0.0001);
              
              console.log(\`📊 [输控制] 位置\${position+1}: \${targetCount}个目标号码, 中奖机率=\${(winProbability*100).toFixed(1)}%\`);
              console.log(\`    基础权重=\${baseWeight.toFixed(3)}, 指数因子=\${exponentialFactor.toFixed(2)}, 最终权重=\${targetWeight.toFixed(3)}\`);
            }
            
            console.log(\`❌ 设置位置\${position+1}号码\${value+1}的权重 (输控制), 最终权重=\${weights.positions[position][value].toFixed(3)}, 用户数=\${userCount}\`);
          }
        }
      } else if (bet.bet_type === 'sumValue') {
        if (!isNaN(parseInt(bet.bet_value))) {
          const sumIndex = parseInt(bet.bet_value) - 3;
          if (sumIndex >= 0 && sumIndex < 17) {
            if (control.win_control) {
              // 赢控制：增加该和值的权重（使用指数函数）
              if (finalControlFactor >= 0.95) {
                weights.sumValue[sumIndex] = 10000; // 极高控制时使用极高权重
              } else if (finalControlFactor <= 0.05) {
                weights.sumValue[sumIndex] = 1; // 极低控制时不调整
              } else {
                const k = 5; // 和值的放大系数
                const exponentialFactor = Math.exp(k * finalControlFactor);
                weights.sumValue[sumIndex] *= exponentialFactor;
              }
              console.log(\`✅ 增加和值\${bet.bet_value}的权重 (赢控制), 最终权重=\${weights.sumValue[sumIndex].toFixed(3)}, 用户数=\${userCount}\`);
            } else if (control.loss_control) {
              // 输控制：减少该和值的权重（使用负指数函数）
              if (finalControlFactor >= 0.95) {
                weights.sumValue[sumIndex] = 0.0001; // 极高控制时使用极低权重
              } else if (finalControlFactor <= 0.05) {
                weights.sumValue[sumIndex] = 1; // 极低控制时不调整
              } else {
                const k = 5; // 和值的放大系数
                const exponentialFactor = Math.exp(-k * finalControlFactor);
                weights.sumValue[sumIndex] *= exponentialFactor;
              }
              console.log(\`❌ 减少和值\${bet.bet_value}的权重 (输控制), 最终权重=\${weights.sumValue[sumIndex].toFixed(3)}, 用户数=\${userCount}\`);
            }
          }
        }
      }`;

// 查找并替换权重计算逻辑
function fixWeightCalculation() {
    console.log('🔧 开始修复控制百分比权重计算...\n');
    
    filesToFix.forEach(filePath => {
        const fullPath = path.join(__dirname, filePath);
        
        try {
            console.log(`📄 处理文件: ${filePath}`);
            
            // 读取文件内容
            let content = fs.readFileSync(fullPath, 'utf8');
            
            // 查找需要替换的部分
            const startMarker = '// 🎯 计算统一的控制系数，包含冲突处理';
            const endMarker = '} else if (control.loss_control) {';
            
            // 使用更精确的正则表达式来匹配整个权重计算部分
            const regex = /\/\/ 🎯 计算统一的控制系数[\s\S]*?(?=\s*}\s*}\s*}\s*}\);)/;
            
            if (content.includes(startMarker)) {
                // 备份原文件
                const backupPath = fullPath + '.backup.' + Date.now();
                fs.writeFileSync(backupPath, content);
                console.log(`  ✅ 已创建备份: ${path.basename(backupPath)}`);
                
                // 替换内容
                content = content.replace(regex, newWeightCalculation.trim());
                
                // 写入修改后的内容
                fs.writeFileSync(fullPath, content);
                console.log(`  ✅ 已更新权重计算逻辑`);
                console.log(`  📊 改进内容：`);
                console.log(`     - 使用指数函数增强控制效果`);
                console.log(`     - 95%以上控制使用更高权重(10000)`);
                console.log(`     - 输控制使用更低权重(0.0001)`);
                console.log(`     - 添加详细的调试日志`);
            } else {
                console.log(`  ⚠️  未找到权重计算标记，可能文件已被修改`);
            }
            
            console.log('');
            
        } catch (error) {
            console.error(`  ❌ 处理文件失败: ${error.message}`);
        }
    });
    
    console.log('✨ 修复完成！');
    console.log('\n📌 重要提醒：');
    console.log('1. 请重启游戏后端服务以应用更改');
    console.log('2. 新的权重计算使用指数函数，控制效果会更明显');
    console.log('3. 建议测试不同百分比的控制效果');
}

// 执行修复
fixWeightCalculation();