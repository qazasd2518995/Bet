// fix-multiple-bet-settlement.js - 修复多笔下注结算问题
import db from './db/config.js';

// 修复重复的交易记录
async function fixDuplicateTransactions() {
    console.log('🔧 开始修复重复的交易记录...\n');
    
    try {
        // 1. 查找可能的重复交易
        const duplicates = await db.manyOrNone(`
            WITH duplicate_groups AS (
                SELECT 
                    user_id,
                    user_type,
                    transaction_type,
                    description,
                    created_at,
                    COUNT(*) as count,
                    array_agg(id ORDER BY id) as ids,
                    array_agg(amount ORDER BY id) as amounts,
                    array_agg(balance_after ORDER BY id) as balances
                FROM transaction_records
                WHERE transaction_type IN ('win', 'adjustment')
                AND created_at > NOW() - INTERVAL '24 hours'
                GROUP BY user_id, user_type, transaction_type, description, 
                         DATE_TRUNC('second', created_at)
                HAVING COUNT(*) > 1
            )
            SELECT * FROM duplicate_groups
            ORDER BY created_at DESC
        `);
        
        if (duplicates && duplicates.length > 0) {
            console.log(`找到 ${duplicates.length} 组重复交易`);
            
            for (const group of duplicates) {
                console.log(`\n用户ID: ${group.user_id}, 类型: ${group.transaction_type}`);
                console.log(`描述: ${group.description}`);
                console.log(`时间: ${group.created_at}`);
                console.log(`交易ID: ${group.ids.join(', ')}`);
                console.log(`金额: ${group.amounts.join(', ')}`);
                
                // 只保留第一笔，删除其他
                const idsToDelete = group.ids.slice(1);
                if (idsToDelete.length > 0) {
                    console.log(`将删除交易ID: ${idsToDelete.join(', ')}`);
                    
                    // 取消注释以执行删除
                    /*
                    await db.none(`
                        DELETE FROM transaction_records 
                        WHERE id = ANY($1)
                    `, [idsToDelete]);
                    */
                }
            }
        } else {
            console.log('没有找到重复的交易记录');
        }
        
        // 2. 修正用户余额
        console.log('\n🔧 检查并修正用户余额...');
        
        const balanceCheck = await db.manyOrNone(`
            WITH balance_calc AS (
                SELECT 
                    m.id,
                    m.username,
                    m.balance as current_balance,
                    COALESCE(
                        (SELECT balance_after 
                         FROM transaction_records 
                         WHERE user_id = m.id AND user_type = 'member'
                         ORDER BY created_at DESC, id DESC
                         LIMIT 1), 
                        m.balance
                    ) as last_transaction_balance
                FROM members m
                WHERE m.username IN ('justin111')
            )
            SELECT * FROM balance_calc
            WHERE current_balance != last_transaction_balance
        `);
        
        if (balanceCheck && balanceCheck.length > 0) {
            console.log('发现余额不一致的用户：');
            for (const user of balanceCheck) {
                console.log(`\n用户: ${user.username}`);
                console.log(`当前余额: ${user.current_balance}`);
                console.log(`最后交易余额: ${user.last_transaction_balance}`);
                
                // 取消注释以修正余额
                /*
                await db.none(`
                    UPDATE members 
                    SET balance = $1 
                    WHERE id = $2
                `, [user.last_transaction_balance, user.id]);
                console.log('✅ 余额已修正');
                */
            }
        } else {
            console.log('所有用户余额正常');
        }
        
    } catch (error) {
        console.error('❌ 修复过程中发生错误:', error);
    }
}

// 防止未来的重复结算
async function preventFutureDoubleSettlement() {
    console.log('\n🛡️ 加强防重复结算机制...');
    
    try {
        // 创建唯一索引防止重复
        await db.none(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_transaction_unique_win
            ON transaction_records(user_id, user_type, transaction_type, description, DATE_TRUNC('second', created_at))
            WHERE transaction_type = 'win'
        `);
        
        console.log('✅ 已创建防重复交易的唯一索引');
        
    } catch (error) {
        if (error.code === '23505') {
            console.log('⚠️ 唯一索引已存在');
        } else {
            console.error('❌ 创建索引时发生错误:', error);
        }
    }
}

// 主函数
async function main() {
    console.log('🚀 开始修复多笔下注结算问题...\n');
    
    await fixDuplicateTransactions();
    await preventFutureDoubleSettlement();
    
    console.log('\n✅ 修复完成！');
    console.log('\n建议：');
    console.log('1. 检查改进的结算系统是否正确处理多笔下注');
    console.log('2. 确保同步到代理系统时不会重复更新余额');
    console.log('3. 监控 transaction_records 表确保没有重复记录');
}

// 如果直接执行此文件
if (process.argv[1] === new URL(import.meta.url).pathname) {
    main()
        .then(() => {
            process.exit(0);
        })
        .catch(error => {
            console.error('执行失败:', error);
            process.exit(1);
        });
}

export default main;