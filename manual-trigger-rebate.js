// manual-trigger-rebate.js - 手动触发退水处理
import db from './db/config.js';
import fetch from 'node-fetch';

const settlementLog = {
    info: (msg, data) => console.log(`[REBATE INFO] ${msg}`, data || ''),
    warn: (msg, data) => console.warn(`[REBATE WARN] ${msg}`, data || ''),
    error: (msg, data) => console.error(`[REBATE ERROR] ${msg}`, data || '')
};

// 代理系统API URL - 使用本地端口
const AGENT_API_URL = 'http://localhost:3003';

// 手动触发特定期号的退水处理
async function manualTriggerRebate(period) {
    settlementLog.info(`开始手动触发期号 ${period} 的退水处理`);
    
    try {
        // 1. 检查该期是否有已结算的注单
        const settledBets = await db.manyOrNone(`
            SELECT DISTINCT username, SUM(amount) as total_amount
            FROM bet_history
            WHERE period = $1 AND settled = true
            GROUP BY username
        `, [period]);
        
        if (!settledBets || settledBets.length === 0) {
            settlementLog.warn(`期号 ${period} 没有已结算的注单`);
            return;
        }
        
        settlementLog.info(`找到 ${settledBets.length} 位会员需要处理退水`);
        
        // 2. 检查是否已经处理过退水
        const existingRebates = await db.oneOrNone(`
            SELECT COUNT(*) as count 
            FROM transaction_records
            WHERE transaction_type = 'rebate' 
            AND period = $1
        `, [period]);
        
        if (existingRebates && parseInt(existingRebates.count) > 0) {
            settlementLog.warn(`期号 ${period} 已经处理过退水 (${existingRebates.count} 笔记录)`);
            return;
        }
        
        // 3. 处理每个会员的退水
        for (const record of settledBets) {
            try {
                settlementLog.info(`处理会员 ${record.username} 的退水，下注金额: ${record.total_amount}`);
                
                // 获取会员的代理链
                const agentChain = await getAgentChain(record.username);
                if (!agentChain || agentChain.length === 0) {
                    settlementLog.info(`会员 ${record.username} 没有代理链，跳过`);
                    continue;
                }
                
                // 简化的退水计算 - 固定给 1% 退水测试
                const rebateAmount = parseFloat(record.total_amount) * 0.01;
                
                settlementLog.info(`计算退水金额: ${rebateAmount} (1%)`);
                
                // 直接插入退水记录到资料库（绕过代理系统API）
                await db.tx(async t => {
                    // 获取会员当前余额
                    const member = await t.one(`
                        SELECT id, balance FROM members WHERE username = $1
                    `, [record.username]);
                    
                    const newBalance = parseFloat(member.balance) + rebateAmount;
                    
                    // 更新会员余额
                    await t.none(`
                        UPDATE members SET balance = $1 WHERE username = $2
                    `, [newBalance, record.username]);
                    
                    // 插入交易记录
                    await t.none(`
                        INSERT INTO transaction_records (
                            user_type, user_id, transaction_type, amount,
                            balance_before, balance_after, description,
                            member_username, bet_amount, rebate_percentage, period
                        ) VALUES (
                            'member', $1, 'rebate', $2,
                            $3, $4, $5,
                            $6, $7, $8, $9
                        )
                    `, [
                        member.id,
                        rebateAmount,
                        member.balance,
                        newBalance,
                        `期号 ${period} 退水 (手动触发)`,
                        record.username,
                        record.total_amount,
                        1.0, // 1%
                        `期号 ${period} 退水分配`
                    ]);
                });
                
                settlementLog.info(`✅ 成功为会员 ${record.username} 处理退水 ${rebateAmount}`);
                
            } catch (memberError) {
                settlementLog.error(`处理会员 ${record.username} 退水失败:`, memberError);
            }
        }
        
        settlementLog.info(`✅ 期号 ${period} 退水处理完成`);
        
    } catch (error) {
        settlementLog.error(`手动触发退水失败:`, error);
    }
}

// 获取会员的代理链（简化版）
async function getAgentChain(username) {
    try {
        const result = await db.manyOrNone(`
            WITH RECURSIVE agent_hierarchy AS (
                -- 基础情况：从会员开始
                SELECT 
                    m.id,
                    m.username,
                    m.parent_username as agent_username,
                    0 as level
                FROM members m
                WHERE m.username = $1
                
                UNION ALL
                
                -- 递归：向上查找代理链
                SELECT 
                    p.id,
                    p.username,
                    p.parent_username as agent_username,
                    ah.level + 1
                FROM members p
                INNER JOIN agent_hierarchy ah ON p.username = ah.agent_username
                WHERE p.parent_username IS NOT NULL
            )
            SELECT * FROM agent_hierarchy 
            WHERE level > 0
            ORDER BY level ASC
        `, [username]);
        
        return result || [];
    } catch (error) {
        settlementLog.error('获取代理链失败:', error);
        return [];
    }
}

// 执行手动触发
if (process.argv.length < 3) {
    console.log('使用方式: node manual-trigger-rebate.js [期号]');
    console.log('例如: node manual-trigger-rebate.js 20250715039');
    process.exit(1);
}

const period = process.argv[2];
manualTriggerRebate(period).then(() => {
    process.exit(0);
}).catch(error => {
    console.error('执行失败:', error);
    process.exit(1);
});