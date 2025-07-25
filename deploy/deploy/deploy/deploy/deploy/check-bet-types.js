// check-bet-types.js - 檢查下注類型
import db from './db/config.js';

async function checkBetTypes() {
    console.log('🔍 檢查下注類型...\n');
    
    try {
        // 1. 查看所有不同的 bet_type
        console.log('1️⃣ 所有的 bet_type 類型:');
        const betTypes = await db.any(`
            SELECT DISTINCT bet_type, COUNT(*) as count
            FROM bet_history
            GROUP BY bet_type
            ORDER BY count DESC
        `);
        
        betTypes.forEach(type => {
            console.log(`  ${type.bet_type}: ${type.count} 筆`);
        });
        
        // 2. 查看 champion 類型的下注
        console.log('\n2️⃣ champion 類型的下注範例:');
        const championBets = await db.any(`
            SELECT 
                id,
                username,
                bet_type,
                bet_value,
                position,
                amount,
                odds,
                win,
                win_amount,
                period
            FROM bet_history
            WHERE bet_type = 'champion'
            ORDER BY created_at DESC
            LIMIT 5
        `);
        
        championBets.forEach(bet => {
            console.log(`\nID: ${bet.id}`);
            console.log(`  期號: ${bet.period}`);
            console.log(`  用戶: ${bet.username}`);
            console.log(`  類型: ${bet.bet_type}`);
            console.log(`  值: ${bet.bet_value}`);
            console.log(`  位置: ${bet.position}`);
            console.log(`  金額: ${bet.amount}`);
            console.log(`  賠率: ${bet.odds}`);
            console.log(`  中獎: ${bet.win ? '是' : '否'}`);
        });
        
        // 3. 分析 bet_type 和 position 的關係
        console.log('\n3️⃣ bet_type 和 position 的關係:');
        const typePositionRelation = await db.any(`
            SELECT 
                bet_type,
                position,
                COUNT(*) as count
            FROM bet_history
            WHERE bet_type IN ('champion', 'number', 'first', 'second')
            GROUP BY bet_type, position
            ORDER BY bet_type, position
            LIMIT 20
        `);
        
        let currentType = '';
        typePositionRelation.forEach(rel => {
            if (rel.bet_type !== currentType) {
                currentType = rel.bet_type;
                console.log(`\n${currentType}:`);
            }
            console.log(`  position ${rel.position}: ${rel.count} 筆`);
        });
        
        // 4. 檢查結算邏輯對應
        console.log('\n4️⃣ 結算邏輯分析:');
        console.log('根據 checkWin 函數:');
        console.log('  - "number" 類型使用 position 欄位判斷位置');
        console.log('  - "champion" 類型沒有處理邏輯');
        console.log('\n可能的解決方案:');
        console.log('  1. 將 "champion" 映射為 "number" + position=1');
        console.log('  2. 在 checkWin 中添加 "champion" 的處理邏輯');
        console.log('  3. 統一使用位置名稱作為 bet_type（first, second, third...）');
        
    } catch (error) {
        console.error('❌ 檢查過程中發生錯誤:', error);
    }
}

// 執行
checkBetTypes()
    .then(() => {
        console.log('\n檢查完成');
        process.exit(0);
    })
    .catch(error => {
        console.error('執行失敗:', error);
        process.exit(1);
    });