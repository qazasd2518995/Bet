import db from './db/config.js';
import fs from 'fs';
import path from 'path';

async function diagnoseLocalSettlement() {
    try {
        console.log('=== 诊断本地结算系统 ===\n');
        
        // 1. 检查使用的结算档案
        console.log('1. 检查结算系统档案：');
        const backendPath = './backend.js';
        const backendContent = fs.readFileSync(backendPath, 'utf8');
        
        // 查找导入的结算系统
        const settlementImports = backendContent.match(/import.*settlement.*from.*/g);
        if (settlementImports) {
            console.log('找到的结算系统导入：');
            settlementImports.forEach(imp => console.log(`  - ${imp}`));
        }
        
        // 查找 settleBets 函数调用
        const settleCalls = backendContent.match(/settleBets|settlement.*\(/g);
        if (settleCalls) {
            console.log('\n结算函数调用：');
            const uniqueCalls = [...new Set(settleCalls)];
            uniqueCalls.forEach(call => console.log(`  - ${call}`));
        }
        
        // 2. 检查最近的结算记录
        console.log('\n2. 最近的结算记录：');
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
            console.log(`  期号 ${s.period}: ${s.settled_count}/${s.bet_count} 已结算, 最后结算时间: ${s.last_settled_at || '未结算'}`);
        });
        
        // 3. 检查结算日志
        console.log('\n3. 结算日志记录：');
        const settlementLogs = await db.any(`
            SELECT * FROM settlement_log
            WHERE created_at > NOW() - INTERVAL '1 hour'
            ORDER BY created_at DESC
            LIMIT 5
        `);
        
        if (settlementLogs.length > 0) {
            settlementLogs.forEach(log => {
                console.log(`  [${log.created_at}] 期号 ${log.period}: ${log.status}`);
                if (log.details) console.log(`    详情: ${log.details}`);
            });
        } else {
            console.log('  ❌ 最近1小时没有结算日志');
        }
        
        // 4. 检查退水逻辑是否被触发
        console.log('\n4. 检查退水处理：');
        
        // 查看 enhanced-settlement-system.js 的内容
        const enhancedPath = './enhanced-settlement-system.js';
        if (fs.existsSync(enhancedPath)) {
            const enhancedContent = fs.readFileSync(enhancedPath, 'utf8');
            const hasProcessRebates = enhancedContent.includes('processRebates');
            const hasRebateCall = enhancedContent.includes('processRebates(');
            console.log(`  enhanced-settlement-system.js:`);
            console.log(`    - 包含 processRebates 函数: ${hasProcessRebates ? '✅' : '❌'}`);
            console.log(`    - 调用 processRebates: ${hasRebateCall ? '✅' : '❌'}`);
        }
        
        // 5. 检查最近的退水记录
        console.log('\n5. 最近的退水记录：');
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
                console.log(`  期号 ${r.period}: ${r.count}笔, 总额 ${r.total}元`);
            });
        } else {
            console.log('  ❌ 最近2小时没有退水记录');
        }
        
        // 6. 检查 backend.js 中的开奖流程
        console.log('\n6. 分析开奖流程：');
        const drawPattern = /drawWinningNumbers.*\{[\s\S]*?\}/;
        const drawMatch = backendContent.match(drawPattern);
        if (drawMatch) {
            const hasSettleCall = drawMatch[0].includes('settleBets') || drawMatch[0].includes('settlement');
            console.log(`  drawWinningNumbers 函数中有结算调用: ${hasSettleCall ? '✅' : '❌'}`);
        }
        
        // 7. 建议
        console.log('\n=== 诊断结果 ===');
        console.log('可能的问题：');
        console.log('1. 结算系统可能没有在开奖后自动调用');
        console.log('2. 退水逻辑可能没有在结算时被触发');
        console.log('3. 本地服务可能没有正确运行');
        
    } catch (error) {
        console.error('诊断错误:', error);
    } finally {
        process.exit(0);
    }
}

diagnoseLocalSettlement();