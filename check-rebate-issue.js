// 檢查退水問題
import db from './db/config.js';

async function checkRebateIssue() {
    console.log('🔍 檢查退水問題...\n');
    
    try {
        // 1. 檢查 justin111 最近的下注記錄
        console.log('=== 1. 檢查 justin111 最近的下注記錄 ===');
        const recentBets = await db.any(`
            SELECT 
                id, 
                period, 
                bet_type, 
                bet_value, 
                amount, 
                settled, 
                win, 
                created_at 
            FROM bet_history 
            WHERE username = 'justin111' 
            AND amount >= 1000
            ORDER BY created_at DESC 
            LIMIT 5
        `);
        
        console.log(`找到 ${recentBets.length} 筆 1000元以上的下注記錄:`);
        recentBets.forEach((bet, index) => {
            console.log(`${index + 1}. 期號: ${bet.period}, 金額: ${bet.amount}, 已結算: ${bet.settled ? '是' : '否'}, 時間: ${new Date(bet.created_at).toLocaleString()}`);
        });
        
        // 2. 檢查 justin2025A 的代理資訊和退水設置
        console.log('\n=== 2. 檢查 justin2025A 代理資訊 ===');
        const agentInfo = await db.oneOrNone(`
            SELECT 
                id, 
                username, 
                level, 
                market_type, 
                rebate_percentage,
                balance 
            FROM agents 
            WHERE username = 'justin2025A'
        `);
        
        if (agentInfo) {
            console.log(`代理 ID: ${agentInfo.id}`);
            console.log(`用戶名: ${agentInfo.username}`);
            console.log(`層級: ${agentInfo.level}`);
            console.log(`盤口: ${agentInfo.market_type}`);
            console.log(`退水比例: ${(parseFloat(agentInfo.rebate_percentage) * 100).toFixed(1)}%`);
            console.log(`當前餘額: ${agentInfo.balance}`);
        } else {
            console.log('❌ 找不到代理 justin2025A');
        }
        
        // 3. 檢查 justin111 的代理鏈
        console.log('\n=== 3. 檢查 justin111 的代理鏈 ===');
        const memberInfo = await db.oneOrNone(`
            SELECT 
                m.username,
                m.parent_agent_id,
                a.username as agent_username,
                a.level as agent_level,
                a.rebate_percentage,
                a.market_type
            FROM members m
            JOIN agents a ON m.parent_agent_id = a.id
            WHERE m.username = 'justin111'
        `);
        
        if (memberInfo) {
            console.log(`會員: ${memberInfo.username}`);
            console.log(`直屬代理: ${memberInfo.agent_username} (ID: ${memberInfo.parent_agent_id})`);
            console.log(`代理層級: ${memberInfo.agent_level}`);
            console.log(`代理退水: ${(parseFloat(memberInfo.rebate_percentage) * 100).toFixed(1)}%`);
            console.log(`盤口類型: ${memberInfo.market_type}`);
        }
        
        // 4. 檢查最近的退水交易記錄
        console.log('\n=== 4. 檢查最近的退水交易記錄 ===');
        const recentRebates = await db.any(`
            SELECT 
                agent_username,
                rebate_amount,
                member_username,
                bet_amount,
                created_at,
                reason
            FROM transaction_records 
            WHERE transaction_type = 'rebate' 
            AND (agent_username = 'justin2025A' OR member_username = 'justin111')
            ORDER BY created_at DESC 
            LIMIT 10
        `);
        
        if (recentRebates.length > 0) {
            console.log(`找到 ${recentRebates.length} 筆相關退水記錄:`);
            recentRebates.forEach((record, index) => {
                console.log(`${index + 1}. ${record.agent_username} 獲得 ${record.rebate_amount}元 (會員: ${record.member_username}, 下注: ${record.bet_amount}元)`);
                console.log(`   時間: ${new Date(record.created_at).toLocaleString()}`);
                console.log(`   原因: ${record.reason}`);
            });
        } else {
            console.log('❌ 沒有找到相關的退水記錄');
        }
        
        // 5. 檢查結算日誌
        console.log('\n=== 5. 檢查最近的結算日誌 ===');
        const settlementLogs = await db.any(`
            SELECT 
                period,
                settled_count,
                total_win_amount,
                created_at
            FROM settlement_logs
            ORDER BY created_at DESC
            LIMIT 5
        `);
        
        if (settlementLogs.length > 0) {
            console.log(`找到 ${settlementLogs.length} 筆結算日誌:`);
            settlementLogs.forEach((log, index) => {
                console.log(`${index + 1}. 期號: ${log.period}, 結算數: ${log.settled_count}, 總派彩: ${log.total_win_amount}, 時間: ${new Date(log.created_at).toLocaleString()}`);
            });
        } else {
            console.log('❌ 沒有找到結算日誌（可能表格不存在）');
        }
        
        // 6. 診斷建議
        console.log('\n=== 6. 診斷建議 ===');
        console.log('可能的問題:');
        console.log('1. 改進的結算系統中退水功能可能沒有正確執行');
        console.log('2. 代理鏈API可能無法正確獲取');
        console.log('3. 退水分配API可能調用失敗');
        console.log('\n建議的解決方案:');
        console.log('1. 檢查 processRebates 函數是否真的被調用');
        console.log('2. 在退水相關函數添加更多日誌');
        console.log('3. 確認代理系統API是否正常運行');
        
    } catch (error) {
        console.error('檢查時發生錯誤:', error);
    } finally {
        process.exit(0);
    }
}

checkRebateIssue();