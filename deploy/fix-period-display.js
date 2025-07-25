// fix-period-display.js - 修复期号显示不一致的问题
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
        
        console.log('🔧 开始修复期号显示问题...');
        
        // 1. 修改 formatPeriodDisplay 函数，添加参数控制显示格式
        console.log('1. 修改 formatPeriodDisplay 函数...');
        
        const newFormatPeriodDisplay = `formatPeriodDisplay(period, showFullPeriod = false) {
                    if (!period) return '';
                    const periodStr = period.toString();
                    
                    // 如果要显示完整期号
                    if (showFullPeriod) {
                        return periodStr;
                    }
                    
                    // 提取期号的各部分
                    if (periodStr.length >= 8) {
                        const year = periodStr.substring(0, 4);
                        const month = periodStr.substring(4, 6);
                        const day = periodStr.substring(6, 8);
                        const num = periodStr.substring(8); // 获取完整的序号部分，不限制位数
                        
                        // 返回格式化的显示：MM/DD XXX期
                        return \`\${month}/\${day} \${num}期\`;
                    }
                    return periodStr;
                }`;
        
        // 替换原有的 formatPeriodDisplay 函数
        content = content.replace(
            /formatPeriodDisplay\(period\)\s*\{[\s\S]*?\n\s*\}/,
            newFormatPeriodDisplay
        );
        
        // 2. 修复路线图中的期号显示（不再使用 slice(-3)）
        console.log('2. 修复路线图期号显示...');
        
        // 找到路线图期号显示的部分并修改
        content = content.replace(
            /<div class="period-info">\{\{ cell\.period\.toString\(\)\.slice\(-3\) \}\}<\/div>/g,
            '<div class="period-info">{{ cell.period.toString().substring(8) }}</div>'
        );
        
        // 3. 确保历史开奖中使用一致的格式
        console.log('3. 统一历史开奖期号格式...');
        
        // 历史开奖列表中的期号显示 - 保持 MM/DD XXX期 格式
        // 这部分已经在使用 formatPeriodDisplay，所以会自动更新
        
        // 4. 添加一个辅助函数来提取期号序号
        console.log('4. 添加期号序号提取函数...');
        
        const extractPeriodNumber = `
                // 提取期号的序号部分
                extractPeriodNumber(period) {
                    if (!period) return '';
                    const periodStr = period.toString();
                    if (periodStr.length > 8) {
                        return periodStr.substring(8);
                    }
                    return periodStr;
                },`;
        
        // 在 methods 部分添加新函数
        const methodsMatch = content.match(/methods:\s*\{/);
        if (methodsMatch) {
            const insertPos = methodsMatch.index + methodsMatch[0].length;
            content = content.slice(0, insertPos) + extractPeriodNumber + content.slice(insertPos);
        }
        
        // 5. 修复近期开奖记录的期号显示
        console.log('5. 确保近期开奖记录显示一致...');
        
        // 近期开奖记录已经使用 formatPeriodDisplay，会自动更新
        
        // 6. 添加注释说明期号格式
        const periodFormatComment = `
                // 期号格式说明：
                // - 完整期号：YYYYMMDDXXX (如 202507241372)
                // - 显示格式：MM/DD XXX期 (如 07/24 1372期)
                // - 序号部分：XXX (通常是3位，但可能超过999达到4位)`;
        
        // 在 formatPeriodDisplay 函数前添加注释
        content = content.replace(
            /\/\/ 🔥 格式化期号显示/,
            `// 🔥 格式化期号显示${periodFormatComment}`
        );
        
        // 保存修改后的文件
        fs.writeFileSync(indexPath, content, 'utf8');
        console.log('✅ 期号显示修复完成！');
        
        // 显示修改摘要
        console.log('\n📋 修改摘要：');
        console.log('1. formatPeriodDisplay 函数现在正确处理超过999的序号');
        console.log('2. 路线图期号显示改用 substring(8) 替代 slice(-3)');
        console.log('3. 添加了 extractPeriodNumber 辅助函数');
        console.log('4. 统一了所有位置的期号显示格式');
        console.log('\n⚠️  请测试以下场景：');
        console.log('- 序号为 001 的期号显示');
        console.log('- 序号为 999 的期号显示');
        console.log('- 序号为 1000+ 的期号显示');
        console.log('- 跨日期时的期号显示');
        
    } catch (error) {
        console.error('❌ 修复期号显示时发生错误：', error);
    }
}

// 执行修复
fixPeriodDisplay();