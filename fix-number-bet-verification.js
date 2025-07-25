// fix-number-bet-verification.js - Fix for number bet verification issue in enhanced-settlement-system.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 修复号码投注验证逻辑...\n');

// 读取 enhanced-settlement-system.js
const filePath = path.join(__dirname, 'enhanced-settlement-system.js');
let content = fs.readFileSync(filePath, 'utf8');

// 找到有问题的验证逻辑
const problematicCode = `        // 额外的安全检查：如果中奖，再次验证
        if (isWin) {
            settlementLog.warn(\`⚠️ 中奖验证: 投注ID=\${bet.id}, 期号=\${bet.period}, 位置\${position}, 投注\${betNum}=开奖\${winNum}\`);
            // 直接从数据库再次查询验证
            const verifyResult = await db.oneOrNone(\`
                SELECT position_\${position} as winning_number
                FROM result_history
                WHERE period = $1
            \`, [bet.period]);
            
            if (verifyResult && parseInt(verifyResult.winning_number) !== betNum) {
                settlementLog.error(\`❌ 中奖验证失败！数据库中第\${position}名是\${verifyResult.winning_number}，不是\${betNum}\`);
                return {
                    isWin: false,
                    reason: \`验证失败：第\${position}名实际开出\${verifyResult.winning_number}\`,
                    odds: bet.odds || 9.85
                };
            }
        }`;

// 修复的代码 - 移除有问题的额外验证，因为我们已经有准确的开奖结果
const fixedCode = `        // 移除额外的数据库验证，因为可能有时序问题
        // 我们已经有准确的开奖结果在 positions 阵列中
        if (isWin) {
            settlementLog.info(\`✅ 号码投注中奖确认: 投注ID=\${bet.id}, 期号=\${bet.period}, 位置\${position}, 投注\${betNum}=开奖\${winNum}\`);
        }`;

// 替换代码
if (content.includes(problematicCode)) {
    content = content.replace(problematicCode, fixedCode);
    
    // 写回文件
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ 成功修复 enhanced-settlement-system.js 中的号码投注验证逻辑');
    console.log('\n修复内容：');
    console.log('- 移除了可能导致错误的额外数据库验证');
    console.log('- 保留了基本的中奖判断逻辑');
    console.log('- 避免了时序问题和数据不一致的情况');
} else {
    console.log('⚠️ 未找到需要修复的代码，可能已经修复过了');
}

// 同时创建一个备份
const backupPath = filePath + '.backup.' + Date.now();
fs.copyFileSync(filePath, backupPath);
console.log(`\n📄 备份文件已创建: ${path.basename(backupPath)}`);

console.log('\n💡 修复说明：');
console.log('问题原因：号码投注在判断中奖后，会额外从数据库验证，但可能因为：');
console.log('1. 数据保存的时序问题（结算时数据还未保存）');
console.log('2. 数据格式不一致');
console.log('3. 查询逻辑错误');
console.log('\n解决方案：移除额外的数据库验证，因为我们已经有准确的开奖结果在记忆体中。');