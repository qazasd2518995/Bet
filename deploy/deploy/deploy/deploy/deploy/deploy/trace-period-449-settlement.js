// trace-period-449-settlement.js - 追蹤期號 20250717449 的結算過程
import db from './db/config.js';

async function tracePeriod449Settlement() {
    console.log('=== 追蹤期號 20250717449 的結算過程 ===\n');
    
    try {
        // 1. 時間線分析
        console.log('1. 時間線分析:');
        
        // 獲取開獎記錄的所有時間
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
            console.log(`開獎記錄ID: ${drawRecord.id}`);
            console.log(`期號: ${drawRecord.period}`);
            console.log(`冠軍: ${drawRecord.position_1}號`);
            console.log(`開獎時間(draw_time): ${drawRecord.draw_time}`);
            console.log(`記錄創建時間: ${drawRecord.created_at}`);
        }
        
        // 獲取投注和結算時間
        console.log('\n2. 投注ID 3321 的詳細時間線:');
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
            console.log(`投注創建時間: ${bet.created_at}`);
            console.log(`結算時間: ${bet.settled_at}`);
            console.log(`結算結果: ${bet.win ? '贏' : '輸'}`);
            console.log(`派彩金額: ${bet.win_amount}`);
            
            // 計算時間差
            const betTime = new Date(bet.created_at);
            const settleTime = new Date(bet.settled_at);
            const drawTime = new Date(drawRecord.draw_time);
            
            console.log('\n時間差計算:');
            console.log(`下注到結算: ${((settleTime - betTime) / 1000).toFixed(1)} 秒`);
            console.log(`開獎到結算: ${((settleTime - drawTime) / 1000).toFixed(1)} 秒`);
            
            // 注意：如果結算時間早於開獎時間，說明可能有問題
            if (settleTime < drawTime) {
                console.log('⚠️ 警告：結算時間早於開獎時間！');
            }
        }
        
        // 3. 檢查是否有多次結算記錄
        console.log('\n3. 檢查交易記錄:');
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
            console.log(`找到 ${transactions.length} 筆相關交易記錄:`);
            for (const tx of transactions) {
                console.log(`\n交易ID: ${tx.id}`);
                console.log(`  類型: ${tx.transaction_type}`);
                console.log(`  金額: ${tx.amount}`);
                console.log(`  餘額變化: ${tx.balance_before} -> ${tx.balance_after}`);
                console.log(`  描述: ${tx.description}`);
                console.log(`  時間: ${tx.created_at}`);
            }
        }
        
        // 4. 檢查該用戶的所有冠軍大小投注歷史
        console.log('\n4. 用戶 justin111 的冠軍大小投注歷史:');
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
            AND ((bh.bet_type = '冠軍' AND bh.bet_value IN ('大', '小'))
                OR (bh.bet_type = 'champion' AND bh.bet_value IN ('big', 'small')))
            ORDER BY bh.period DESC
            LIMIT 10
        `);
        
        if (userBets.length > 0) {
            console.log(`最近 ${userBets.length} 筆投注:`);
            for (const b of userBets) {
                const champion = b.position_1;
                const shouldBig = champion >= 6;
                const betBig = (b.bet_value === '大' || b.bet_value === 'big');
                const shouldWin = (betBig && shouldBig) || (!betBig && !shouldBig);
                const correct = b.win === shouldWin;
                
                console.log(`${correct ? '✅' : '❌'} 期號: ${b.period}, 投注: ${b.bet_value}, 冠軍: ${champion}號, 結果: ${b.win ? '贏' : '輸'} (應該${shouldWin ? '贏' : '輸'})`);
            }
        }
        
    } catch (error) {
        console.error('追蹤失敗:', error);
    } finally {
        await db.$pool.end();
    }
}

tracePeriod449Settlement();