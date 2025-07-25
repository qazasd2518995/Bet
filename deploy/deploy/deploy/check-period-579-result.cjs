const pgp = require('pg-promise')();

const dbConfig = {
    host: 'dpg-d0e2imc9c44c73che3kg-a.oregon-postgres.render.com',
    port: 5432,
    database: 'bet_game',
    user: 'bet_game_user',
    password: 'Vm4J5g1gymwPfBNcgYfGCe4GEZqCjoIy',
    ssl: { rejectUnauthorized: false }
};

const db = pgp(dbConfig);

async function checkPeriod579() {
    try {
        // 查詢期號 20250717579 的開獎結果
        const result = await db.oneOrNone(`
            SELECT * FROM result_history 
            WHERE period = '20250717579'
        `);
        
        if (result) {
            console.log('期號 20250717579 開獎結果：');
            console.log('完整記錄：', result);
            console.log('\n各位置開獎號碼：');
            for (let i = 1; i <= 10; i++) {
                console.log(`第${i}名: ${result[`position_${i}`]}`);
            }
            
            console.log('\n第1名(冠軍)：', result.position_1);
            console.log('冠軍是大還是小：', result.position_1 >= 6 ? '大' : '小');
            console.log('冠軍是單還是雙：', result.position_1 % 2 === 1 ? '單' : '雙');
        } else {
            console.log('找不到期號 20250717579 的開獎結果');
        }
        
        // 查詢該期的投注記錄
        const bets = await db.any(`
            SELECT * FROM bet_history 
            WHERE period = '20250717579' 
            AND username = 'justin111'
            ORDER BY id
        `);
        
        console.log('\n\n該期投注記錄：');
        bets.forEach(bet => {
            console.log(`投注ID: ${bet.id}, 類型: ${bet.bet_type}, 值: ${bet.bet_value}, 金額: ${bet.amount}, 狀態: ${bet.status}, 贏金: ${bet.win_amount}`);
        });
        
    } catch (error) {
        console.error('查詢失敗：', error);
    } finally {
        await pgp.end();
        process.exit(0);
    }
}

checkPeriod579();
