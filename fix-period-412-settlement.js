// 修正期號 20250717412 的結算錯誤
import db from './db/config.js';

async function fixPeriod412Settlement() {
    console.log('🔧 修正期號 20250717412 的結算錯誤\n');

    const client = await db.$pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // 1. 查詢開獎結果
        console.log('📌 步驟1：確認開獎結果...');
        const drawResult = await client.query(`
            SELECT period, position_10, result
            FROM result_history
            WHERE period = $1
        `, ['20250717412']);
        
        if (!drawResult.rows[0]) {
            throw new Error('找不到期號 20250717412 的開獎結果');
        }
        
        const actualPosition10 = drawResult.rows[0].position_10;
        console.log(`期號 20250717412 第10名開獎號碼：${actualPosition10}`);
        
        // 2. 查詢所有第10名的投注
        console.log('\n📌 步驟2：查詢所有第10名的投注...');
        const position10Bets = await client.query(`
            SELECT id, username, bet_value, win, win_amount, amount, odds
            FROM bet_history
            WHERE period = $1
            AND position = '10'
            AND bet_type = 'number'
            AND settled = true
            ORDER BY username, bet_value
        `, ['20250717412']);
        
        console.log(`\n找到 ${position10Bets.rows.length} 筆第10名的投注：`);
        
        let fixCount = 0;
        let totalRefund = 0;
        let totalPayout = 0;
        
        for (const bet of position10Bets.rows) {
            const shouldWin = parseInt(bet.bet_value) === actualPosition10;
            const isCorrect = bet.win === shouldWin;
            
            console.log(`\n用戶 ${bet.username} 投注號碼${bet.bet_value}：`);
            console.log(`- 當前狀態：${bet.win ? '中獎' : '未中獎'}`);
            console.log(`- 正確狀態：${shouldWin ? '應該中獎' : '不應該中獎'}`);
            
            if (!isCorrect) {
                console.log(`❌ 需要修正！`);
                
                if (bet.win && !shouldWin) {
                    // 錯誤中獎，需要退還獎金
                    console.log(`- 修正：從中獎改為未中獎`);
                    console.log(`- 退還獎金：${bet.win_amount}`);
                    
                    // 更新投注記錄
                    await client.query(`
                        UPDATE bet_history
                        SET win = false, win_amount = 0
                        WHERE id = $1
                    `, [bet.id]);
                    
                    // 扣除用戶餘額（退還錯誤的獎金）
                    await client.query(`
                        UPDATE members
                        SET balance = balance - $1
                        WHERE username = $2
                    `, [bet.win_amount, bet.username]);
                    
                    // 記錄交易
                    await client.query(`
                        INSERT INTO transaction_records 
                        (username, type, amount, balance_before, balance_after, description, period)
                        SELECT 
                            $1, 
                            'settlement_correction',
                            -$2,
                            balance + $2,
                            balance,
                            $3,
                            $4
                        FROM members WHERE username = $1
                    `, [
                        bet.username,
                        bet.win_amount,
                        `修正期號${bet.period}結算錯誤-退還錯誤獎金`,
                        bet.period
                    ]);
                    
                    totalRefund += parseFloat(bet.win_amount);
                    fixCount++;
                    
                } else if (!bet.win && shouldWin) {
                    // 應該中獎但沒中，需要補發獎金
                    const winAmount = parseFloat(bet.amount) * parseFloat(bet.odds);
                    console.log(`- 修正：從未中獎改為中獎`);
                    console.log(`- 補發獎金：${winAmount.toFixed(2)}`);
                    
                    // 更新投注記錄
                    await client.query(`
                        UPDATE bet_history
                        SET win = true, win_amount = $1
                        WHERE id = $2
                    `, [winAmount.toFixed(2), bet.id]);
                    
                    // 增加用戶餘額
                    await client.query(`
                        UPDATE members
                        SET balance = balance + $1
                        WHERE username = $2
                    `, [winAmount, bet.username]);
                    
                    // 記錄交易
                    await client.query(`
                        INSERT INTO transaction_records 
                        (username, type, amount, balance_before, balance_after, description, period)
                        SELECT 
                            $1, 
                            'settlement_correction',
                            $2,
                            balance - $2,
                            balance,
                            $3,
                            $4
                        FROM members WHERE username = $1
                    `, [
                        bet.username,
                        winAmount,
                        `修正期號${bet.period}結算錯誤-補發獎金`,
                        bet.period
                    ]);
                    
                    totalPayout += winAmount;
                    fixCount++;
                }
            } else {
                console.log(`✅ 結算正確`);
            }
        }
        
        await client.query('COMMIT');
        
        console.log('\n📊 修正結果：');
        console.log(`修正了 ${fixCount} 筆投注`);
        console.log(`退還錯誤獎金：${totalRefund.toFixed(2)}`);
        console.log(`補發正確獎金：${totalPayout.toFixed(2)}`);
        console.log('\n✅ 修正完成！');
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('修正失敗：', error);
        throw error;
    } finally {
        client.release();
    }
}

// 執行修正
fixPeriod412Settlement().then(() => {
    console.log('\n✅ 所有操作完成');
    process.exit(0);
}).catch(error => {
    console.error('❌ 錯誤：', error);
    process.exit(1);
});