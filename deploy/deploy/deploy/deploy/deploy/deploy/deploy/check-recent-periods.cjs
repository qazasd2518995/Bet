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

async function checkRecentPeriods() {
    console.log('===== 檢查最近期號的退水情況 =====\n');
    
    try {
        // 1. 檢查 members 表結構
        console.log('1. 檢查 members 表結構：');
        const memberStructureQuery = `
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'members'
            ORDER BY ordinal_position
        `;
        
        const memberStructure = await pool.query(memberStructureQuery);
        console.log('Members 表欄位：');
        memberStructure.rows.forEach(col => {
            console.log(`  - ${col.column_name} (${col.data_type})`);
        });
        
        // 2. 查詢最近幾個期號的下注和退水統計
        console.log('\n\n2. 最近期號的下注和退水統計：');
        const periodStatsQuery = `
            WITH recent_periods AS (
                SELECT DISTINCT period
                FROM bet_history
                WHERE created_at >= NOW() - INTERVAL '2 hours'
                ORDER BY period DESC
                LIMIT 10
            ),
            bet_stats AS (
                SELECT 
                    bh.period,
                    COUNT(*) as total_bets,
                    COUNT(DISTINCT bh.username) as total_users,
                    SUM(bh.amount) as total_amount,
                    COUNT(CASE WHEN bh.settled = true THEN 1 END) as settled_bets,
                    MIN(bh.created_at) as first_bet_time,
                    MAX(bh.settled_at) as last_settled_time
                FROM bet_history bh
                WHERE bh.period IN (SELECT period FROM recent_periods)
                GROUP BY bh.period
            ),
            rebate_stats AS (
                SELECT 
                    CAST(REGEXP_REPLACE(tr.period, '[^0-9]', '', 'g') AS bigint) as period,
                    COUNT(*) as rebate_count,
                    SUM(tr.amount) as total_rebate,
                    COUNT(DISTINCT tr.member_username) as rebated_users,
                    MIN(tr.created_at) as first_rebate_time,
                    MAX(tr.created_at) as last_rebate_time
                FROM transaction_records tr
                WHERE tr.transaction_type = 'rebate'
                AND tr.period LIKE '%20250715%'
                GROUP BY CAST(REGEXP_REPLACE(tr.period, '[^0-9]', '', 'g') AS bigint)
            )
            SELECT 
                bs.period,
                bs.total_bets,
                bs.total_users,
                bs.total_amount,
                bs.settled_bets,
                bs.first_bet_time,
                bs.last_settled_time,
                COALESCE(rs.rebate_count, 0) as rebate_count,
                COALESCE(rs.total_rebate, 0) as total_rebate,
                COALESCE(rs.rebated_users, 0) as rebated_users,
                rs.first_rebate_time,
                rs.last_rebate_time
            FROM bet_stats bs
            LEFT JOIN rebate_stats rs ON bs.period = rs.period
            ORDER BY bs.period DESC
        `;
        
        const periodStats = await pool.query(periodStatsQuery);
        console.log(`找到 ${periodStats.rows.length} 個期號的統計資料`);
        
        periodStats.rows.forEach(stat => {
            console.log(`\n期號: ${stat.period}`);
            console.log(`  下注數: ${stat.total_bets} (已結算: ${stat.settled_bets})`);
            console.log(`  下注用戶數: ${stat.total_users}`);
            console.log(`  總下注金額: ${stat.total_amount}`);
            console.log(`  退水記錄數: ${stat.rebate_count}`);
            console.log(`  退水用戶數: ${stat.rebated_users}`);
            console.log(`  總退水金額: ${stat.total_rebate}`);
            console.log(`  首次下注: ${stat.first_bet_time}`);
            console.log(`  最後結算: ${stat.last_settled_time || '未結算'}`);
            console.log(`  首次退水: ${stat.first_rebate_time || '無退水'}`);
            console.log(`  最後退水: ${stat.last_rebate_time || '無退水'}`);
        });
        
        // 3. 檢查 justin111 在最近期號的詳細情況
        console.log('\n\n3. justin111 在最近期號的詳細情況：');
        const userDetailQuery = `
            SELECT 
                bh.period,
                bh.id as bet_id,
                bh.amount as bet_amount,
                bh.settled,
                bh.created_at as bet_time,
                bh.settled_at,
                tr.id as rebate_id,
                tr.amount as rebate_amount,
                tr.created_at as rebate_time
            FROM bet_history bh
            LEFT JOIN transaction_records tr ON 
                tr.member_username = bh.username 
                AND tr.transaction_type = 'rebate'
                AND CAST(REGEXP_REPLACE(tr.period, '[^0-9]', '', 'g') AS bigint) = bh.period
            WHERE bh.username = 'justin111'
            AND bh.period >= 20250715037
            ORDER BY bh.period DESC, bh.created_at DESC
        `;
        
        const userDetail = await pool.query(userDetailQuery);
        console.log(`找到 ${userDetail.rows.length} 筆記錄`);
        
        userDetail.rows.forEach(detail => {
            console.log(`\n期號 ${detail.period} - 注單 ${detail.bet_id}:`);
            console.log(`  下注金額: ${detail.bet_amount}`);
            console.log(`  已結算: ${detail.settled}`);
            console.log(`  下注時間: ${detail.bet_time}`);
            console.log(`  結算時間: ${detail.settled_at || '未結算'}`);
            console.log(`  退水記錄: ${detail.rebate_id ? `ID ${detail.rebate_id}, 金額 ${detail.rebate_amount}` : '無'}`);
            console.log(`  退水時間: ${detail.rebate_time || '無'}`);
        });
        
    } catch (error) {
        console.error('檢查過程中發生錯誤:', error);
    } finally {
        await pool.end();
    }
}

// 執行檢查
checkRecentPeriods();