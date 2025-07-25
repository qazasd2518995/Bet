import fs from 'fs';

// 讀取原始檔案
const filePath = './enhanced-settlement-system.js';
let content = fs.readFileSync(filePath, 'utf8');

// 找到 enhancedSettlement 函數中檢查未結算投注的部分
const searchPattern = `if (!unsettledBets || unsettledBets.length === 0) {
                settlementLog.info('沒有未結算的投注');
                return { success: true, settledCount: 0, winCount: 0, totalWinAmount: 0 };
            }`;

const replacement = `if (!unsettledBets || unsettledBets.length === 0) {
                settlementLog.info('沒有未結算的投注');
                
                // 即使沒有未結算投注，也要檢查是否需要處理退水
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
                            settlementLog.info(\`發現已結算但未處理退水的注單，開始處理退水\`);
                            await processRebates(period);
                            settlementLog.info(\`退水處理完成: 期號 \${period}\`);
                        } else {
                            settlementLog.info(\`期號 \${period} 的退水已經處理過 (\${hasRebates.count} 筆記錄)\`);
                        }
                    }
                } catch (rebateError) {
                    settlementLog.error(\`退水處理失敗: 期號 \${period}\`, rebateError);
                    // Don't fail the entire settlement if rebate processing fails
                }
                
                return { success: true, settledCount: 0, winCount: 0, totalWinAmount: 0 };
            }`;

// 執行替換
if (content.includes(searchPattern)) {
    content = content.replace(searchPattern, replacement);
    
    // 寫回檔案
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ 成功修復 enhanced-settlement-system.js');
    console.log('   - 現在即使沒有未結算投注，也會檢查並處理退水');
} else {
    console.log('❌ 找不到要替換的程式碼，可能檔案已經被修改過');
    
    // 嘗試找到相似的模式
    if (content.includes('沒有未結算的投注')) {
        console.log('   但找到了相似的程式碼，請手動檢查並修改');
    }
}

// 另外，確保 processRebates 被正確導入
if (!content.includes("import { processRebates }") && !content.includes("processRebates from")) {
    console.log('\n⚠️ 注意：processRebates 函數需要在同一檔案中定義或正確導入');
}