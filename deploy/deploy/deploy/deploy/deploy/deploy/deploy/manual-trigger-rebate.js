// manual-trigger-rebate.js - 手動觸發退水處理
import db from './db/config.js';
import fetch from 'node-fetch';

const settlementLog = {
    info: (msg, data) => console.log(`[REBATE INFO] ${msg}`, data || ''),
    warn: (msg, data) => console.warn(`[REBATE WARN] ${msg}`, data || ''),
    error: (msg, data) => console.error(`[REBATE ERROR] ${msg}`, data || '')
};

// 代理系統API URL - 使用本地端口
const AGENT_API_URL = 'http://localhost:3003';

// 手動觸發特定期號的退水處理
async function manualTriggerRebate(period) {
    settlementLog.info(`開始手動觸發期號 ${period} 的退水處理`);
    
    try {
        // 1. 檢查該期是否有已結算的注單
        const settledBets = await db.manyOrNone(`
            SELECT DISTINCT username, SUM(amount) as total_amount
            FROM bet_history
            WHERE period = $1 AND settled = true
            GROUP BY username
        `, [period]);
        
        if (!settledBets || settledBets.length === 0) {
            settlementLog.warn(`期號 ${period} 沒有已結算的注單`);
            return;
        }
        
        settlementLog.info(`找到 ${settledBets.length} 位會員需要處理退水`);
        
        // 2. 檢查是否已經處理過退水
        const existingRebates = await db.oneOrNone(`
            SELECT COUNT(*) as count 
            FROM transaction_records
            WHERE transaction_type = 'rebate' 
            AND period = $1
        `, [period]);
        
        if (existingRebates && parseInt(existingRebates.count) > 0) {
            settlementLog.warn(`期號 ${period} 已經處理過退水 (${existingRebates.count} 筆記錄)`);
            return;
        }
        
        // 3. 處理每個會員的退水
        for (const record of settledBets) {
            try {
                settlementLog.info(`處理會員 ${record.username} 的退水，下注金額: ${record.total_amount}`);
                
                // 獲取會員的代理鏈
                const agentChain = await getAgentChain(record.username);
                if (!agentChain || agentChain.length === 0) {
                    settlementLog.info(`會員 ${record.username} 沒有代理鏈，跳過`);
                    continue;
                }
                
                // 簡化的退水計算 - 固定給 1% 退水測試
                const rebateAmount = parseFloat(record.total_amount) * 0.01;
                
                settlementLog.info(`計算退水金額: ${rebateAmount} (1%)`);
                
                // 直接插入退水記錄到資料庫（繞過代理系統API）
                await db.tx(async t => {
                    // 獲取會員當前餘額
                    const member = await t.one(`
                        SELECT id, balance FROM members WHERE username = $1
                    `, [record.username]);
                    
                    const newBalance = parseFloat(member.balance) + rebateAmount;
                    
                    // 更新會員餘額
                    await t.none(`
                        UPDATE members SET balance = $1 WHERE username = $2
                    `, [newBalance, record.username]);
                    
                    // 插入交易記錄
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
                        `期號 ${period} 退水 (手動觸發)`,
                        record.username,
                        record.total_amount,
                        1.0, // 1%
                        `期號 ${period} 退水分配`
                    ]);
                });
                
                settlementLog.info(`✅ 成功為會員 ${record.username} 處理退水 ${rebateAmount}`);
                
            } catch (memberError) {
                settlementLog.error(`處理會員 ${record.username} 退水失敗:`, memberError);
            }
        }
        
        settlementLog.info(`✅ 期號 ${period} 退水處理完成`);
        
    } catch (error) {
        settlementLog.error(`手動觸發退水失敗:`, error);
    }
}

// 獲取會員的代理鏈（簡化版）
async function getAgentChain(username) {
    try {
        const result = await db.manyOrNone(`
            WITH RECURSIVE agent_hierarchy AS (
                -- 基礎情況：從會員開始
                SELECT 
                    m.id,
                    m.username,
                    m.parent_username as agent_username,
                    0 as level
                FROM members m
                WHERE m.username = $1
                
                UNION ALL
                
                -- 遞歸：向上查找代理鏈
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
        settlementLog.error('獲取代理鏈失敗:', error);
        return [];
    }
}

// 執行手動觸發
if (process.argv.length < 3) {
    console.log('使用方式: node manual-trigger-rebate.js [期號]');
    console.log('例如: node manual-trigger-rebate.js 20250715039');
    process.exit(1);
}

const period = process.argv[2];
manualTriggerRebate(period).then(() => {
    process.exit(0);
}).catch(error => {
    console.error('執行失敗:', error);
    process.exit(1);
});