// 检查期号 375 的详细下注情况
import db from './db/config.js';

async function checkPeriod375() {
    console.log('🔍 检查期号 20250717375 的详细情况\n');

    try {
        // 1. 查询所有下注记录
        const allBets = await db.manyOrNone(`
            SELECT * FROM bet_history 
            WHERE period = '20250717375'
            ORDER BY username, position, bet_value
        `);

        console.log(`📊 总下注记录数：${allBets.length}`);

        // 2. 查询 justin111 的下注
        const justinBets = allBets.filter(b => b.username === 'justin111');
        
        if (justinBets.length > 0) {
            console.log(`\n👤 justin111 的下注（共${justinBets.length}笔）：`);
            
            // 按位置分组
            const betsByPosition = {};
            justinBets.forEach(bet => {
                if (!betsByPosition[bet.position]) {
                    betsByPosition[bet.position] = [];
                }
                betsByPosition[bet.position].push(bet);
            });

            // 显示每个位置的下注
            Object.keys(betsByPosition).sort().forEach(position => {
                const positionBets = betsByPosition[position];
                const betNumbers = positionBets.map(b => b.bet_value).sort((a, b) => a - b);
                const totalAmount = positionBets.reduce((sum, b) => sum + parseFloat(b.amount), 0);
                
                console.log(`\n第${position}名：`);
                console.log(`  下注号码：${betNumbers.join(', ')}`);
                console.log(`  覆盖率：${betNumbers.length}/10 = ${betNumbers.length * 10}%`);
                console.log(`  总金额：$${totalAmount}`);
            });
        } else {
            console.log('\njustin111 在此期没有下注');
        }

        // 3. 查询开奖结果
        const result = await db.oneOrNone(`
            SELECT * FROM result_history 
            WHERE period = '20250717375'
        `);

        if (result) {
            console.log('\n🎯 开奖结果：');
            const positions = [
                result.position_1, result.position_2, result.position_3, 
                result.position_4, result.position_5, result.position_6,
                result.position_7, result.position_8, result.position_9, 
                result.position_10
            ];
            
            positions.forEach((num, idx) => {
                const star = (idx === 4) ? ' ⭐' : ''; // 第5名标记
                console.log(`第${idx + 1}名：${num}${star}`);
            });

            // 检查 justin111 是否中奖
            if (justinBets.length > 0) {
                console.log('\n💰 中奖检查：');
                let totalWin = 0;
                
                justinBets.forEach(bet => {
                    const positionIndex = parseInt(bet.position) - 1;
                    const drawnNumber = positions[positionIndex];
                    
                    if (bet.bet_value === drawnNumber.toString()) {
                        const winAmount = parseFloat(bet.amount) * parseFloat(bet.odds);
                        console.log(`✅ 第${bet.position}名 - 号码${bet.bet_value}中奖！金额：$${bet.amount} x ${bet.odds} = $${winAmount.toFixed(2)}`);
                        totalWin += winAmount;
                    }
                });
                
                if (totalWin > 0) {
                    console.log(`总中奖金额：$${totalWin.toFixed(2)}`);
                } else {
                    console.log('未中奖');
                }
            }
        } else {
            console.log('\n❌ 未找到该期的开奖结果');
        }

        // 4. 检查控制记录
        const controlLog = await db.oneOrNone(`
            SELECT * FROM win_loss_control
            WHERE target_username = 'justin111'
            AND is_active = true
            ORDER BY created_at DESC
            LIMIT 1
        `);

        if (controlLog) {
            console.log('\n🎮 当前控制设定：');
            console.log(`模式：${controlLog.control_mode}`);
            console.log(`百分比：${controlLog.control_percentage}%`);
            console.log(`操作员：${controlLog.operator_username}`);
        }

        // 5. 尝试查找系统日志（如果有）
        console.log('\n📝 查找系统日志...');
        
        // 检查是否有系统日志表
        const hasLogTable = await db.oneOrNone(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public'
                AND table_name = 'system_logs'
            );
        `);

        if (hasLogTable && hasLogTable.exists) {
            const logs = await db.manyOrNone(`
                SELECT * FROM system_logs
                WHERE log_data::text LIKE '%20250717375%'
                ORDER BY created_at DESC
                LIMIT 10
            `);

            if (logs && logs.length > 0) {
                console.log('找到相关日志：');
                logs.forEach(log => {
                    console.log(`[${log.created_at}] ${JSON.stringify(log.log_data)}`);
                });
            }
        } else {
            console.log('系统未配置日志表');
            console.log('建议检查后端服务器的控制台输出或日志文件');
        }

    } catch (error) {
        console.error('查询失败：', error);
    }
}

// 执行检查
checkPeriod375().then(() => {
    console.log('\n✅ 检查完成');
    process.exit(0);
}).catch(error => {
    console.error('❌ 错误：', error);
    process.exit(1);
});