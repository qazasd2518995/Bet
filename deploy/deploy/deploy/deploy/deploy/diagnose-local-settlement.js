import db from './db/config.js';
import fs from 'fs';
import path from 'path';

async function diagnoseLocalSettlement() {
    try {
        console.log('=== 診斷本地結算系統 ===\n');
        
        // 1. 檢查使用的結算檔案
        console.log('1. 檢查結算系統檔案：');
        const backendPath = './backend.js';
        const backendContent = fs.readFileSync(backendPath, 'utf8');
        
        // 查找導入的結算系統
        const settlementImports = backendContent.match(/import.*settlement.*from.*/g);
        if (settlementImports) {
            console.log('找到的結算系統導入：');
            settlementImports.forEach(imp => console.log(`  - ${imp}`));
        }
        
        // 查找 settleBets 函數調用
        const settleCalls = backendContent.match(/settleBets|settlement.*\(/g);
        if (settleCalls) {
            console.log('\n結算函數調用：');
            const uniqueCalls = [...new Set(settleCalls)];
            uniqueCalls.forEach(call => console.log(`  - ${call}`));
        }
        
        // 2. 檢查最近的結算記錄
        console.log('\n2. 最近的結算記錄：');
        const recentSettlements = await db.any(`
            SELECT 
                period,
                COUNT(*) as bet_count,
                SUM(CASE WHEN settled = true THEN 1 ELSE 0 END) as settled_count,
                MAX(settled_at) as last_settled_at
            FROM bet_history
            WHERE created_at > NOW() - INTERVAL '2 hours'
            GROUP BY period
            ORDER BY period DESC
            LIMIT 5
        `);
        
        recentSettlements.forEach(s => {
            console.log(`  期號 ${s.period}: ${s.settled_count}/${s.bet_count} 已結算, 最後結算時間: ${s.last_settled_at || '未結算'}`);
        });
        
        // 3. 檢查結算日誌
        console.log('\n3. 結算日誌記錄：');
        const settlementLogs = await db.any(`
            SELECT * FROM settlement_log
            WHERE created_at > NOW() - INTERVAL '1 hour'
            ORDER BY created_at DESC
            LIMIT 5
        `);
        
        if (settlementLogs.length > 0) {
            settlementLogs.forEach(log => {
                console.log(`  [${log.created_at}] 期號 ${log.period}: ${log.status}`);
                if (log.details) console.log(`    詳情: ${log.details}`);
            });
        } else {
            console.log('  ❌ 最近1小時沒有結算日誌');
        }
        
        // 4. 檢查退水邏輯是否被觸發
        console.log('\n4. 檢查退水處理：');
        
        // 查看 enhanced-settlement-system.js 的內容
        const enhancedPath = './enhanced-settlement-system.js';
        if (fs.existsSync(enhancedPath)) {
            const enhancedContent = fs.readFileSync(enhancedPath, 'utf8');
            const hasProcessRebates = enhancedContent.includes('processRebates');
            const hasRebateCall = enhancedContent.includes('processRebates(');
            console.log(`  enhanced-settlement-system.js:`);
            console.log(`    - 包含 processRebates 函數: ${hasProcessRebates ? '✅' : '❌'}`);
            console.log(`    - 調用 processRebates: ${hasRebateCall ? '✅' : '❌'}`);
        }
        
        // 5. 檢查最近的退水記錄
        console.log('\n5. 最近的退水記錄：');
        const recentRebates = await db.any(`
            SELECT 
                tr.period,
                COUNT(*) as count,
                SUM(tr.amount) as total,
                MIN(tr.created_at) as first_time,
                MAX(tr.created_at) as last_time
            FROM transaction_records tr
            WHERE tr.transaction_type = 'rebate'
            AND tr.created_at > NOW() - INTERVAL '2 hours'
            GROUP BY tr.period
            ORDER BY tr.period DESC
            LIMIT 5
        `);
        
        if (recentRebates.length > 0) {
            recentRebates.forEach(r => {
                console.log(`  期號 ${r.period}: ${r.count}筆, 總額 ${r.total}元`);
            });
        } else {
            console.log('  ❌ 最近2小時沒有退水記錄');
        }
        
        // 6. 檢查 backend.js 中的開獎流程
        console.log('\n6. 分析開獎流程：');
        const drawPattern = /drawWinningNumbers.*\{[\s\S]*?\}/;
        const drawMatch = backendContent.match(drawPattern);
        if (drawMatch) {
            const hasSettleCall = drawMatch[0].includes('settleBets') || drawMatch[0].includes('settlement');
            console.log(`  drawWinningNumbers 函數中有結算調用: ${hasSettleCall ? '✅' : '❌'}`);
        }
        
        // 7. 建議
        console.log('\n=== 診斷結果 ===');
        console.log('可能的問題：');
        console.log('1. 結算系統可能沒有在開獎後自動調用');
        console.log('2. 退水邏輯可能沒有在結算時被觸發');
        console.log('3. 本地服務可能沒有正確運行');
        
    } catch (error) {
        console.error('診斷錯誤:', error);
    } finally {
        process.exit(0);
    }
}

diagnoseLocalSettlement();