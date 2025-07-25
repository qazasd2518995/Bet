// 分析期号 20250717375 的开奖情况和权重日志
import db from './db/config.js';

async function analyzePeriod375() {
    console.log('🔍 分析期号 20250717375 的开奖情况\n');

    try {
        // 1. 查询该期的下注记录
        const bets = await db.manyOrNone(`
            SELECT * FROM bet_history 
            WHERE period = '20250717375'
            AND username = 'justin111'
            ORDER BY position, bet_value
        `);

        console.log('📊 justin111 的下注情况：');
        if (bets.length > 0) {
            const position5Bets = bets.filter(b => b.position === '5');
            if (position5Bets.length > 0) {
                const betNumbers = position5Bets.map(b => b.bet_value).sort((a, b) => a - b);
                console.log(`位置：第5名`);
                console.log(`下注号码：${betNumbers.join(', ')}`);
                console.log(`下注数量：${betNumbers.length}个`);
                console.log(`覆盖率：${betNumbers.length}/10 = ${betNumbers.length * 10}%`);
                console.log(`总下注金额：$${position5Bets.reduce((sum, b) => sum + parseFloat(b.amount), 0)}`);
            }
        }

        // 2. 查询开奖结果
        const result = await db.oneOrNone(`
            SELECT * FROM result_history 
            WHERE period = '20250717375'
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
            console.log(`开奖时间：${result.draw_time}`);

            // 检查是否中奖
            const position5Bets = bets.filter(b => b.position === '5');
            if (position5Bets.length > 0) {
                const betNumbers = position5Bets.map(b => b.bet_value);
                const isWin = betNumbers.includes(result.position_5.toString());
                console.log(`\n💰 结果：${isWin ? '中奖' : '未中奖'}（第5名开出：${result.position_5}）`);
                
                if (isWin) {
                    const winBet = position5Bets.find(b => b.bet_value === result.position_5.toString());
                    if (winBet) {
                        const winAmount = parseFloat(winBet.amount) * parseFloat(winBet.odds);
                        console.log(`中奖金额：$${winAmount.toFixed(2)}`);
                    }
                }
            }
        }

        // 3. 查询当时的控制设定
        const control = await db.oneOrNone(`
            SELECT * FROM win_loss_control
            WHERE target_username = 'justin111'
            AND is_active = true
            AND created_at <= (SELECT draw_time FROM result_history WHERE period = '20250717375')
            ORDER BY created_at DESC
            LIMIT 1
        `);

        if (control) {
            console.log('\n🎮 控制设定：');
            console.log(`控制模式：${control.control_mode}`);
            console.log(`目标用户：${control.target_username}`);
            console.log(`控制百分比：${control.control_percentage}%`);
            console.log(`操作员：${control.operator_username}`);
            console.log(`开始期号：${control.start_period}`);
        } else {
            console.log('\n🎮 控制设定：无活跃控制');
        }

        // 4. 查询权重日志（如果有记录）
        console.log('\n📝 查询权重生成日志...');
        
        // 检查是否有专门的权重日志表
        const hasWeightTable = await db.oneOrNone(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public'
                AND table_name = 'draw_weight_logs'
            );
        `);

        if (hasWeightTable && hasWeightTable.exists) {
            const weightLogs = await db.manyOrNone(`
                SELECT * FROM draw_weight_logs
                WHERE period = '20250717375'
                ORDER BY created_at
            `);

            if (weightLogs && weightLogs.length > 0) {
                console.log('\n🎲 权重生成日志：');
                weightLogs.forEach(log => {
                    console.log(`时间：${log.created_at}`);
                    console.log(`内容：${JSON.stringify(log.weight_data, null, 2)}`);
                });
            } else {
                console.log('未找到该期的权重日志');
            }
        } else {
            console.log('系统未记录权重日志（无 draw_weight_logs 表）');
        }

        // 5. 分析可能的原因
        console.log('\n🔍 分析可能原因：');
        
        if (bets.length > 0) {
            const position5Bets = bets.filter(b => b.position === '5');
            const coverage = position5Bets.length;
            
            if (coverage >= 8) {
                console.log(`1. 高覆盖率下注（${coverage}/10 = ${coverage * 10}%）`);
                console.log('   - 当覆盖率达到80%以上时，控制系统效果有限');
                console.log('   - 即使90%输控制，仍有较高机率中奖');
            }
            
            if (!control || !control.is_active) {
                console.log('2. 控制可能未启用或已过期');
            } else {
                console.log('2. 控制已启用，但可能：');
                console.log('   - 属于10%的"让用户赢"的机率');
                console.log('   - 或因高覆盖率导致控制失效');
            }
            
            console.log('3. 建议查看后端运行日志以了解详细的控制决策过程');
        }

        // 6. 统计最近的中奖情况
        const recentWins = await db.manyOrNone(`
            SELECT 
                bh.period,
                bh.position,
                bh.bet_value,
                bh.amount,
                bh.odds,
                bh.is_win,
                rh.draw_time
            FROM bet_history bh
            JOIN result_history rh ON bh.period = rh.period
            WHERE bh.username = 'justin111'
            AND bh.is_win = true
            AND bh.position = '5'
            AND CAST(bh.period AS BIGINT) >= CAST('20250717350' AS BIGINT)
            ORDER BY CAST(bh.period AS BIGINT) DESC
            LIMIT 10
        `);

        if (recentWins && recentWins.length > 0) {
            console.log(`\n📊 最近第5名中奖记录（最近10次）：`);
            recentWins.forEach(win => {
                console.log(`期号：${win.period}, 中奖号码：${win.bet_value}, 金额：$${win.amount}, 赔率：${win.odds}`);
            });
        }

    } catch (error) {
        console.error('分析失败：', error);
    }
}

// 执行分析
analyzePeriod375().then(() => {
    console.log('\n✅ 分析完成');
    process.exit(0);
}).catch(error => {
    console.error('❌ 分析错误：', error);
    process.exit(1);
});