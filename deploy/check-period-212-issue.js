// 检查期号 212 的投注和开奖结果问题
import db from './db/config.js';

async function checkPeriod212Issue() {
    console.log('🔍 检查期号 20250717212 的投注和开奖结果\n');

    try {
        // 1. 查询开奖结果
        console.log('📌 步骤1：查询期号 20250717212 的开奖结果...');
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
            console.log('\n开奖结果：');
            console.log(`期号：${drawResult.period}`);
            console.log(`开奖时间：${new Date(drawResult.draw_time).toLocaleString()}`);
            console.log(`完整结果：${JSON.stringify(drawResult.result)}`);
            console.log('\n各名次号码：');
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
            console.log('❌ 找不到期号 20250717212 的开奖结果');
        }

        // 2. 查询相关投注记录
        console.log('\n📌 步骤2：查询期号 20250717212 的投注记录...');
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
            console.log(`\n找到 ${bets.length} 笔投注记录：`);
            bets.forEach((bet, index) => {
                console.log(`\n投注 ${index + 1}：`);
                console.log(`- ID：${bet.id}`);
                console.log(`- 用户：${bet.username}`);
                console.log(`- 期号：${bet.period}`);
                console.log(`- 投注类型：${bet.bet_type}`);
                console.log(`- 投注值：${bet.bet_value}`);
                console.log(`- 位置：${bet.position}`);
                console.log(`- 金额：${bet.amount}`);
                console.log(`- 赔率：${bet.odds}`);
                console.log(`- 是否中奖：${bet.win ? '是' : '否'}`);
                console.log(`- 中奖金额：${bet.win_amount || 0}`);
                console.log(`- 已结算：${bet.settled ? '是' : '否'}`);
            });
        }

        // 3. 分析问题
        console.log('\n📌 步骤3：分析问题...');
        
        // 找出第10名投注号码5的记录
        const position10Bet5 = bets.find(bet => 
            bet.position === '10' && 
            bet.bet_value === '5' && 
            bet.bet_type === 'number'
        );

        if (position10Bet5 && drawResult) {
            console.log('\n🎯 问题分析：');
            console.log(`用户投注：第10名 号码5`);
            console.log(`实际开奖：第10名 号码${drawResult.position_10}`);
            console.log(`投注结果：${position10Bet5.win ? '中奖' : '未中奖'}`);
            console.log(`中奖金额：${position10Bet5.win_amount || 0}`);
            
            if (drawResult.position_10 === 10 && position10Bet5.bet_value === '5') {
                console.log('\n❌ 发现问题：');
                console.log('- 用户投注第10名号码5');
                console.log('- 实际开出第10名号码10');
                console.log('- 理论上应该未中奖，但系统判定为中奖');
                console.log('\n这是一个结算错误！需要修正。');
            }
        }

        // 4. 查询所有第10名的投注
        console.log('\n📌 步骤4：查询所有第10名的投注...');
        const position10Bets = bets.filter(bet => bet.position === '10');
        if (position10Bets.length > 0) {
            console.log(`\n第10名的所有投注（共${position10Bets.length}笔）：`);
            position10Bets.forEach(bet => {
                const shouldWin = drawResult && parseInt(bet.bet_value) === drawResult.position_10;
                console.log(`- 投注号码${bet.bet_value}：${bet.win ? '中奖' : '未中奖'} ${shouldWin ? '✓正确' : '✗错误'}`);
            });
        }

        // 5. 查询可能混淆的期号
        console.log('\n📌 步骤5：查询可能混淆的期号...');
        const similarPeriods = await db.manyOrNone(`
            SELECT period, position_10
            FROM result_history
            WHERE period LIKE '20250717_12'
            ORDER BY period
        `);

        if (similarPeriods.length > 0) {
            console.log('\n相似期号的第10名开奖结果：');
            similarPeriods.forEach(p => {
                console.log(`期号 ${p.period}：第10名 = ${p.position_10}`);
            });
        }

    } catch (error) {
        console.error('检查失败：', error);
    }
}

// 执行检查
checkPeriod212Issue().then(() => {
    console.log('\n✅ 检查完成');
    process.exit(0);
}).catch(error => {
    console.error('❌ 错误：', error);
    process.exit(1);
});