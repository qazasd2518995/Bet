// test-comprehensive-settlement.cjs - 測試完整結算系統
const { Pool } = require('pg');

// Database config
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

const pool = new Pool(dbConfig);

// 模擬完整結算系統的核心邏輯
function normalizeDrawResult(drawResult) {
    if (!drawResult) return null;
    
    if (drawResult.positions && Array.isArray(drawResult.positions)) {
        return drawResult;
    }
    
    if (drawResult.result && Array.isArray(drawResult.result)) {
        return { positions: drawResult.result };
    }
    
    if (Array.isArray(drawResult) && drawResult.length === 10) {
        return { positions: drawResult };
    }
    
    return null;
}

function checkBetWin(bet, winResult) {
    const positions = winResult.positions;
    const betType = bet.bet_type;
    const betValue = String(bet.bet_value);
    
    console.log(`檢查投注: id=${bet.id}, type=${betType}, value=${betValue}, position=${bet.position}`);
    
    // 號碼投注
    if (betType === 'number' && bet.position) {
        const position = parseInt(bet.position);
        const betNumber = parseInt(betValue);
        
        if (position < 1 || position > 10 || isNaN(betNumber)) {
            return { isWin: false, reason: '無效的位置或號碼' };
        }
        
        const winningNumber = positions[position - 1];
        const isWin = winningNumber === betNumber;
        
        console.log(`  位置${position}開出${winningNumber}，投注${betNumber} => ${isWin ? '中獎' : '未中'}`);
        
        return {
            isWin: isWin,
            reason: `位置${position}開出${winningNumber}，投注${betNumber}${isWin ? '中獎' : '未中'}`,
            odds: bet.odds || 9.89
        };
    }
    
    // 其他投注類型...
    return { isWin: false, reason: '其他投注類型', odds: 0 };
}

async function testSettlement() {
    try {
        console.log('=== 測試完整結算系統 ===\n');
        
        // 1. 測試期號 20250714385
        const period = '20250714385';
        
        // 獲取開獎結果
        const resultQuery = `SELECT * FROM result_history WHERE period = $1`;
        const resultData = await pool.query(resultQuery, [period]);
        
        if (resultData.rows.length === 0) {
            console.log(`找不到期號 ${period} 的開獎結果`);
            return;
        }
        
        const drawResult = resultData.rows[0];
        console.log('原始開獎結果:', drawResult);
        
        // 標準化結果
        const winResult = normalizeDrawResult(drawResult);
        console.log('標準化後:', winResult);
        
        if (!winResult || !winResult.positions) {
            console.log('無法標準化開獎結果');
            return;
        }
        
        // 2. 測試特定的投注
        const testBetsQuery = `
            SELECT * FROM bet_history 
            WHERE period = $1 
            AND bet_type = 'number' 
            AND position = 10
            ORDER BY id
        `;
        const testBets = await pool.query(testBetsQuery, [period]);
        
        console.log(`\n找到 ${testBets.rows.length} 筆位置10的投注\n`);
        
        for (const bet of testBets.rows) {
            const winCheck = checkBetWin(bet, winResult);
            console.log(`\n投注 ID ${bet.id}:`);
            console.log(`  用戶: ${bet.username}`);
            console.log(`  投注: 位置${bet.position} 號碼${bet.bet_value}`);
            console.log(`  金額: ${bet.amount}`);
            console.log(`  當前狀態: ${bet.win ? '中獎' : '未中'} (金額: ${bet.win_amount})`);
            console.log(`  正確狀態: ${winCheck.isWin ? '中獎' : '未中'}`);
            console.log(`  理由: ${winCheck.reason}`);
            
            if (bet.win !== winCheck.isWin) {
                console.log(`  ⚠️  結算錯誤！`);
            }
        }
        
        // 3. 測試所有投注類型
        console.log('\n=== 測試各種投注類型 ===\n');
        
        const allBetsQuery = `
            SELECT DISTINCT bet_type, COUNT(*) as count
            FROM bet_history 
            WHERE period = $1
            GROUP BY bet_type
            ORDER BY bet_type
        `;
        const allBetTypes = await pool.query(allBetsQuery, [period]);
        
        console.log('該期所有投注類型:');
        for (const type of allBetTypes.rows) {
            console.log(`  ${type.bet_type}: ${type.count} 筆`);
        }
        
    } catch (error) {
        console.error('測試過程發生錯誤:', error);
    } finally {
        await pool.end();
    }
}

testSettlement();