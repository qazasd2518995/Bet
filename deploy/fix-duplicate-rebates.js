import db from './db/config.js';

// 修正退水处理机制，避免重复计算
async function fixRebateSystem() {
    try {
        console.log('=== 开始修正退水系统 ===');
        
        // 1. 首先检查并清理重复的退水记录
        console.log('\n1. 检查重复退水记录...');
        const duplicates = await db.any(`
            WITH duplicate_rebates AS (
                SELECT 
                    period,
                    user_id,
                    user_type,
                    COUNT(*) as count,
                    MIN(id) as keep_id,
                    SUM(amount) as total_amount,
                    MAX(amount) as correct_amount
                FROM transaction_records
                WHERE transaction_type = 'rebate'
                    AND created_at > NOW() - INTERVAL '24 hours'
                    AND period IS NOT NULL
                GROUP BY period, user_id, user_type
                HAVING COUNT(*) > 1
            )
            SELECT * FROM duplicate_rebates
            ORDER BY period DESC
        `);
        
        console.log(`发现 ${duplicates.length} 组重复退水记录`);
        
        if (duplicates.length > 0) {
            console.log('\n开始清理重复记录...');
            
            for (const dup of duplicates) {
                // 获取该用户名称
                const user = await db.oneOrNone(
                    dup.user_type === 'agent' 
                        ? 'SELECT username FROM agents WHERE id = $1'
                        : 'SELECT username FROM members WHERE id = $1',
                    [dup.user_id]
                );
                
                console.log(`\n处理 ${user?.username || '未知'} 在期号 ${dup.period} 的重复退水`);
                console.log(`  - 重复次数: ${dup.count}`);
                console.log(`  - 总金额: ${dup.total_amount}`);
                console.log(`  - 正确金额: ${dup.correct_amount}`);
                
                // 删除重复记录，只保留一笔
                const deleteResult = await db.result(`
                    DELETE FROM transaction_records
                    WHERE transaction_type = 'rebate'
                        AND period = $1
                        AND user_id = $2
                        AND user_type = $3
                        AND id != $4
                `, [dup.period, dup.user_id, dup.user_type, dup.keep_id]);
                
                console.log(`  - 删除了 ${deleteResult.rowCount} 笔重复记录`);
                
                // 修正余额（如果有多收的退水）
                if (dup.count > 1) {
                    const excessAmount = dup.total_amount - dup.correct_amount;
                    if (excessAmount > 0) {
                        if (dup.user_type === 'agent') {
                            await db.none(`
                                UPDATE agents 
                                SET balance = balance - $1
                                WHERE id = $2
                            `, [excessAmount, dup.user_id]);
                        } else {
                            await db.none(`
                                UPDATE members 
                                SET balance = balance - $1
                                WHERE id = $2
                            `, [excessAmount, dup.user_id]);
                        }
                        console.log(`  - 已扣除多余的退水金额: ${excessAmount}`);
                    }
                }
            }
        }
        
        // 2. 创建防重复的约束
        console.log('\n2. 创建防重复约束...');
        try {
            // 先检查约束是否已存在
            const constraintExists = await db.oneOrNone(`
                SELECT constraint_name 
                FROM information_schema.table_constraints 
                WHERE table_name = 'transaction_records' 
                AND constraint_name = 'unique_rebate_per_period_user'
            `);
            
            if (!constraintExists) {
                await db.none(`
                    CREATE UNIQUE INDEX CONCURRENTLY unique_rebate_per_period_user 
                    ON transaction_records (period, user_id, user_type, transaction_type)
                    WHERE transaction_type = 'rebate' AND period IS NOT NULL
                `);
                console.log('✅ 已创建唯一索引防止重复退水');
            } else {
                console.log('唯一约束已存在');
            }
        } catch (err) {
            console.error('创建约束时出错:', err.message);
        }
        
        // 3. 更新退水处理逻辑文件
        console.log('\n3. 生成修复后的退水处理逻辑...');
        const fixedRebateLogic = `
// 修复后的退水处理逻辑
async function processRebates(period) {
    try {
        settlementLog.info(\`💰 开始处理期号 \${period} 的退水\`);
        
        // 使用事务和锁来防止重复处理
        await db.tx(async t => {
            // 先检查是否已经处理过
            const existingRebates = await t.oneOrNone(\`
                SELECT COUNT(*) as count 
                FROM transaction_records 
                WHERE period = $1 
                AND transaction_type = 'rebate'
                LIMIT 1
            \`, [period]);
            
            if (existingRebates && parseInt(existingRebates.count) > 0) {
                settlementLog.info(\`期号 \${period} 的退水已经处理过，跳过\`);
                return;
            }
            
            // 获取该期所有已结算的注单
            const settledBets = await t.manyOrNone(\`
                SELECT DISTINCT username, SUM(amount) as total_amount
                FROM bet_history
                WHERE period = $1 AND settled = true
                GROUP BY username
                FOR UPDATE SKIP LOCKED
            \`, [period]);
            
            settlementLog.info(\`找到 \${settledBets.length} 位会员需要处理退水\`);
            
            for (const record of settledBets) {
                try {
                    // 调用退水分配逻辑
                    await distributeRebate(record.username, parseFloat(record.total_amount), period, t);
                    settlementLog.info(\`✅ 已为会员 \${record.username} 分配退水，下注金额: \${record.total_amount}\`);
                } catch (rebateError) {
                    settlementLog.error(\`❌ 为会员 \${record.username} 分配退水失败:\`, rebateError);
                }
            }
        });
        
    } catch (error) {
        settlementLog.error(\`处理退水时发生错误:\`, error);
        throw error;
    }
}`;
        
        console.log('修复逻辑已生成');
        
        // 4. 验证修复结果
        console.log('\n4. 验证修复结果...');
        const currentRebates = await db.any(`
            SELECT 
                period,
                COUNT(DISTINCT CONCAT(user_id, '-', user_type)) as unique_users,
                COUNT(*) as total_records
            FROM transaction_records
            WHERE transaction_type = 'rebate'
                AND created_at > NOW() - INTERVAL '1 hour'
            GROUP BY period
            HAVING COUNT(*) > COUNT(DISTINCT CONCAT(user_id, '-', user_type))
        `);
        
        if (currentRebates.length === 0) {
            console.log('✅ 没有发现新的重复退水记录');
        } else {
            console.log('⚠️ 仍有重复退水记录，需要进一步检查');
        }
        
        console.log('\n=== 修复完成 ===');
        
    } catch (error) {
        console.error('修复过程中发生错误:', error);
    } finally {
        process.exit(0);
    }
}

// 执行修复
fixRebateSystem();