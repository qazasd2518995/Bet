// analyze-settlement-issue.js
import db from './db/config.js';

async function analyzeSettlementIssue() {
    console.log('🔍 分析结算问题...\n');
    
    try {
        // 1. 查看最近的交易记录
        console.log('📊 最近的交易记录：');
        const recentTransactions = await db.manyOrNone(`
            SELECT 
                tr.id,
                tr.transaction_type,
                tr.amount,
                tr.balance_before,
                tr.balance_after,
                tr.description,
                tr.created_at
            FROM transaction_records tr
            JOIN members m ON tr.user_id = m.id AND tr.user_type = 'member'
            WHERE m.username = 'justin111'
            AND tr.created_at > NOW() - INTERVAL '2 hours'
            ORDER BY tr.created_at DESC
            LIMIT 30
        `);
        
        if (recentTransactions.length > 0) {
            console.log(`找到 ${recentTransactions.length} 笔交易：`);
            recentTransactions.forEach(tx => {
                console.log(`  ${tx.created_at.toLocaleString()}: ${tx.transaction_type} ${tx.amount}, ${tx.balance_before} → ${tx.balance_after}, ${tx.description}`);
            });
        }
        
        // 2. 查看可能的重复交易
        console.log('\n📊 可能的重复交易：');
        const duplicates = await db.manyOrNone(`
            WITH potential_duplicates AS (
                SELECT 
                    tr.user_id,
                    tr.transaction_type,
                    tr.amount,
                    tr.description,
                    DATE_TRUNC('minute', tr.created_at) as minute_bucket,
                    COUNT(*) as count,
                    STRING_AGG(tr.id::text, ', ' ORDER BY tr.id) as ids,
                    STRING_AGG(tr.balance_after::text, ', ' ORDER BY tr.id) as balances
                FROM transaction_records tr
                JOIN members m ON tr.user_id = m.id AND tr.user_type = 'member'
                WHERE m.username = 'justin111'
                AND tr.transaction_type IN ('win', 'adjustment')
                AND tr.created_at > NOW() - INTERVAL '2 hours'
                GROUP BY tr.user_id, tr.transaction_type, tr.amount, tr.description, DATE_TRUNC('minute', tr.created_at)
                HAVING COUNT(*) > 1
            )
            SELECT * FROM potential_duplicates
            ORDER BY minute_bucket DESC
        `);
        
        if (duplicates.length > 0) {
            console.log(`找到 ${duplicates.length} 组可能的重复交易：`);
            duplicates.forEach(dup => {
                console.log(`\n  时间: ${dup.minute_bucket}`);
                console.log(`  类型: ${dup.transaction_type}, 金额: ${dup.amount}`);
                console.log(`  描述: ${dup.description}`);
                console.log(`  交易ID: ${dup.ids}`);
                console.log(`  余额: ${dup.balances}`);
                console.log(`  数量: ${dup.count}`);
            });
        } else {
            console.log('没有发现重复交易');
        }
        
        // 3. 分析问题
        console.log('\n💡 问题分析：');
        
        // 检查 adjustment 类型的交易
        const adjustments = recentTransactions.filter(tx => tx.transaction_type === 'adjustment');
        if (adjustments.length > 0) {
            console.log(`\n发现 ${adjustments.length} 笔 adjustment 交易：`);
            adjustments.forEach(adj => {
                console.log(`  ID: ${adj.id}, 金额: ${adj.amount}, 时间: ${adj.created_at.toLocaleString()}`);
            });
            console.log('\n⚠️ adjustment 交易可能是问题来源！');
        }
        
        // 检查短时间内的多笔交易
        const shortTimeTransactions = [];
        for (let i = 0; i < recentTransactions.length - 1; i++) {
            const timeDiff = Math.abs(recentTransactions[i].created_at - recentTransactions[i+1].created_at) / 1000; // 秒
            if (timeDiff < 5) { // 5秒内
                shortTimeTransactions.push({
                    tx1: recentTransactions[i],
                    tx2: recentTransactions[i+1],
                    timeDiff
                });
            }
        }
        
        if (shortTimeTransactions.length > 0) {
            console.log(`\n发现 ${shortTimeTransactions.length} 组短时间内的交易：`);
            shortTimeTransactions.forEach(pair => {
                console.log(`\n  间隔: ${pair.timeDiff} 秒`);
                console.log(`  交易1: ${pair.tx1.transaction_type} ${pair.tx1.amount}`);
                console.log(`  交易2: ${pair.tx2.transaction_type} ${pair.tx2.amount}`);
            });
        }
        
    } catch (error) {
        console.error('❌ 分析过程中发生错误:', error);
    }
}

// 执行
analyzeSettlementIssue()
    .then(() => {
        console.log('\n分析完成');
        process.exit(0);
    })
    .catch(error => {
        console.error('执行失败:', error);
        process.exit(1);
    });