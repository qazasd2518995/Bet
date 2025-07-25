// 修正期号 20250717412 的结算错误
import db from './db/config.js';

async function fixPeriod412Settlement() {
    console.log('🔧 修正期号 20250717412 的结算错误\n');

    const client = await db.$pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // 1. 查询开奖结果
        console.log('📌 步骤1：确认开奖结果...');
        const drawResult = await client.query(`
            SELECT period, position_10, result
            FROM result_history
            WHERE period = $1
        `, ['20250717412']);
        
        if (!drawResult.rows[0]) {
            throw new Error('找不到期号 20250717412 的开奖结果');
        }
        
        const actualPosition10 = drawResult.rows[0].position_10;
        console.log(`期号 20250717412 第10名开奖号码：${actualPosition10}`);
        
        // 2. 查询所有第10名的投注
        console.log('\n📌 步骤2：查询所有第10名的投注...');
        const position10Bets = await client.query(`
            SELECT id, username, bet_value, win, win_amount, amount, odds
            FROM bet_history
            WHERE period = $1
            AND position = '10'
            AND bet_type = 'number'
            AND settled = true
            ORDER BY username, bet_value
        `, ['20250717412']);
        
        console.log(`\n找到 ${position10Bets.rows.length} 笔第10名的投注：`);
        
        let fixCount = 0;
        let totalRefund = 0;
        let totalPayout = 0;
        
        for (const bet of position10Bets.rows) {
            const shouldWin = parseInt(bet.bet_value) === actualPosition10;
            const isCorrect = bet.win === shouldWin;
            
            console.log(`\n用户 ${bet.username} 投注号码${bet.bet_value}：`);
            console.log(`- 当前状态：${bet.win ? '中奖' : '未中奖'}`);
            console.log(`- 正确状态：${shouldWin ? '应该中奖' : '不应该中奖'}`);
            
            if (!isCorrect) {
                console.log(`❌ 需要修正！`);
                
                if (bet.win && !shouldWin) {
                    // 错误中奖，需要退还奖金
                    console.log(`- 修正：从中奖改为未中奖`);
                    console.log(`- 退还奖金：${bet.win_amount}`);
                    
                    // 更新投注记录
                    await client.query(`
                        UPDATE bet_history
                        SET win = false, win_amount = 0
                        WHERE id = $1
                    `, [bet.id]);
                    
                    // 扣除用户余额（退还错误的奖金）
                    await client.query(`
                        UPDATE members
                        SET balance = balance - $1
                        WHERE username = $2
                    `, [bet.win_amount, bet.username]);
                    
                    // 记录交易
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
                        `修正期号${bet.period}结算错误-退还错误奖金`,
                        bet.period
                    ]);
                    
                    totalRefund += parseFloat(bet.win_amount);
                    fixCount++;
                    
                } else if (!bet.win && shouldWin) {
                    // 应该中奖但没中，需要补发奖金
                    const winAmount = parseFloat(bet.amount) * parseFloat(bet.odds);
                    console.log(`- 修正：从未中奖改为中奖`);
                    console.log(`- 补发奖金：${winAmount.toFixed(2)}`);
                    
                    // 更新投注记录
                    await client.query(`
                        UPDATE bet_history
                        SET win = true, win_amount = $1
                        WHERE id = $2
                    `, [winAmount.toFixed(2), bet.id]);
                    
                    // 增加用户余额
                    await client.query(`
                        UPDATE members
                        SET balance = balance + $1
                        WHERE username = $2
                    `, [winAmount, bet.username]);
                    
                    // 记录交易
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
                        `修正期号${bet.period}结算错误-补发奖金`,
                        bet.period
                    ]);
                    
                    totalPayout += winAmount;
                    fixCount++;
                }
            } else {
                console.log(`✅ 结算正确`);
            }
        }
        
        await client.query('COMMIT');
        
        console.log('\n📊 修正结果：');
        console.log(`修正了 ${fixCount} 笔投注`);
        console.log(`退还错误奖金：${totalRefund.toFixed(2)}`);
        console.log(`补发正确奖金：${totalPayout.toFixed(2)}`);
        console.log('\n✅ 修正完成！');
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('修正失败：', error);
        throw error;
    } finally {
        client.release();
    }
}

// 执行修正
fixPeriod412Settlement().then(() => {
    console.log('\n✅ 所有操作完成');
    process.exit(0);
}).catch(error => {
    console.error('❌ 错误：', error);
    process.exit(1);
});