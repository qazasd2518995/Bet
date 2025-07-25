// analyze-settlement-issue.js
import db from './db/config.js';

async function analyzeSettlementIssue() {
    console.log('🔍 分析結算問題...\n');
    
    try {
        // 1. 查看最近的交易記錄
        console.log('📊 最近的交易記錄：');
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
            console.log(`找到 ${recentTransactions.length} 筆交易：`);
            recentTransactions.forEach(tx => {
                console.log(`  ${tx.created_at.toLocaleString()}: ${tx.transaction_type} ${tx.amount}, ${tx.balance_before} → ${tx.balance_after}, ${tx.description}`);
            });
        }
        
        // 2. 查看可能的重複交易
        console.log('\n📊 可能的重複交易：');
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
            console.log(`找到 ${duplicates.length} 組可能的重複交易：`);
            duplicates.forEach(dup => {
                console.log(`\n  時間: ${dup.minute_bucket}`);
                console.log(`  類型: ${dup.transaction_type}, 金額: ${dup.amount}`);
                console.log(`  描述: ${dup.description}`);
                console.log(`  交易ID: ${dup.ids}`);
                console.log(`  餘額: ${dup.balances}`);
                console.log(`  數量: ${dup.count}`);
            });
        } else {
            console.log('沒有發現重複交易');
        }
        
        // 3. 分析問題
        console.log('\n💡 問題分析：');
        
        // 檢查 adjustment 類型的交易
        const adjustments = recentTransactions.filter(tx => tx.transaction_type === 'adjustment');
        if (adjustments.length > 0) {
            console.log(`\n發現 ${adjustments.length} 筆 adjustment 交易：`);
            adjustments.forEach(adj => {
                console.log(`  ID: ${adj.id}, 金額: ${adj.amount}, 時間: ${adj.created_at.toLocaleString()}`);
            });
            console.log('\n⚠️ adjustment 交易可能是問題來源！');
        }
        
        // 檢查短時間內的多筆交易
        const shortTimeTransactions = [];
        for (let i = 0; i < recentTransactions.length - 1; i++) {
            const timeDiff = Math.abs(recentTransactions[i].created_at - recentTransactions[i+1].created_at) / 1000; // 秒
            if (timeDiff < 5) { // 5秒內
                shortTimeTransactions.push({
                    tx1: recentTransactions[i],
                    tx2: recentTransactions[i+1],
                    timeDiff
                });
            }
        }
        
        if (shortTimeTransactions.length > 0) {
            console.log(`\n發現 ${shortTimeTransactions.length} 組短時間內的交易：`);
            shortTimeTransactions.forEach(pair => {
                console.log(`\n  間隔: ${pair.timeDiff} 秒`);
                console.log(`  交易1: ${pair.tx1.transaction_type} ${pair.tx1.amount}`);
                console.log(`  交易2: ${pair.tx2.transaction_type} ${pair.tx2.amount}`);
            });
        }
        
    } catch (error) {
        console.error('❌ 分析過程中發生錯誤:', error);
    }
}

// 執行
analyzeSettlementIssue()
    .then(() => {
        console.log('\n分析完成');
        process.exit(0);
    })
    .catch(error => {
        console.error('執行失敗:', error);
        process.exit(1);
    });