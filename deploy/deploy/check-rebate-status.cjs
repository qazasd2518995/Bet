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
                bh.position,
                bh.amount as bet_amount,
                bh.odds,
                bh.win,
                bh.win_amount,
                bh.settled,
                bh.created_at,
                bh.settled_at,
                rh.created_at as draw_time
            FROM bet_history bh
            LEFT JOIN result_history rh ON bh.period = rh.period
            WHERE bh.username = 'justin111'
            ORDER BY bh.created_at DESC
            LIMIT 10
        `;
        
        const betResult = await pool.query(betQuery);
        console.log(`找到 ${betResult.rows.length} 筆下注記錄`);
        
        if (betResult.rows.length > 0) {
            betResult.rows.forEach((bet, index) => {
                console.log(`\n注單 #${index + 1}:`);
                console.log(`  ID: ${bet.id}`);
                console.log(`  期號: ${bet.period}`);
                console.log(`  下注類型: ${bet.bet_type}`);
                console.log(`  下注值: ${bet.bet_value}`);
                console.log(`  位置: ${bet.position || '無'}`);
                console.log(`  下注金額: ${bet.bet_amount}`);
                console.log(`  賠率: ${bet.odds}`);
                console.log(`  是否中獎: ${bet.win}`);
                console.log(`  是否已結算: ${bet.settled}`);
                console.log(`  中獎金額: ${bet.win_amount || '無'}`);
                console.log(`  下注時間: ${bet.created_at}`);
                console.log(`  結算時間: ${bet.settled_at || '未結算'}`);
                console.log(`  開獎時間: ${bet.draw_time || '未開獎'}`);
            });
        }
        
        // 2. 檢查最新的退水記錄
        console.log('\n\n2. 查詢 justin111 最近的退水記錄：');
        const rebateQuery = `
            SELECT 
                tr.id,
                tr.user_id,
                tr.user_type,
                tr.transaction_type,
                tr.amount,
                tr.balance_before,
                tr.balance_after,
                tr.description,
                tr.created_at,
                tr.member_username,
                tr.bet_amount,
                tr.rebate_percentage,
                tr.period
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
                console.log(`  ID: ${rebate.id}`);
                console.log(`  交易類型: ${rebate.transaction_type}`);
                console.log(`  金額: ${rebate.amount}`);
                console.log(`  餘額變化: ${rebate.balance_before} -> ${rebate.balance_after}`);
                console.log(`  描述: ${rebate.description}`);
                console.log(`  下注金額: ${rebate.bet_amount}`);
                console.log(`  退水比例: ${rebate.rebate_percentage}%`);
                console.log(`  期號: ${rebate.period}`);
                console.log(`  時間: ${rebate.created_at}`);
            });
        } else {
            console.log('沒有找到任何退水記錄！');
        }
        
        // 3. 檢查會員餘額和退水設定
        console.log('\n\n3. 查詢會員餘額和退水設定：');
        const memberQuery = `
            SELECT 
                m.member_id,
                m.balance,
                m.agent_id,
                a.username as agent_username,
                a.racing_rebate,
                a.parent_agent_id
            FROM members m
            LEFT JOIN agents a ON m.agent_id = a.agent_id
            WHERE m.member_id = 'justin111'
        `;
        
        const memberResult = await pool.query(memberQuery);
        if (memberResult.rows.length > 0) {
            const member = memberResult.rows[0];
            console.log(`會員ID: ${member.member_id}`);
            console.log(`當前餘額: ${member.balance}`);
            console.log(`所屬代理: ${member.agent_id} (${member.agent_username})`);
            console.log(`代理退水率: ${member.racing_rebate}%`);
            console.log(`上級代理: ${member.parent_agent_id || '無'}`);
        }
        
        // 4. 檢查最近的結算記錄
        console.log('\n\n4. 查詢最近的結算記錄：');
        const settlementQuery = `
            SELECT 
                rh.id as draw_id,
                rh.draw_time,
                rh.is_settled,
                rh.settled_at,
                COUNT(DISTINCT bh.id) as total_bets,
                COUNT(DISTINCT CASE WHEN bh.is_settled = true THEN bh.id END) as settled_bets,
                SUM(bh.bet_amount) as total_bet_amount,
                SUM(bh.rebate_amount) as total_rebate_amount
            FROM result_history rh
            LEFT JOIN bet_history bh ON rh.id = bh.draw_id
            WHERE rh.draw_time >= NOW() - INTERVAL '1 hour'
            GROUP BY rh.id, rh.draw_time, rh.is_settled, rh.settled_at
            ORDER BY rh.draw_time DESC
            LIMIT 5
        `;
        
        const settlementResult = await pool.query(settlementQuery);
        console.log(`找到 ${settlementResult.rows.length} 個最近的期號`);
        
        settlementResult.rows.forEach((settlement, index) => {
            console.log(`\n期號 ${settlement.draw_id}:`);
            console.log(`  開獎時間: ${settlement.draw_time}`);
            console.log(`  是否已結算: ${settlement.is_settled}`);
            console.log(`  結算時間: ${settlement.settled_at || '未結算'}`);
            console.log(`  總注單數: ${settlement.total_bets}`);
            console.log(`  已結算注單: ${settlement.settled_bets}`);
            console.log(`  總下注金額: ${settlement.total_bet_amount || 0}`);
            console.log(`  總退水金額: ${settlement.total_rebate_amount || 0}`);
        });
        
        // 5. 檢查退水是否有重複或遺漏
        console.log('\n\n5. 檢查退水完整性：');
        const integrityQuery = `
            WITH bet_rebates AS (
                SELECT 
                    bh.id as bet_id,
                    bh.member_id,
                    bh.draw_id,
                    bh.bet_amount,
                    bh.rebate_amount,
                    bh.is_settled,
                    bh.settled_at
                FROM bet_history bh
                WHERE bh.member_id = 'justin111'
                AND bh.is_settled = true
                AND bh.created_at >= NOW() - INTERVAL '24 hours'
            ),
            transaction_rebates AS (
                SELECT 
                    tr.related_id::bigint as bet_id,
                    tr.member_id,
                    tr.amount,
                    tr.created_at
                FROM transaction_records tr
                WHERE tr.member_id = 'justin111'
                AND tr.type = 'rebate'
                AND tr.created_at >= NOW() - INTERVAL '24 hours'
            )
            SELECT 
                br.bet_id,
                br.draw_id,
                br.bet_amount,
                br.rebate_amount as expected_rebate,
                tr.amount as actual_rebate,
                CASE 
                    WHEN tr.bet_id IS NULL THEN '缺少退水記錄'
                    WHEN tr.amount != br.rebate_amount THEN '退水金額不符'
                    ELSE '正常'
                END as status
            FROM bet_rebates br
            LEFT JOIN transaction_rebates tr ON br.bet_id = tr.bet_id
            ORDER BY br.bet_id DESC
        `;
        
        const integrityResult = await pool.query(integrityQuery);
        console.log(`檢查了 ${integrityResult.rows.length} 筆已結算的注單`);
        
        let missingCount = 0;
        let mismatchCount = 0;
        
        integrityResult.rows.forEach(row => {
            if (row.status === '缺少退水記錄') {
                missingCount++;
                console.log(`\n注單 ${row.bet_id} (期號: ${row.draw_id}):`);
                console.log(`  狀態: ${row.status}`);
                console.log(`  下注金額: ${row.bet_amount}`);
                console.log(`  應退水金額: ${row.expected_rebate}`);
            } else if (row.status === '退水金額不符') {
                mismatchCount++;
                console.log(`\n注單 ${row.bet_id} (期號: ${row.draw_id}):`);
                console.log(`  狀態: ${row.status}`);
                console.log(`  應退水金額: ${row.expected_rebate}`);
                console.log(`  實際退水金額: ${row.actual_rebate}`);
            }
        });
        
        console.log(`\n總結：`);
        console.log(`  缺少退水記錄: ${missingCount} 筆`);
        console.log(`  退水金額不符: ${mismatchCount} 筆`);
        console.log(`  正常: ${integrityResult.rows.length - missingCount - mismatchCount} 筆`);
        
    } catch (error) {
        console.error('檢查過程中發生錯誤:', error);
    } finally {
        await pool.end();
    }
}

// 執行檢查
checkRebateStatus();