// analyze-period-630-bets.js - 分析期號 20250717630 的下注問題
import db from './db/config.js';

async function analyzePeriod630() {
    try {
        console.log('分析期號 20250717630 的下注問題...\n');
        
        const period = '20250717630';
        
        // 1. 檢查期號的數據類型
        console.log('1. 檢查 period 字段的數據類型:');
        const columnInfo = await db.one(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'bet_history' AND column_name = 'period'
        `);
        console.log('   數據類型:', columnInfo.data_type);
        
        // 2. 使用不同方式查詢
        console.log('\n2. 使用不同方式查詢期號 20250717630:');
        
        // 方式1: 直接數字
        const bets1 = await db.manyOrNone(`
            SELECT COUNT(*) as count FROM bet_history WHERE period = 20250717630
        `);
        console.log('   直接數字查詢:', bets1[0].count, '筆');
        
        // 方式2: 字符串參數
        const bets2 = await db.manyOrNone(`
            SELECT COUNT(*) as count FROM bet_history WHERE period = $1
        `, [period]);
        console.log('   字符串參數查詢:', bets2[0].count, '筆');
        
        // 方式3: 數字參數
        const bets3 = await db.manyOrNone(`
            SELECT COUNT(*) as count FROM bet_history WHERE period = $1
        `, [parseInt(period)]);
        console.log('   數字參數查詢:', bets3[0].count, '筆');
        
        // 3. 模擬 analyzePeriodBets 的查詢
        console.log('\n3. 模擬 analyzePeriodBets 函數的查詢:');
        const allBets = await db.manyOrNone(`
            SELECT bet_type, bet_value, position, amount, username
            FROM bet_history 
            WHERE period = $1 AND settled = false
        `, [period]);
        
        console.log(`   找到 ${allBets.length} 筆未結算的下注`);
        
        // 4. 檢查所有下注的結算狀態
        console.log('\n4. 檢查期號 20250717630 的所有下注:');
        const allBetsDetail = await db.manyOrNone(`
            SELECT id, username, bet_type, position, bet_value, amount, settled, created_at
            FROM bet_history 
            WHERE period = $1
            ORDER BY id
        `, [period]);
        
        console.log(`   總共 ${allBetsDetail.length} 筆下注:`);
        allBetsDetail.forEach((bet, index) => {
            console.log(`   ${index + 1}. ID:${bet.id}, 用戶:${bet.username}, ` +
                       `第${bet.position}名${bet.bet_value}號, ` +
                       `金額:${bet.amount}, 已結算:${bet.settled}, ` +
                       `創建時間:${bet.created_at.toLocaleString('zh-TW')}`);
        });
        
        // 5. 統計結算狀態
        const settledCount = allBetsDetail.filter(b => b.settled).length;
        const unsettledCount = allBetsDetail.filter(b => !b.settled).length;
        console.log(`\n   結算統計: 已結算 ${settledCount} 筆, 未結算 ${unsettledCount} 筆`);
        
        // 6. 檢查是否有結算時間問題
        console.log('\n5. 檢查時間問題:');
        const latestBet = await db.oneOrNone(`
            SELECT MAX(created_at) as latest_time 
            FROM bet_history 
            WHERE period = $1
        `, [period]);
        
        const drawResult = await db.oneOrNone(`
            SELECT draw_time 
            FROM result_history 
            WHERE period = $1
        `, [period]);
        
        if (latestBet && latestBet.latest_time) {
            console.log('   最後下注時間:', latestBet.latest_time.toLocaleString('zh-TW'));
        }
        if (drawResult && drawResult.draw_time) {
            console.log('   開獎時間:', drawResult.draw_time.toLocaleString('zh-TW'));
            
            if (latestBet && latestBet.latest_time && drawResult.draw_time < latestBet.latest_time) {
                console.log('   ⚠️  警告: 開獎時間早於最後下注時間！');
            }
        }
        
        // 7. 找出問題原因
        console.log('\n\n問題分析結論:');
        if (unsettledCount === allBetsDetail.length) {
            console.log('❌ 所有下注都是未結算狀態 (settled = false)');
            console.log('   這就是為什麼 analyzePeriodBets 查詢 "settled = false" 時會返回 0 筆');
            console.log('   可能原因:');
            console.log('   1. 下注在開獎查詢時還未保存到數據庫');
            console.log('   2. 開獎時機太早，在下注完成前就執行了');
            console.log('   3. 批量下注的事務還未提交');
        } else if (settledCount > 0) {
            console.log('✅ 有部分下注已結算，可能是時序問題');
        }
        
    } catch (error) {
        console.error('分析錯誤:', error);
    } finally {
        process.exit();
    }
}

analyzePeriod630();