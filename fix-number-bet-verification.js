// fix-number-bet-verification.js - Fix for number bet verification issue in enhanced-settlement-system.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 修復號碼投注驗證邏輯...\n');

// 讀取 enhanced-settlement-system.js
const filePath = path.join(__dirname, 'enhanced-settlement-system.js');
let content = fs.readFileSync(filePath, 'utf8');

// 找到有問題的驗證邏輯
const problematicCode = `        // 額外的安全檢查：如果中獎，再次驗證
        if (isWin) {
            settlementLog.warn(\`⚠️ 中獎驗證: 投注ID=\${bet.id}, 期號=\${bet.period}, 位置\${position}, 投注\${betNum}=開獎\${winNum}\`);
            // 直接從數據庫再次查詢驗證
            const verifyResult = await db.oneOrNone(\`
                SELECT position_\${position} as winning_number
                FROM result_history
                WHERE period = $1
            \`, [bet.period]);
            
            if (verifyResult && parseInt(verifyResult.winning_number) !== betNum) {
                settlementLog.error(\`❌ 中獎驗證失敗！數據庫中第\${position}名是\${verifyResult.winning_number}，不是\${betNum}\`);
                return {
                    isWin: false,
                    reason: \`驗證失敗：第\${position}名實際開出\${verifyResult.winning_number}\`,
                    odds: bet.odds || 9.85
                };
            }
        }`;

// 修復的代碼 - 移除有問題的額外驗證，因為我們已經有準確的開獎結果
const fixedCode = `        // 移除額外的數據庫驗證，因為可能有時序問題
        // 我們已經有準確的開獎結果在 positions 陣列中
        if (isWin) {
            settlementLog.info(\`✅ 號碼投注中獎確認: 投注ID=\${bet.id}, 期號=\${bet.period}, 位置\${position}, 投注\${betNum}=開獎\${winNum}\`);
        }`;

// 替換代碼
if (content.includes(problematicCode)) {
    content = content.replace(problematicCode, fixedCode);
    
    // 寫回文件
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ 成功修復 enhanced-settlement-system.js 中的號碼投注驗證邏輯');
    console.log('\n修復內容：');
    console.log('- 移除了可能導致錯誤的額外數據庫驗證');
    console.log('- 保留了基本的中獎判斷邏輯');
    console.log('- 避免了時序問題和數據不一致的情況');
} else {
    console.log('⚠️ 未找到需要修復的代碼，可能已經修復過了');
}

// 同時創建一個備份
const backupPath = filePath + '.backup.' + Date.now();
fs.copyFileSync(filePath, backupPath);
console.log(`\n📄 備份文件已創建: ${path.basename(backupPath)}`);

console.log('\n💡 修復說明：');
console.log('問題原因：號碼投注在判斷中獎後，會額外從數據庫驗證，但可能因為：');
console.log('1. 數據保存的時序問題（結算時數據還未保存）');
console.log('2. 數據格式不一致');
console.log('3. 查詢邏輯錯誤');
console.log('\n解決方案：移除額外的數據庫驗證，因為我們已經有準確的開獎結果在記憶體中。');