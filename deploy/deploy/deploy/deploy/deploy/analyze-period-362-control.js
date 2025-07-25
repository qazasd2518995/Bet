// 分析期號 20250717362 的控制執行情況
import db from './db/config.js';
import { FixedDrawSystemManager } from './fixed-draw-system.js';

async function analyzePeriod362() {
    console.log('🔍 分析期號 20250717362 的控制執行情況\n');

    try {
        // 1. 查詢該期的下注記錄
        const bets = await db.manyOrNone(`
            SELECT * FROM bet_history 
            WHERE period = '20250717362'
            ORDER BY position, bet_value
        `);

        console.log('📊 下注情況：');
        console.log(`總下注數：${bets.length}`);
        
        // 分析每個位置的下注
        const positionBets = {};
        const userBets = {};
        
        bets.forEach(bet => {
            const username = bet.username;
            const position = bet.position;
            const betValue = bet.bet_value;
            const amount = parseFloat(bet.amount);

            if (!userBets[username]) {
                userBets[username] = [];
            }
            userBets[username].push({
                betType: bet.bet_type,
                betValue: betValue,
                position: position,
                amount: amount
            });

            if (bet.bet_type === 'number' && position) {
                if (!positionBets[position]) {
                    positionBets[position] = {};
                }
                if (!positionBets[position][betValue]) {
                    positionBets[position][betValue] = 0;
                }
                positionBets[position][betValue] += amount;
            }
        });

        // 顯示 justin111 的下注
        if (userBets['justin111']) {
            console.log('\n👤 justin111 的下注：');
            const justinBets = userBets['justin111'];
            const betNumbers = justinBets.map(b => b.betValue).sort((a, b) => a - b);
            console.log(`位置：第${justinBets[0].position}名`);
            console.log(`下注號碼：${betNumbers.join(', ')}`);
            console.log(`覆蓋率：${betNumbers.length}/10 = ${betNumbers.length * 10}%`);
            console.log(`未下注號碼：${[1,2,3,4,5,6,7,8,9,10].filter(n => !betNumbers.includes(n.toString())).join(', ') || '無'}`);
        }

        // 2. 查詢開獎結果
        const result = await db.oneOrNone(`
            SELECT * FROM result_history 
            WHERE period = '20250717362'
        `);

        if (result) {
            console.log('\n🎯 開獎結果：');
            console.log(`第1名：${result.position_1}`);
            console.log(`第2名：${result.position_2}`);
            console.log(`第3名：${result.position_3}`);
            console.log(`第4名：${result.position_4}`);
            console.log(`第5名：${result.position_5} ⭐`);
            console.log(`第6名：${result.position_6}`);
            console.log(`第7名：${result.position_7}`);
            console.log(`第8名：${result.position_8}`);
            console.log(`第9名：${result.position_9}`);
            console.log(`第10名：${result.position_10}`);

            // 檢查 justin111 是否中獎
            if (userBets['justin111']) {
                const position5Result = result.position_5;
                const justinBetNumbers = userBets['justin111'].map(b => b.betValue);
                const isWin = justinBetNumbers.includes(position5Result.toString());
                console.log(`\n💰 justin111 ${isWin ? '中獎' : '未中獎'}（第5名開出：${position5Result}）`);
            }
        }

        // 3. 查詢當時的控制設定
        const control = await db.oneOrNone(`
            SELECT * FROM win_loss_control
            WHERE target_username = 'justin111'
            AND is_active = true
            ORDER BY created_at DESC
            LIMIT 1
        `);

        if (control) {
            console.log('\n🎮 當時的控制設定：');
            console.log(`控制模式：${control.control_mode}`);
            console.log(`目標用戶：${control.target_username}`);
            console.log(`控制百分比：${control.control_percentage}%`);
            console.log(`操作員：${control.operator_username}`);
        }

        // 4. 模擬控制系統的決策過程
        console.log('\n🔄 模擬控制系統決策過程：');
        
        // 模擬控制決策
        const controlConfig = {
            mode: 'single_member',
            enabled: true,
            target_username: 'justin111',
            control_percentage: '90'
        };

        const betAnalysis = {
            totalAmount: 9,
            betCount: 9,
            userBets: userBets,
            positionBets: positionBets,
            platformRisk: 1
        };

        // 創建一個新的控制系統實例來模擬
        const drawSystem = new FixedDrawSystemManager();
        
        // 模擬 100 次看結果分布
        console.log('\n📈 模擬 100 次控制結果：');
        let winCount = 0;
        for (let i = 0; i < 100; i++) {
            const simulatedResult = await drawSystem.generateTargetMemberResult(
                '362-SIM',
                controlConfig,
                betAnalysis
            );
            
            const position5 = simulatedResult[4]; // 第5名結果
            const justinNumbers = userBets['justin111'].map(b => parseInt(b.betValue));
            if (justinNumbers.includes(position5)) {
                winCount++;
            }
        }

        console.log(`模擬中獎次數：${winCount}/100 = ${winCount}%`);
        console.log(`理論中獎率：10%（90%輸控制）`);
        console.log(`實際可能中獎率：${userBets['justin111'].length * 10}%（因為覆蓋率高）`);

        // 5. 分析為什麼控制失效
        console.log('\n❌ 控制失效原因分析：');
        console.log('1. 用戶下注覆蓋率過高（90%），只有1個號碼（號碼1）未下注');
        console.log('2. 即使系統想讓用戶輸，也只有10%機率能選到未下注的號碼');
        console.log('3. 當覆蓋率接近100%時，控制系統幾乎無法有效執行');
        console.log('4. 建議：限制單一位置的最大下注數量，例如最多5-6個號碼');

    } catch (error) {
        console.error('分析失敗：', error);
    }
}

// 執行分析
analyzePeriod362().then(() => {
    console.log('\n✅ 分析完成');
    process.exit(0);
}).catch(error => {
    console.error('❌ 分析錯誤：', error);
    process.exit(1);
});