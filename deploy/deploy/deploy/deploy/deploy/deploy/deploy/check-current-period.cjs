require('dotenv').config();
const { Client } = require('pg');

// 確保使用 Render PostgreSQL
const dbConfig = {
    host: 'dpg-d0e2imc9c44c73che3kg-a.oregon-postgres.render.com',
    port: 5432,
    database: 'bet_game',
    user: 'bet_game_user',
    password: 'Vm4J5g1gymwPfBNcgYfGCe4GEZqCjoIy',
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
        
        // 查詢遊戲狀態
        const gameStateResult = await client.query(`
            SELECT * FROM game_state ORDER BY id DESC LIMIT 5
        `);
        
        console.log('\n=== 遊戲狀態 ===');
        if (gameStateResult.rows.length > 0) {
            gameStateResult.rows.forEach(row => {
                console.log(`期號: ${row.current_period || row.period_number}`);
                console.log(`  市場: ${row.market_type || 'A'}`);
                console.log(`  狀態: ${row.status || row.phase}`);
                console.log(`  更新時間: ${row.last_updated || row.updated_at}`);
                console.log('---');
            });
        } else {
            console.log('未找到遊戲狀態記錄');
        }
        
        // 查詢最新開獎記錄
        const drawResult = await client.query(`
            SELECT * FROM draw_records ORDER BY created_at DESC LIMIT 5
        `);
        
        console.log('\n=== 最新開獎記錄 ===');
        if (drawResult.rows.length > 0) {
            drawResult.rows.forEach(row => {
                console.log(`期號: ${row.period_number}`);
                console.log(`  市場: ${row.market_type}`);
                console.log(`  開獎結果: ${row.result}`);
                console.log(`  開獎時間: ${row.created_at}`);
                console.log('---');
            });
        } else {
            console.log('未找到開獎記錄');
        }
        
        // 查詢我們剛下注的記錄
        const betResult = await client.query(`
            SELECT 
                id,
                period_number,
                market_type,
                bet_type,
                bet_position,
                amount,
                username,
                created_at,
                is_settled,
                win_amount
            FROM bet_history
            WHERE id = 1406
        `);
        
        if (betResult.rows.length > 0) {
            const bet = betResult.rows[0];
            console.log('\n=== 剛下注的記錄 ===');
            console.log(`投注ID: ${bet.id}`);
            console.log(`期號: ${bet.period_number}`);
            console.log(`市場: ${bet.market_type}`);
            console.log(`投注類型: ${bet.bet_type}`);
            console.log(`位置: ${bet.bet_position}`);
            console.log(`金額: ${bet.amount}`);
            console.log(`下注時間: ${bet.created_at}`);
            console.log(`已結算: ${bet.is_settled}`);
            console.log(`獲勝金額: ${bet.win_amount || '未結算'}`);
            
            // 查詢該期號的開獎狀態
            const periodDrawResult = await client.query(`
                SELECT * FROM draw_records 
                WHERE period_number = $1 AND market_type = $2
            `, [bet.period_number, bet.market_type]);
            
            if (periodDrawResult.rows.length > 0) {
                const draw = periodDrawResult.rows[0];
                console.log(`該期開獎結果: ${draw.result}`);
                console.log(`開獎時間: ${draw.created_at}`);
            } else {
                console.log('該期尚未開獎');
            }
        } else {
            console.log('\n=== 找不到投注記錄 1406 ===');
        }
        
    } catch (error) {
        console.error('檢查期號時發生錯誤:', error.message);
    } finally {
        await client.end();
    }
}

checkCurrentPeriod();
