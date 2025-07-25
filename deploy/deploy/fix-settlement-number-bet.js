// 修復號碼投注結算邏輯
import db from './db/config.js';

async function analyzeAndFixNumberBetLogic() {
    console.log('🔍 分析號碼投注結算邏輯問題\n');

    try {
        // 1. 檢查期號 412 的詳細數據
        console.log('📌 步驟1：檢查期號 20250717412 的數據類型...');
        const period412Data = await db.oneOrNone(`
            SELECT 
                period,
                result,
                position_1, position_2, position_3, position_4, position_5,
                position_6, position_7, position_8, position_9, position_10,
                pg_typeof(position_10) as position_10_type,
                position_10::text as position_10_text
            FROM result_history
            WHERE period = '20250717412'
        `);

        if (period412Data) {
            console.log('開獎數據：');
            console.log(`- position_10 值：${period412Data.position_10}`);
            console.log(`- position_10 類型：${period412Data.position_10_type}`);
            console.log(`- position_10 文本：${period412Data.position_10_text}`);
            console.log(`- result 陣列：${JSON.stringify(period412Data.result)}`);
        }

        // 2. 檢查投注數據
        console.log('\n📌 步驟2：檢查投注數據類型...');
        const betData = await db.manyOrNone(`
            SELECT 
                id,
                bet_value,
                pg_typeof(bet_value) as bet_value_type,
                position,
                pg_typeof(position) as position_type,
                win
            FROM bet_history
            WHERE period = '20250717412'
            AND username = 'justin111'
            AND position = '10'
            AND bet_type = 'number'
            ORDER BY bet_value
        `);

        console.log(`\n找到 ${betData.length} 筆投注：`);
        betData.forEach(bet => {
            console.log(`\nID ${bet.id}:`);
            console.log(`- bet_value: "${bet.bet_value}" (類型: ${bet.bet_value_type})`);
            console.log(`- position: "${bet.position}" (類型: ${bet.position_type})`);
            console.log(`- 中獎狀態: ${bet.win}`);
        });

        // 3. 模擬結算邏輯
        console.log('\n📌 步驟3：模擬結算邏輯...');
        if (period412Data && betData.length > 0) {
            const winningNumber = period412Data.position_10;
            console.log(`\n第10名開獎號碼：${winningNumber}`);
            
            betData.forEach(bet => {
                console.log(`\n測試投注 ${bet.bet_value}：`);
                
                // 各種比較方式
                const test1 = bet.bet_value == winningNumber;
                const test2 = bet.bet_value === winningNumber;
                const test3 = parseInt(bet.bet_value) === parseInt(winningNumber);
                const test4 = bet.bet_value === winningNumber.toString();
                const test5 = bet.bet_value == winningNumber.toString();
                
                console.log(`- bet.bet_value == winningNumber: ${test1}`);
                console.log(`- bet.bet_value === winningNumber: ${test2}`);
                console.log(`- parseInt(bet.bet_value) === parseInt(winningNumber): ${test3}`);
                console.log(`- bet.bet_value === winningNumber.toString(): ${test4}`);
                console.log(`- bet.bet_value == winningNumber.toString(): ${test5}`);
                console.log(`- 實際中獎狀態: ${bet.win}`);
                
                const shouldWin = test3; // 使用 parseInt 比較
                if (bet.win !== shouldWin) {
                    console.log(`❌ 錯誤！應該是 ${shouldWin}`);
                }
            });
        }

        // 4. 檢查可能的數據污染
        console.log('\n📌 步驟4：檢查數據是否有隱藏字符...');
        const suspiciousBets = await db.manyOrNone(`
            SELECT 
                id,
                bet_value,
                LENGTH(bet_value) as value_length,
                position,
                LENGTH(position) as position_length
            FROM bet_history
            WHERE period = '20250717412'
            AND username = 'justin111'
            AND position = '10'
            AND bet_type = 'number'
            AND (LENGTH(bet_value) > 2 OR LENGTH(position) > 2)
        `);

        if (suspiciousBets.length > 0) {
            console.log('\n⚠️ 發現可疑數據：');
            suspiciousBets.forEach(bet => {
                console.log(`- ID ${bet.id}: bet_value="${bet.bet_value}" (長度:${bet.value_length}), position="${bet.position}" (長度:${bet.position_length})`);
            });
        }

        // 5. 提供修復建議
        console.log('\n📌 步驟5：修復建議...');
        console.log('\n建議修改 enhanced-settlement-system.js 的第299-300行：');
        console.log(`
原代碼：
const isWin = parseInt(winningNumber) === parseInt(betNumber);

建議改為：
// 確保移除任何空白字符並進行嚴格的數字比較
const cleanWinningNumber = String(winningNumber).trim();
const cleanBetNumber = String(betNumber).trim();
const isWin = parseInt(cleanWinningNumber, 10) === parseInt(cleanBetNumber, 10);

// 添加調試日誌
if (bet.id) {
    settlementLog.info(\`號碼比較: 開獎=\${cleanWinningNumber}(轉換後:\${parseInt(cleanWinningNumber, 10)}), 投注=\${cleanBetNumber}(轉換後:\${parseInt(cleanBetNumber, 10)}), 結果=\${isWin}\`);
}
`);

    } catch (error) {
        console.error('分析失敗：', error);
    }
}

// 執行分析
analyzeAndFixNumberBetLogic().then(() => {
    console.log('\n✅ 分析完成');
    process.exit(0);
}).catch(error => {
    console.error('❌ 錯誤：', error);
    process.exit(1);
});