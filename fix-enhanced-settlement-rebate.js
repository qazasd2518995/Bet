import fs from 'fs';

// 读取原始档案
const filePath = './enhanced-settlement-system.js';
let content = fs.readFileSync(filePath, 'utf8');

// 找到 enhancedSettlement 函数中检查未结算投注的部分
const searchPattern = `if (!unsettledBets || unsettledBets.length === 0) {
                settlementLog.info('没有未结算的投注');
                return { success: true, settledCount: 0, winCount: 0, totalWinAmount: 0 };
            }`;

const replacement = `if (!unsettledBets || unsettledBets.length === 0) {
                settlementLog.info('没有未结算的投注');
                
                // 即使没有未结算投注，也要检查是否需要处理退水
                try {
                    const hasSettledBets = await t.oneOrNone(\`
                        SELECT COUNT(*) as count 
                        FROM bet_history 
                        WHERE period = $1 AND settled = true
                    \`, [period]);
                    
                    if (hasSettledBets && parseInt(hasSettledBets.count) > 0) {
                        const hasRebates = await t.oneOrNone(\`
                            SELECT COUNT(*) as count 
                            FROM transaction_records
                            WHERE period = $1 AND transaction_type = 'rebate'
                        \`, [period]);
                        
                        if (!hasRebates || parseInt(hasRebates.count) === 0) {
                            settlementLog.info(\`发现已结算但未处理退水的注单，开始处理退水\`);
                            await processRebates(period);
                            settlementLog.info(\`退水处理完成: 期号 \${period}\`);
                        } else {
                            settlementLog.info(\`期号 \${period} 的退水已经处理过 (\${hasRebates.count} 笔记录)\`);
                        }
                    }
                } catch (rebateError) {
                    settlementLog.error(\`退水处理失败: 期号 \${period}\`, rebateError);
                    // Don't fail the entire settlement if rebate processing fails
                }
                
                return { success: true, settledCount: 0, winCount: 0, totalWinAmount: 0 };
            }`;

// 执行替换
if (content.includes(searchPattern)) {
    content = content.replace(searchPattern, replacement);
    
    // 写回档案
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ 成功修复 enhanced-settlement-system.js');
    console.log('   - 现在即使没有未结算投注，也会检查并处理退水');
} else {
    console.log('❌ 找不到要替换的程式码，可能档案已经被修改过');
    
    // 尝试找到相似的模式
    if (content.includes('没有未结算的投注')) {
        console.log('   但找到了相似的程式码，请手动检查并修改');
    }
}

// 另外，确保 processRebates 被正确导入
if (!content.includes("import { processRebates }") && !content.includes("processRebates from")) {
    console.log('\n⚠️ 注意：processRebates 函数需要在同一档案中定义或正确导入');
}