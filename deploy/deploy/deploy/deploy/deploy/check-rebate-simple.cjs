const { Pool } = require('pg');

// 直接使用資料庫配置
const dbConfig = {
    host: 'dpg-d0e2imc9c44c73che3kg-a.oregon-postgres.render.com',
    port: 5432,
    database: 'bet_game',
    user: 'bet_game_user',
    password: 'Vm4J5g1gymwPfBNcgYfGCe4GEZqCjoIy',
    ssl: { rejectUnauthorized: false }
};

const pool = new Pool(dbConfig);

async function checkRebateStatus() {
    console.log('===== 檢查退水機制狀態 =====\n');
    
    try {
        // 1. 查詢 justin111 最近的下注記錄
        console.log('1. 查詢 justin111 最近的下注記錄：');
        const betQuery = `
            SELECT 
                bh.id,
                bh.username,
                bh.period,
                bh.bet_type,
                bh.bet_value,
                bh.amount as bet_amount,
                bh.win,
                bh.win_amount,
                bh.settled,
                bh.created_at,
                bh.settled_at
            FROM bet_history bh
            WHERE bh.username = 'justin111'
            ORDER BY bh.created_at DESC
            LIMIT 10
        `;
        
        const betResult = await pool.query(betQuery);
        console.log(`找到 ${betResult.rows.length} 筆下注記錄`);
        
        if (betResult.rows.length > 0) {
            betResult.rows.forEach((bet, index) => {
                console.log(`\n注單 #${index + 1}:`);
                console.log(`  期號: ${bet.period}`);
                console.log(`  下注: ${bet.bet_type} - ${bet.bet_value}`);
                console.log(`  金額: ${bet.bet_amount}`);
                console.log(`  已結算: ${bet.settled}`);
                console.log(`  中獎: ${bet.win} (金額: ${bet.win_amount || 0})`);
                console.log(`  時間: ${bet.created_at}`);
            });
        }
        
        // 2. 檢查最新的退水記錄
        console.log('\n\n2. 查詢 justin111 最近的退水記錄：');
        const rebateQuery = `
            SELECT 
                tr.*
            FROM transaction_records tr
            WHERE tr.member_username = 'justin111' 
            AND tr.transaction_type = 'rebate'
            ORDER BY tr.created_at DESC
            LIMIT 10
        `;
        
        const rebateResult = await pool.query(rebateQuery);
        console.log(`找到 ${rebateResult.rows.length} 筆退水記錄`);
        
        if (rebateResult.rows.length > 0) {
            rebateResult.rows.forEach((rebate, index) => {
                console.log(`\n退水記錄 #${index + 1}:`);
                console.log(`  金額: ${rebate.amount}`);
                console.log(`  期號: ${rebate.period}`);
                console.log(`  退水比例: ${rebate.rebate_percentage}%`);
                console.log(`  下注金額: ${rebate.bet_amount}`);
                console.log(`  時間: ${rebate.created_at}`);
            });
        } else {
            console.log('沒有找到任何退水記錄！');
        }
        
        // 3. 檢查會員資訊
        console.log('\n\n3. 查詢會員資訊：');
        const memberQuery = `
            SELECT 
                m.username,
                m.balance,
                m.is_active,
                m.parent_username
            FROM members m
            WHERE m.username = 'justin111'
        `;
        
        const memberResult = await pool.query(memberQuery);
        if (memberResult.rows.length > 0) {
            const member = memberResult.rows[0];
            console.log(`會員: ${member.username}`);
            console.log(`餘額: ${member.balance}`);
            console.log(`狀態: ${member.is_active ? '啟用' : '停用'}`);
            console.log(`上級: ${member.parent_username}`);
        }
        
        // 4. 檢查代理資訊
        console.log('\n\n4. 查詢代理退水設定：');
        const agentQuery = `
            SELECT 
                a.username,
                a.is_agent,
                a.rebate_rate
            FROM members a
            WHERE a.is_agent = true
            AND EXISTS (
                SELECT 1 FROM members m 
                WHERE m.username = 'justin111' 
                AND m.parent_username = a.username
            )
        `;
        
        const agentResult = await pool.query(agentQuery);
        if (agentResult.rows.length > 0) {
            const agent = agentResult.rows[0];
            console.log(`代理: ${agent.username}`);
            console.log(`退水率: ${agent.rebate_rate}%`);
        }
        
    } catch (error) {
        console.error('檢查過程中發生錯誤:', error);
    } finally {
        await pool.end();
    }
}

// 執行檢查
checkRebateStatus();