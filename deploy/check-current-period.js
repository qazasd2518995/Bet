require('dotenv').config();
const { Client } = require('pg');

// 確保使用 Render PostgreSQL
const dbConfig = {
    host: 'dpg-d0e2imc9c44c73che3kg-a.oregon-postgres.render.com',
    port: 5432,
    database: 'bet_game',
    user: 'bet_game_user',
    password: process.env.POSTGRES_PASSWORD,
    ssl: {
        rejectUnauthorized: false
    }
};

console.log('使用 Render PostgreSQL 配置:', {
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database,
    user: dbConfig.user,
    ssl: '已啟用'
});

async function checkCurrentPeriod() {
    const client = new Client(dbConfig);
    
    try {
        await client.connect();
        console.log('✅ 連接到 Render PostgreSQL 成功');
        
        // 查詢最新期號和開獎時間
        const periodResult = await client.query(`
            SELECT 
                market_type,
                period_number,
                start_time,
                end_time,
                result,
                is_settled,
                CASE 
                    WHEN end_time > NOW() THEN '尚未結束'
                    WHEN result IS NULL THEN '待開獎'
                    ELSE '已開獎'
                END as status
            FROM periods 
            WHERE start_time <= NOW() 
            ORDER BY start_time DESC 
            LIMIT 10
        `);
        
        console.log('\n=== 最新期號狀態 ===');
        periodResult.rows.forEach(row => {
            console.log(`${row.market_type} - 期號: ${row.period_number}`);
            console.log(`  開始時間: ${row.start_time}`);
            console.log(`  結束時間: ${row.end_time}`);
            console.log(`  開獎結果: ${row.result || '未開獎'}`);
            console.log(`  已結算: ${row.is_settled}`);
            console.log(`  狀態: ${row.status}`);
            console.log('---');
        });
        
        // 查詢我們剛下注的記錄
        const betResult = await client.query(`
            SELECT 
                b.id,
                b.period_number,
                b.market_type,
                b.bet_type,
                b.position,
                b.amount,
                b.username,
                b.created_at,
                p.end_time,
                p.result,
                p.is_settled
            FROM bets b
            LEFT JOIN periods p ON b.period_number = p.period_number AND b.market_type = p.market_type
            WHERE b.id = 1406
        `);
        
        if (betResult.rows.length > 0) {
            const bet = betResult.rows[0];
            console.log('\n=== 剛下注的記錄 ===');
            console.log(`投注ID: ${bet.id}`);
            console.log(`期號: ${bet.period_number}`);
            console.log(`市場: ${bet.market_type}`);
            console.log(`投注類型: ${bet.bet_type}`);
            console.log(`位置: ${bet.position}`);
            console.log(`金額: ${bet.amount}`);
            console.log(`下注時間: ${bet.created_at}`);
            console.log(`期號結束時間: ${bet.end_time}`);
            console.log(`開獎結果: ${bet.result || '未開獎'}`);
            console.log(`已結算: ${bet.is_settled}`);
            
            // 計算距離開獎的時間
            if (bet.end_time) {
                const now = new Date();
                const endTime = new Date(bet.end_time);
                const timeDiff = endTime - now;
                
                if (timeDiff > 0) {
                    const minutes = Math.floor(timeDiff / (1000 * 60));
                    const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
                    console.log(`距離開獎還有: ${minutes}分${seconds}秒`);
                } else {
                    console.log('此期已經結束，等待開獎結算');
                }
            }
        }
        
    } catch (error) {
        console.error('檢查期號時發生錯誤:', error.message);
    } finally {
        await client.end();
    }
}

checkCurrentPeriod();
