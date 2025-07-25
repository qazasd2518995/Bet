// 分析期号 20250717362 的控制执行情况
import db from './db/config.js';
import { FixedDrawSystemManager } from './fixed-draw-system.js';

async function analyzePeriod362() {
    console.log('🔍 分析期号 20250717362 的控制执行情况\n');

    try {
        // 1. 查询该期的下注记录
        const bets = await db.manyOrNone(`
            SELECT * FROM bet_history 
            WHERE period = '20250717362'
            ORDER BY position, bet_value
        `);

        console.log('📊 下注情况：');
        console.log(`总下注数：${bets.length}`);
        
        // 分析每个位置的下注
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

        // 显示 justin111 的下注
        if (userBets['justin111']) {
            console.log('\n👤 justin111 的下注：');
            const justinBets = userBets['justin111'];
            const betNumbers = justinBets.map(b => b.betValue).sort((a, b) => a - b);
            console.log(`位置：第${justinBets[0].position}名`);
            console.log(`下注号码：${betNumbers.join(', ')}`);
            console.log(`覆盖率：${betNumbers.length}/10 = ${betNumbers.length * 10}%`);
            console.log(`未下注号码：${[1,2,3,4,5,6,7,8,9,10].filter(n => !betNumbers.includes(n.toString())).join(', ') || '无'}`);
        }

        // 2. 查询开奖结果
        const result = await db.oneOrNone(`
            SELECT * FROM result_history 
            WHERE period = '20250717362'
        `);

        if (result) {
            console.log('\n🎯 开奖结果：');
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

            // 检查 justin111 是否中奖
            if (userBets['justin111']) {
                const position5Result = result.position_5;
                const justinBetNumbers = userBets['justin111'].map(b => b.betValue);
                const isWin = justinBetNumbers.includes(position5Result.toString());
                console.log(`\n💰 justin111 ${isWin ? '中奖' : '未中奖'}（第5名开出：${position5Result}）`);
            }
        }

        // 3. 查询当时的控制设定
        const control = await db.oneOrNone(`
            SELECT * FROM win_loss_control
            WHERE target_username = 'justin111'
            AND is_active = true
            ORDER BY created_at DESC
            LIMIT 1
        `);

        if (control) {
            console.log('\n🎮 当时的控制设定：');
            console.log(`控制模式：${control.control_mode}`);
            console.log(`目标用户：${control.target_username}`);
            console.log(`控制百分比：${control.control_percentage}%`);
            console.log(`操作员：${control.operator_username}`);
        }

        // 4. 模拟控制系统的决策过程
        console.log('\n🔄 模拟控制系统决策过程：');
        
        // 模拟控制决策
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

        // 创建一个新的控制系统实例来模拟
        const drawSystem = new FixedDrawSystemManager();
        
        // 模拟 100 次看结果分布
        console.log('\n📈 模拟 100 次控制结果：');
        let winCount = 0;
        for (let i = 0; i < 100; i++) {
            const simulatedResult = await drawSystem.generateTargetMemberResult(
                '362-SIM',
                controlConfig,
                betAnalysis
            );
            
            const position5 = simulatedResult[4]; // 第5名结果
            const justinNumbers = userBets['justin111'].map(b => parseInt(b.betValue));
            if (justinNumbers.includes(position5)) {
                winCount++;
            }
        }

        console.log(`模拟中奖次数：${winCount}/100 = ${winCount}%`);
        console.log(`理论中奖率：10%（90%输控制）`);
        console.log(`实际可能中奖率：${userBets['justin111'].length * 10}%（因为覆盖率高）`);

        // 5. 分析为什么控制失效
        console.log('\n❌ 控制失效原因分析：');
        console.log('1. 用户下注覆盖率过高（90%），只有1个号码（号码1）未下注');
        console.log('2. 即使系统想让用户输，也只有10%机率能选到未下注的号码');
        console.log('3. 当覆盖率接近100%时，控制系统几乎无法有效执行');
        console.log('4. 建议：限制单一位置的最大下注数量，例如最多5-6个号码');

    } catch (error) {
        console.error('分析失败：', error);
    }
}

// 执行分析
analyzePeriod362().then(() => {
    console.log('\n✅ 分析完成');
    process.exit(0);
}).catch(error => {
    console.error('❌ 分析错误：', error);
    process.exit(1);
});