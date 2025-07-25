// trace-period-449-settlement.js - 追踪期号 20250717449 的结算过程
import db from './db/config.js';

async function tracePeriod449Settlement() {
    console.log('=== 追踪期号 20250717449 的结算过程 ===\n');
    
    try {
        // 1. 时间线分析
        console.log('1. 时间线分析:');
        
        // 获取开奖记录的所有时间
        const drawRecord = await db.oneOrNone(`
            SELECT 
                id,
                period,
                position_1,
                draw_time,
                created_at
            FROM result_history
            WHERE period = '20250717449'
        `);
        
        if (drawRecord) {
            console.log(`开奖记录ID: ${drawRecord.id}`);
            console.log(`期号: ${drawRecord.period}`);
            console.log(`冠军: ${drawRecord.position_1}号`);
            console.log(`开奖时间(draw_time): ${drawRecord.draw_time}`);
            console.log(`记录创建时间: ${drawRecord.created_at}`);
        }
        
        // 获取投注和结算时间
        console.log('\n2. 投注ID 3321 的详细时间线:');
        const bet = await db.oneOrNone(`
            SELECT 
                id,
                username,
                bet_type,
                bet_value,
                amount,
                win,
                win_amount,
                settled,
                created_at,
                settled_at
            FROM bet_history
            WHERE id = 3321
        `);
        
        if (bet) {
            console.log(`投注创建时间: ${bet.created_at}`);
            console.log(`结算时间: ${bet.settled_at}`);
            console.log(`结算结果: ${bet.win ? '赢' : '输'}`);
            console.log(`派彩金额: ${bet.win_amount}`);
            
            // 计算时间差
            const betTime = new Date(bet.created_at);
            const settleTime = new Date(bet.settled_at);
            const drawTime = new Date(drawRecord.draw_time);
            
            console.log('\n时间差计算:');
            console.log(`下注到结算: ${((settleTime - betTime) / 1000).toFixed(1)} 秒`);
            console.log(`开奖到结算: ${((settleTime - drawTime) / 1000).toFixed(1)} 秒`);
            
            // 注意：如果结算时间早于开奖时间，说明可能有问题
            if (settleTime < drawTime) {
                console.log('⚠️ 警告：结算时间早于开奖时间！');
            }
        }
        
        // 3. 检查是否有多次结算记录
        console.log('\n3. 检查交易记录:');
        const transactions = await db.manyOrNone(`
            SELECT 
                id,
                user_type,
                user_id,
                transaction_type,
                amount,
                balance_before,
                balance_after,
                description,
                created_at
            FROM transaction_records
            WHERE description LIKE '%3321%'
            OR (description LIKE '%20250717449%' AND transaction_type = 'win')
            ORDER BY created_at
        `);
        
        if (transactions.length > 0) {
            console.log(`找到 ${transactions.length} 笔相关交易记录:`);
            for (const tx of transactions) {
                console.log(`\n交易ID: ${tx.id}`);
                console.log(`  类型: ${tx.transaction_type}`);
                console.log(`  金额: ${tx.amount}`);
                console.log(`  余额变化: ${tx.balance_before} -> ${tx.balance_after}`);
                console.log(`  描述: ${tx.description}`);
                console.log(`  时间: ${tx.created_at}`);
            }
        }
        
        // 4. 检查该用户的所有冠军大小投注历史
        console.log('\n4. 用户 justin111 的冠军大小投注历史:');
        const userBets = await db.manyOrNone(`
            SELECT 
                bh.id,
                bh.period,
                bh.bet_value,
                bh.win,
                bh.win_amount,
                rh.position_1
            FROM bet_history bh
            LEFT JOIN result_history rh ON bh.period = rh.period
            WHERE bh.username = 'justin111'
            AND ((bh.bet_type = '冠军' AND bh.bet_value IN ('大', '小'))
                OR (bh.bet_type = 'champion' AND bh.bet_value IN ('big', 'small')))
            ORDER BY bh.period DESC
            LIMIT 10
        `);
        
        if (userBets.length > 0) {
            console.log(`最近 ${userBets.length} 笔投注:`);
            for (const b of userBets) {
                const champion = b.position_1;
                const shouldBig = champion >= 6;
                const betBig = (b.bet_value === '大' || b.bet_value === 'big');
                const shouldWin = (betBig && shouldBig) || (!betBig && !shouldBig);
                const correct = b.win === shouldWin;
                
                console.log(`${correct ? '✅' : '❌'} 期号: ${b.period}, 投注: ${b.bet_value}, 冠军: ${champion}号, 结果: ${b.win ? '赢' : '输'} (应该${shouldWin ? '赢' : '输'})`);
            }
        }
        
    } catch (error) {
        console.error('追踪失败:', error);
    } finally {
        await db.$pool.end();
    }
}

tracePeriod449Settlement();