// fix-period-display.js - 修復期號顯示不一致的問題
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function fixPeriodDisplay() {
    try {
        const indexPath = path.join(__dirname, 'frontend', 'index.html');
        let content = fs.readFileSync(indexPath, 'utf8');
        
        console.log('🔧 開始修復期號顯示問題...');
        
        // 1. 修改 formatPeriodDisplay 函數，添加參數控制顯示格式
        console.log('1. 修改 formatPeriodDisplay 函數...');
        
        const newFormatPeriodDisplay = `formatPeriodDisplay(period, showFullPeriod = false) {
                    if (!period) return '';
                    const periodStr = period.toString();
                    
                    // 如果要顯示完整期號
                    if (showFullPeriod) {
                        return periodStr;
                    }
                    
                    // 提取期號的各部分
                    if (periodStr.length >= 8) {
                        const year = periodStr.substring(0, 4);
                        const month = periodStr.substring(4, 6);
                        const day = periodStr.substring(6, 8);
                        const num = periodStr.substring(8); // 獲取完整的序號部分，不限制位數
                        
                        // 返回格式化的顯示：MM/DD XXX期
                        return \`\${month}/\${day} \${num}期\`;
                    }
                    return periodStr;
                }`;
        
        // 替換原有的 formatPeriodDisplay 函數
        content = content.replace(
            /formatPeriodDisplay\(period\)\s*\{[\s\S]*?\n\s*\}/,
            newFormatPeriodDisplay
        );
        
        // 2. 修復路線圖中的期號顯示（不再使用 slice(-3)）
        console.log('2. 修復路線圖期號顯示...');
        
        // 找到路線圖期號顯示的部分並修改
        content = content.replace(
            /<div class="period-info">\{\{ cell\.period\.toString\(\)\.slice\(-3\) \}\}<\/div>/g,
            '<div class="period-info">{{ cell.period.toString().substring(8) }}</div>'
        );
        
        // 3. 確保歷史開獎中使用一致的格式
        console.log('3. 統一歷史開獎期號格式...');
        
        // 歷史開獎列表中的期號顯示 - 保持 MM/DD XXX期 格式
        // 這部分已經在使用 formatPeriodDisplay，所以會自動更新
        
        // 4. 添加一個輔助函數來提取期號序號
        console.log('4. 添加期號序號提取函數...');
        
        const extractPeriodNumber = `
                // 提取期號的序號部分
                extractPeriodNumber(period) {
                    if (!period) return '';
                    const periodStr = period.toString();
                    if (periodStr.length > 8) {
                        return periodStr.substring(8);
                    }
                    return periodStr;
                },`;
        
        // 在 methods 部分添加新函數
        const methodsMatch = content.match(/methods:\s*\{/);
        if (methodsMatch) {
            const insertPos = methodsMatch.index + methodsMatch[0].length;
            content = content.slice(0, insertPos) + extractPeriodNumber + content.slice(insertPos);
        }
        
        // 5. 修復近期開獎記錄的期號顯示
        console.log('5. 確保近期開獎記錄顯示一致...');
        
        // 近期開獎記錄已經使用 formatPeriodDisplay，會自動更新
        
        // 6. 添加註釋說明期號格式
        const periodFormatComment = `
                // 期號格式說明：
                // - 完整期號：YYYYMMDDXXX (如 202507241372)
                // - 顯示格式：MM/DD XXX期 (如 07/24 1372期)
                // - 序號部分：XXX (通常是3位，但可能超過999達到4位)`;
        
        // 在 formatPeriodDisplay 函數前添加註釋
        content = content.replace(
            /\/\/ 🔥 格式化期號显示/,
            `// 🔥 格式化期號显示${periodFormatComment}`
        );
        
        // 保存修改後的文件
        fs.writeFileSync(indexPath, content, 'utf8');
        console.log('✅ 期號顯示修復完成！');
        
        // 顯示修改摘要
        console.log('\n📋 修改摘要：');
        console.log('1. formatPeriodDisplay 函數現在正確處理超過999的序號');
        console.log('2. 路線圖期號顯示改用 substring(8) 替代 slice(-3)');
        console.log('3. 添加了 extractPeriodNumber 輔助函數');
        console.log('4. 統一了所有位置的期號顯示格式');
        console.log('\n⚠️  請測試以下場景：');
        console.log('- 序號為 001 的期號顯示');
        console.log('- 序號為 999 的期號顯示');
        console.log('- 序號為 1000+ 的期號顯示');
        console.log('- 跨日期時的期號顯示');
        
    } catch (error) {
        console.error('❌ 修復期號顯示時發生錯誤：', error);
    }
}

// 執行修復
fixPeriodDisplay();