// fix-duplicate-settlement-v3.js - 修复重复结算问题
import db from './db/config.js';

async function fixDuplicateSettlement() {
    console.log('🔧 开始修复重复结算问题...\n');
    
    try {
        // 1. 检查并移除重复的 adjustment 交易
        console.log('1️⃣ 查找重复的会员点数设置交易...');
        
        const duplicateAdjustments = await db.any(`
            WITH duplicate_adjustments AS (
                SELECT 
                    tr.id,
                    tr.user_id,
                    tr.amount,
                    tr.balance_before,
                    tr.balance_after,
                    tr.created_at,
                    m.username,
                    ROW_NUMBER() OVER (
                        PARTITION BY tr.user_id, tr.amount, DATE_TRUNC('minute', tr.created_at)
                        ORDER BY tr.id
                    ) as rn
                FROM transaction_records tr
                JOIN members m ON tr.user_id = m.id AND tr.user_type = 'member'
                WHERE tr.transaction_type = 'adjustment'
                AND tr.amount = 989
                AND tr.description = '会员点数设置'
                AND tr.created_at >= NOW() - INTERVAL '24 hours'
            )
            SELECT * FROM duplicate_adjustments
            WHERE rn > 1
            ORDER BY created_at DESC
        `);
        
        if (duplicateAdjustments.length > 0) {
            console.log(`发现 ${duplicateAdjustments.length} 笔重复的 adjustment 交易`);
            
            // 计算需要调整的总金额
            const adjustmentsByUser = {};
            duplicateAdjustments.forEach(adj => {
                if (!adjustmentsByUser[adj.username]) {
                    adjustmentsByUser[adj.username] = {
                        count: 0,
                        totalAmount: 0,
                        transactions: []
                    };
                }
                adjustmentsByUser[adj.username].count++;
                adjustmentsByUser[adj.username].totalAmount += parseFloat(adj.amount);
                adjustmentsByUser[adj.username].transactions.push(adj.id);
            });
            
            // 修正每个用户的余额
            for (const [username, data] of Object.entries(adjustmentsByUser)) {
                console.log(`\n修正用户 ${username}:`);
                console.log(`  重复交易数: ${data.count}`);
                console.log(`  需要扣除: ${data.totalAmount}`);
                
                // 获取当前余额
                const member = await db.one(`
                    SELECT id, balance FROM members WHERE username = $1
                `, [username]);
                
                const currentBalance = parseFloat(member.balance);
                const newBalance = currentBalance - data.totalAmount;
                
                console.log(`  当前余额: ${currentBalance}`);
                console.log(`  修正后余额: ${newBalance}`);
                
                // 更新余额
                await db.none(`
                    UPDATE members 
                    SET balance = $1, updated_at = NOW()
                    WHERE username = $2
                `, [newBalance, username]);
                
                // 记录修正交易
                await db.none(`
                    INSERT INTO transaction_records 
                    (user_type, user_id, transaction_type, amount, balance_before, balance_after, description, created_at)
                    VALUES ('member', $1, 'adjustment', $2, $3, $4, '修正重复结算', NOW())
                `, [member.id, -data.totalAmount, currentBalance, newBalance]);
                
                // 标记重复的交易（可选）
                await db.none(`
                    UPDATE transaction_records 
                    SET description = description || ' (重复-已修正)'
                    WHERE id = ANY($1)
                `, [data.transactions]);
                
                console.log(`✅ 用户 ${username} 余额已修正`);
            }
        } else {
            console.log('✅ 没有发现重复的 adjustment 交易');
        }
        
        // 2. 检查是否有缺少 win 类型交易的中奖记录
        console.log('\n2️⃣ 检查缺少正常中奖交易的记录...');
        
        const missingWinTransactions = await db.any(`
            SELECT 
                bh.id,
                bh.period,
                bh.username,
                bh.bet_type,
                bh.bet_value,
                bh.amount,
                bh.win_amount,
                m.id as member_id
            FROM bet_history bh
            JOIN members m ON bh.username = m.username
            WHERE bh.win = true
            AND bh.settled = true
            AND bh.created_at >= NOW() - INTERVAL '24 hours'
            AND NOT EXISTS (
                SELECT 1 FROM transaction_records tr
                WHERE tr.user_id = m.id
                AND tr.user_type = 'member'
                AND tr.transaction_type = 'win'
                AND tr.amount = bh.win_amount
                AND tr.created_at >= bh.created_at
                AND tr.created_at <= bh.created_at + INTERVAL '5 minutes'
            )
            ORDER BY bh.created_at DESC
        `);
        
        if (missingWinTransactions.length > 0) {
            console.log(`发现 ${missingWinTransactions.length} 笔缺少 win 交易的中奖记录`);
            console.log('这些记录可能是通过 adjustment 而不是正常的 win 交易处理的');
        }
        
        // 3. 提供修复建议
        console.log('\n📋 修复建议：');
        console.log('1. 修改 backend.js，移除旧的结算逻辑（legacySettleBets）');
        console.log('2. 确保 settleBets 函数只调用 improvedSettleBets');
        console.log('3. 移除结算后同步余额到代理系统的代码（sync-member-balance）');
        console.log('4. 让 improved-settlement-system.js 统一处理所有结算逻辑');
        console.log('\n具体修改：');
        console.log('- 删除 backend.js 第 2920-2939 行的余额更新和同步代码');
        console.log('- 确保结算只在 improved-settlement-system.js 中进行');
        console.log('- 代理系统不应该再接收结算相关的余额同步请求');
        
    } catch (error) {
        console.error('修复过程中发生错误:', error);
    } finally {
        await db.$pool.end();
    }
}

// 执行修复
fixDuplicateSettlement();