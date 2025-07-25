require('dotenv').config();
const { Client } = require('pg');

// 确保使用 Render PostgreSQL
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
    ssl: '已启用'
});

async function checkCurrentPeriod() {
    const client = new Client(dbConfig);
    
    try {
        await client.connect();
        console.log('✅ 连接到 Render PostgreSQL 成功');
        
        // 查询最新期号和开奖时间
        const periodResult = await client.query(`
            SELECT 
                market_type,
                period_number,
                start_time,
                end_time,
                result,
                is_settled,
                CASE 
                    WHEN end_time > NOW() THEN '尚未结束'
                    WHEN result IS NULL THEN '待开奖'
                    ELSE '已开奖'
                END as status
            FROM periods 
            WHERE start_time <= NOW() 
            ORDER BY start_time DESC 
            LIMIT 10
        `);
        
        console.log('\n=== 最新期号状态 ===');
        periodResult.rows.forEach(row => {
            console.log(`${row.market_type} - 期号: ${row.period_number}`);
            console.log(`  开始时间: ${row.start_time}`);
            console.log(`  结束时间: ${row.end_time}`);
            console.log(`  开奖结果: ${row.result || '未开奖'}`);
            console.log(`  已结算: ${row.is_settled}`);
            console.log(`  状态: ${row.status}`);
            console.log('---');
        });
        
        // 查询我们刚下注的记录
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
            console.log('\n=== 刚下注的记录 ===');
            console.log(`投注ID: ${bet.id}`);
            console.log(`期号: ${bet.period_number}`);
            console.log(`市场: ${bet.market_type}`);
            console.log(`投注类型: ${bet.bet_type}`);
            console.log(`位置: ${bet.position}`);
            console.log(`金额: ${bet.amount}`);
            console.log(`下注时间: ${bet.created_at}`);
            console.log(`期号结束时间: ${bet.end_time}`);
            console.log(`开奖结果: ${bet.result || '未开奖'}`);
            console.log(`已结算: ${bet.is_settled}`);
            
            // 计算距离开奖的时间
            if (bet.end_time) {
                const now = new Date();
                const endTime = new Date(bet.end_time);
                const timeDiff = endTime - now;
                
                if (timeDiff > 0) {
                    const minutes = Math.floor(timeDiff / (1000 * 60));
                    const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
                    console.log(`距离开奖还有: ${minutes}分${seconds}秒`);
                } else {
                    console.log('此期已经结束，等待开奖结算');
                }
            }
        }
        
    } catch (error) {
        console.error('检查期号时发生错误:', error.message);
    } finally {
        await client.end();
    }
}

checkCurrentPeriod();
