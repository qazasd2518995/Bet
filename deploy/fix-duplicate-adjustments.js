// fix-duplicate-adjustments.js - 修复重复的 adjustment 交易
import db from './db/config.js';

async function fixDuplicateAdjustments() {
    console.log('🔧 修复重复的 adjustment 交易...\n');
    
    try {
        // 1. 找出重复的 adjustment 交易
        const duplicates = await db.manyOrNone(`
            WITH duplicate_adjustments AS (
                SELECT 
                    tr.user_id,
                    tr.amount,
                    tr.description,
                    DATE_TRUNC('minute', tr.created_at) as minute_bucket,
                    COUNT(*) as count,
                    array_agg(tr.id ORDER BY tr.id) as ids,
                    array_agg(tr.created_at ORDER BY tr.id) as times,
                    array_agg(tr.balance_after ORDER BY tr.id) as balances,
                    m.username
                FROM transaction_records tr
                JOIN members m ON tr.user_id = m.id AND tr.user_type = 'member'
                WHERE tr.transaction_type = 'adjustment'
                AND tr.description = '会员点数设置'
                AND tr.amount > 0
                AND tr.created_at > NOW() - INTERVAL '24 hours'
                GROUP BY tr.user_id, tr.amount, tr.description, DATE_TRUNC('minute', tr.created_at), m.username
                HAVING COUNT(*) > 1
            )
            SELECT * FROM duplicate_adjustments
            ORDER BY minute_bucket DESC
        `);
        
        if (duplicates.length === 0) {
            console.log('没有找到重复的 adjustment 交易');
            return;
        }
        
        console.log(`找到 ${duplicates.length} 组重复的 adjustment 交易：\n`);
        
        let totalAmountToFix = 0;
        const fixCommands = [];
        
        for (const group of duplicates) {
            console.log(`用户: ${group.username}`);
            console.log(`时间: ${new Date(group.minute_bucket).toLocaleString()}`);
            console.log(`金额: ${group.amount}`);
            console.log(`重复次数: ${group.count}`);
            console.log(`交易ID: ${group.ids.join(', ')}`);
            
            // 计算需要修正的金额（保留第一笔，删除其他）
            const duplicateCount = group.count - 1;
            const amountToDeduct = parseFloat(group.amount) * duplicateCount;
            totalAmountToFix += amountToDeduct;
            
            console.log(`需要扣除: ${amountToDeduct} 元\n`);
            
            // 准备修复命令
            fixCommands.push({
                username: group.username,
                userId: group.user_id,
                amountToDeduct: amountToDeduct,
                idsToDelete: group.ids.slice(1), // 保留第一笔，删除其他
                currentBalance: parseFloat(group.balances[group.balances.length - 1])
            });
        }
        
        console.log(`\n总计需要修复金额: ${totalAmountToFix} 元`);
        
        // 2. 执行修复
        console.log('\n执行修复...');
        
        for (const fix of fixCommands) {
            console.log(`\n修复用户 ${fix.username}...`);
            
            await db.tx(async t => {
                // 删除重复的交易记录
                if (fix.idsToDelete.length > 0) {
                    await t.none(`
                        DELETE FROM transaction_records 
                        WHERE id = ANY($1)
                    `, [fix.idsToDelete]);
                    console.log(`  ✅ 已删除 ${fix.idsToDelete.length} 笔重复交易`);
                }
                
                // 修正用户余额
                const newBalance = fix.currentBalance - fix.amountToDeduct;
                await t.none(`
                    UPDATE members 
                    SET balance = $1,
                        updated_at = NOW()
                    WHERE id = $2
                `, [newBalance, fix.userId]);
                console.log(`  ✅ 余额已从 ${fix.currentBalance} 修正为 ${newBalance}`);
                
                // 记录修正交易
                await t.none(`
                    INSERT INTO transaction_records 
                    (user_type, user_id, transaction_type, amount, balance_before, balance_after, description, created_at)
                    VALUES ('member', $1, 'adjustment', $2, $3, $4, $5, NOW())
                `, [fix.userId, -fix.amountToDeduct, fix.currentBalance, newBalance, '修正重复结算']);
                console.log(`  ✅ 已记录修正交易`);
            });
        }
        
        console.log('\n✅ 修复完成！');
        
        // 3. 显示修复 SQL（手动执行）
        console.log('\n或者，您可以手动执行以下 SQL：\n');
        for (const fix of fixCommands) {
            console.log(`-- 修复用户 ${fix.username}`);
            if (fix.idsToDelete.length > 0) {
                console.log(`DELETE FROM transaction_records WHERE id IN (${fix.idsToDelete.join(', ')});`);
            }
            console.log(`UPDATE members SET balance = ${fix.currentBalance - fix.amountToDeduct} WHERE id = ${fix.userId};`);
            console.log(`INSERT INTO transaction_records (user_type, user_id, transaction_type, amount, balance_before, balance_after, description) VALUES ('member', ${fix.userId}, 'adjustment', ${-fix.amountToDeduct}, ${fix.currentBalance}, ${fix.currentBalance - fix.amountToDeduct}, '修正重复结算');`);
            console.log('');
        }
        
    } catch (error) {
        console.error('❌ 修复过程中发生错误:', error);
    }
}

// 执行
fixDuplicateAdjustments()
    .then(() => {
        console.log('\n分析完成');
        process.exit(0);
    })
    .catch(error => {
        console.error('执行失败:', error);
        process.exit(1);
    });