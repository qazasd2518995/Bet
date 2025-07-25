// 檢查期號 212 的投注和開獎結果問題
import db from './db/config.js';

async function checkPeriod212Issue() {
    console.log('🔍 檢查期號 20250717212 的投注和開獎結果\n');

    try {
        // 1. 查詢開獎結果
        console.log('📌 步驟1：查詢期號 20250717212 的開獎結果...');
        const drawResult = await db.oneOrNone(`
            SELECT 
                period,
                result,
                position_1, position_2, position_3, position_4, position_5,
                position_6, position_7, position_8, position_9, position_10,
                draw_time
            FROM result_history
            WHERE period = '20250717212'
        `);

        if (drawResult) {
            console.log('\n開獎結果：');
            console.log(`期號：${drawResult.period}`);
            console.log(`開獎時間：${new Date(drawResult.draw_time).toLocaleString()}`);
            console.log(`完整結果：${JSON.stringify(drawResult.result)}`);
            console.log('\n各名次號碼：');
            console.log(`第1名：${drawResult.position_1}`);
            console.log(`第2名：${drawResult.position_2}`);
            console.log(`第3名：${drawResult.position_3}`);
            console.log(`第4名：${drawResult.position_4}`);
            console.log(`第5名：${drawResult.position_5}`);
            console.log(`第6名：${drawResult.position_6}`);
            console.log(`第7名：${drawResult.position_7}`);
            console.log(`第8名：${drawResult.position_8}`);
            console.log(`第9名：${drawResult.position_9}`);
            console.log(`第10名：${drawResult.position_10} ⭐`);
        } else {
            console.log('❌ 找不到期號 20250717212 的開獎結果');
        }

        // 2. 查詢相關投注記錄
        console.log('\n📌 步驟2：查詢期號 20250717212 的投注記錄...');
        const bets = await db.manyOrNone(`
            SELECT 
                id,
                username,
                period,
                bet_type,
                bet_value,
                position,
                amount,
                odds,
                win,
                win_amount,
                settled,
                created_at
            FROM bet_history
            WHERE period = '20250717212'
            AND username = 'justin111'
            ORDER BY created_at
        `);

        if (bets.length > 0) {
            console.log(`\n找到 ${bets.length} 筆投注記錄：`);
            bets.forEach((bet, index) => {
                console.log(`\n投注 ${index + 1}：`);
                console.log(`- ID：${bet.id}`);
                console.log(`- 用戶：${bet.username}`);
                console.log(`- 期號：${bet.period}`);
                console.log(`- 投注類型：${bet.bet_type}`);
                console.log(`- 投注值：${bet.bet_value}`);
                console.log(`- 位置：${bet.position}`);
                console.log(`- 金額：${bet.amount}`);
                console.log(`- 賠率：${bet.odds}`);
                console.log(`- 是否中獎：${bet.win ? '是' : '否'}`);
                console.log(`- 中獎金額：${bet.win_amount || 0}`);
                console.log(`- 已結算：${bet.settled ? '是' : '否'}`);
            });
        }

        // 3. 分析問題
        console.log('\n📌 步驟3：分析問題...');
        
        // 找出第10名投注號碼5的記錄
        const position10Bet5 = bets.find(bet => 
            bet.position === '10' && 
            bet.bet_value === '5' && 
            bet.bet_type === 'number'
        );

        if (position10Bet5 && drawResult) {
            console.log('\n🎯 問題分析：');
            console.log(`用戶投注：第10名 號碼5`);
            console.log(`實際開獎：第10名 號碼${drawResult.position_10}`);
            console.log(`投注結果：${position10Bet5.win ? '中獎' : '未中獎'}`);
            console.log(`中獎金額：${position10Bet5.win_amount || 0}`);
            
            if (drawResult.position_10 === 10 && position10Bet5.bet_value === '5') {
                console.log('\n❌ 發現問題：');
                console.log('- 用戶投注第10名號碼5');
                console.log('- 實際開出第10名號碼10');
                console.log('- 理論上應該未中獎，但系統判定為中獎');
                console.log('\n這是一個結算錯誤！需要修正。');
            }
        }

        // 4. 查詢所有第10名的投注
        console.log('\n📌 步驟4：查詢所有第10名的投注...');
        const position10Bets = bets.filter(bet => bet.position === '10');
        if (position10Bets.length > 0) {
            console.log(`\n第10名的所有投注（共${position10Bets.length}筆）：`);
            position10Bets.forEach(bet => {
                const shouldWin = drawResult && parseInt(bet.bet_value) === drawResult.position_10;
                console.log(`- 投注號碼${bet.bet_value}：${bet.win ? '中獎' : '未中獎'} ${shouldWin ? '✓正確' : '✗錯誤'}`);
            });
        }

        // 5. 查詢可能混淆的期號
        console.log('\n📌 步驟5：查詢可能混淆的期號...');
        const similarPeriods = await db.manyOrNone(`
            SELECT period, position_10
            FROM result_history
            WHERE period LIKE '20250717_12'
            ORDER BY period
        `);

        if (similarPeriods.length > 0) {
            console.log('\n相似期號的第10名開獎結果：');
            similarPeriods.forEach(p => {
                console.log(`期號 ${p.period}：第10名 = ${p.position_10}`);
            });
        }

    } catch (error) {
        console.error('檢查失敗：', error);
    }
}

// 執行檢查
checkPeriod212Issue().then(() => {
    console.log('\n✅ 檢查完成');
    process.exit(0);
}).catch(error => {
    console.error('❌ 錯誤：', error);
    process.exit(1);
});