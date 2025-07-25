// check-period-20250717449.js - 檢查期號 20250717449 的結算錯誤
import db from './db/config.js';

async function checkPeriod449() {
    console.log('=== 檢查期號 20250717449 結算錯誤 ===\n');
    
    try {
        // 1. 檢查開獎結果
        console.log('1. 開獎結果:');
        const result = await db.oneOrNone(`
            SELECT 
                period,
                position_1, position_2, position_3, position_4, position_5,
                position_6, position_7, position_8, position_9, position_10,
                result,
                draw_time,
                created_at
            FROM result_history
            WHERE period = '20250717449'
        `);
        
        if (result) {
            console.log(`期號: ${result.period}`);
            console.log(`開獎時間: ${result.draw_time}`);
            console.log(`創建時間: ${result.created_at}`);
            console.log(`開獎結果:`);
            for (let i = 1; i <= 10; i++) {
                const pos = result[`position_${i}`];
                console.log(`  第${i}名: ${pos}號`);
            }
            console.log(`\n冠軍號碼: ${result.position_1} (${result.position_1 >= 6 ? '大' : '小'})`);
            console.log(`冠軍是1號，應該是小！`);
        } else {
            console.log('找不到該期開獎結果！');
        }
        
        // 2. 檢查相關投注
        console.log('\n2. 所有冠軍大小投注:');
        const bets = await db.manyOrNone(`
            SELECT 
                id, username, bet_type, bet_value, position,
                amount, odds, win, win_amount, settled,
                created_at, settled_at
            FROM bet_history
            WHERE period = '20250717449'
            AND (
                (bet_type = '冠軍' AND bet_value IN ('大', '小'))
                OR (bet_type = 'champion' AND bet_value IN ('big', 'small'))
            )
            ORDER BY created_at
        `);
        
        if (bets && bets.length > 0) {
            console.log(`找到 ${bets.length} 筆冠軍大小投注：`);
            for (const bet of bets) {
                const shouldWin = (bet.bet_value === '小' || bet.bet_value === 'small');
                const correct = bet.win === shouldWin;
                console.log(`\n${correct ? '✅' : '❌'} 投注ID: ${bet.id}`);
                console.log(`  用戶: ${bet.username}`);
                console.log(`  投注: ${bet.bet_type} ${bet.bet_value}`);
                console.log(`  金額: ${bet.amount}`);
                console.log(`  實際結果: ${bet.win ? '贏' : '輸'} (應該${shouldWin ? '贏' : '輸'})`);
                if (bet.win) {
                    console.log(`  派彩: ${bet.win_amount}`);
                }
                console.log(`  下注時間: ${bet.created_at}`);
                console.log(`  結算時間: ${bet.settled_at}`);
            }
        }
        
        // 3. 檢查結算日誌
        console.log('\n3. 結算日誌:');
        const logs = await db.manyOrNone(`
            SELECT 
                id, status, message, details, created_at
            FROM settlement_logs
            WHERE period = '20250717449'
            ORDER BY created_at
        `);
        
        if (logs && logs.length > 0) {
            console.log(`找到 ${logs.length} 筆結算日誌：`);
            for (const log of logs) {
                console.log(`\n日誌ID: ${log.id}`);
                console.log(`  狀態: ${log.status}`);
                console.log(`  訊息: ${log.message}`);
                if (log.details) {
                    try {
                        const details = JSON.parse(log.details);
                        console.log(`  詳情:`, details);
                    } catch (e) {
                        console.log(`  詳情: ${log.details}`);
                    }
                }
                console.log(`  時間: ${log.created_at}`);
            }
        }
        
        // 4. 檢查該期所有投注的結算情況
        console.log('\n4. 該期所有投注統計:');
        const stats = await db.oneOrNone(`
            SELECT 
                COUNT(*) as total_bets,
                SUM(CASE WHEN settled = true THEN 1 ELSE 0 END) as settled_count,
                SUM(CASE WHEN win = true THEN 1 ELSE 0 END) as win_count,
                SUM(win_amount) as total_payout
            FROM bet_history
            WHERE period = '20250717449'
        `);
        
        if (stats) {
            console.log(`總投注數: ${stats.total_bets}`);
            console.log(`已結算數: ${stats.settled_count}`);
            console.log(`中獎數: ${stats.win_count}`);
            console.log(`總派彩: ${stats.total_payout}`);
        }
        
        // 5. 檢查是否有多條開獎記錄
        console.log('\n5. 檢查開獎記錄數量:');
        const recordCount = await db.oneOrNone(`
            SELECT COUNT(*) as count
            FROM result_history
            WHERE period = '20250717449'
        `);
        
        console.log(`期號 20250717449 有 ${recordCount.count} 條開獎記錄`);
        
        if (recordCount.count > 1) {
            console.log('\n所有開獎記錄:');
            const allRecords = await db.manyOrNone(`
                SELECT id, position_1, draw_time, created_at
                FROM result_history
                WHERE period = '20250717449'
                ORDER BY created_at
            `);
            
            for (const rec of allRecords) {
                console.log(`  ID: ${rec.id}, 冠軍: ${rec.position_1}號, 開獎時間: ${rec.draw_time}, 創建時間: ${rec.created_at}`);
            }
        }
        
    } catch (error) {
        console.error('檢查失敗:', error);
    } finally {
        await db.$pool.end();
    }
}

checkPeriod449();