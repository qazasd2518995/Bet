import db from './db/config.js';

async function checkPeriod346() {
    console.log('🔍 检查第346期相关资料...\n');
    
    try {
        // 1. 查询下注记录
        console.log('📋 1. 查询第346期下注记录:');
        const bets = await db.manyOrNone(`
            SELECT username, bet_type, bet_value, position, amount, odds, settled, win_amount, created_at
            FROM bet_history 
            WHERE period = '20250717346'
            ORDER BY username, created_at
        `);
        
        if (bets.length > 0) {
            console.log(`找到 ${bets.length} 笔下注记录:`);
            
            // 按用户分组
            const betsByUser = {};
            bets.forEach(bet => {
                if (!betsByUser[bet.username]) {
                    betsByUser[bet.username] = [];
                }
                betsByUser[bet.username].push(bet);
            });
            
            // 显示每个用户的下注
            Object.entries(betsByUser).forEach(([username, userBets]) => {
                console.log(`\n👤 用户: ${username}`);
                console.log(`  下注数量: ${userBets.length}`);
                let totalBet = 0;
                let totalWin = 0;
                
                userBets.forEach((bet, index) => {
                    console.log(`    下注${index + 1}: ${bet.bet_type} - ${bet.bet_value}${bet.position ? ` (第${bet.position}名)` : ''} - 金额:${bet.amount} - ${bet.win_amount > 0 ? '✅中奖:' + bet.win_amount : '❌未中'}`);
                    totalBet += parseFloat(bet.amount);
                    totalWin += parseFloat(bet.win_amount || 0);
                });
                
                console.log(`  总下注: ${totalBet}, 总中奖: ${totalWin}, 净利: ${totalWin - totalBet}`);
            });
        } else {
            console.log('没有找到下注记录');
        }
        
        // 2. 查询开奖结果
        console.log('\n\n📊 2. 查询第346期开奖结果:');
        const result = await db.oneOrNone(`
            SELECT period, result, position_1, position_2, position_3, position_4, position_5, 
                   position_6, position_7, position_8, position_9, position_10, draw_time
            FROM result_history 
            WHERE period = '20250717346'
        `);
        
        if (result) {
            console.log(`期号: ${result.period}`);
            console.log(`开奖时间: ${result.draw_time}`);
            console.log('各位置号码:');
            for (let i = 1; i <= 10; i++) {
                console.log(`  第${i}名: ${result[`position_${i}`]}`);
            }
            
            // 计算冠亚和
            const sum = result.position_1 + result.position_2;
            console.log(`\n冠亚和: ${result.position_1} + ${result.position_2} = ${sum}`);
            console.log(`冠亚和属性: ${sum >= 12 ? '大' : '小'}, ${sum % 2 === 0 ? '双' : '单'}`);
        } else {
            console.log('没有找到开奖结果');
        }
        
        // 3. 查询当时的控制设定
        console.log('\n\n🎮 3. 查询346期时的输赢控制设定:');
        const controls = await db.manyOrNone(`
            SELECT id, target_username, control_percentage, control_mode, 
                   start_period, is_active, created_at, updated_at
            FROM win_loss_control 
            WHERE (start_period <= '20250717346' OR start_period IS NULL)
            AND created_at <= (
                SELECT draw_time FROM result_history WHERE period = '20250717346'
            )
            ORDER BY created_at DESC
        `);
        
        if (controls.length > 0) {
            console.log(`找到 ${controls.length} 个相关控制设定:`);
            controls.forEach((control, index) => {
                console.log(`\n  控制设定 ${index + 1}:`);
                console.log(`    ID: ${control.id}`);
                console.log(`    目标用户: ${control.target_username || '全部'}`);
                console.log(`    控制百分比: ${control.control_percentage}%`);
                console.log(`    控制模式: ${control.control_mode}`);
                console.log(`    起始期号: ${control.start_period || '不限'}`);
                console.log(`    是否启用: ${control.is_active ? '是' : '否'}`);
                console.log(`    创建时间: ${control.created_at}`);
                console.log(`    更新时间: ${control.updated_at || 'N/A'}`);
            });
            
            // 找出346期时生效的控制
            const activeControl = controls.find(c => 
                c.is_active && 
                (!c.start_period || c.start_period <= '20250717346')
            );
            
            if (activeControl) {
                console.log(`\n✅ 346期时生效的控制: ID ${activeControl.id}, 目标:${activeControl.target_username}, ${activeControl.control_percentage}%`);
            }
        } else {
            console.log('没有找到控制设定记录');
        }
        
        // 4. 分析控制效果
        console.log('\n\n📈 4. 控制效果分析:');
        
        // 检查justin111的下注情况
        const justinBets = bets.filter(b => b.username === 'justin111');
        if (justinBets.length > 0) {
            console.log(`\njustin111 的下注分析:`);
            const positions = {};
            const betNumbers = new Set();
            
            justinBets.forEach(bet => {
                if (bet.bet_type === 'number' && bet.position) {
                    if (!positions[bet.position]) {
                        positions[bet.position] = [];
                    }
                    positions[bet.position].push(bet.bet_value);
                    betNumbers.add(`${bet.position}-${bet.bet_value}`);
                }
            });
            
            Object.entries(positions).forEach(([pos, nums]) => {
                console.log(`  第${pos}名下注: ${nums.join(', ')} (${nums.length}个号码)`);
                const notBet = [];
                for (let i = 1; i <= 10; i++) {
                    if (!nums.includes(i.toString())) {
                        notBet.push(i);
                    }
                }
                console.log(`  第${pos}名未下注: ${notBet.join(', ')} (${notBet.length}个号码)`);
                
                // 检查是否中奖
                if (result) {
                    const winNumber = result[`position_${pos}`];
                    const isWin = nums.includes(winNumber.toString());
                    console.log(`  第${pos}名开奖: ${winNumber} - ${isWin ? '✅ 中奖' : '❌ 未中'}`);
                }
            });
        }
        
        // 5. 查询最近几期的中奖情况
        console.log('\n\n📊 5. justin111 最近10期中奖统计:');
        const recentStats = await db.manyOrNone(`
            SELECT 
                period,
                COUNT(*) as bet_count,
                SUM(amount) as total_bet,
                SUM(CASE WHEN win_amount > 0 THEN 1 ELSE 0 END) as win_count,
                SUM(win_amount) as total_win,
                SUM(win_amount) - SUM(amount) as profit
            FROM bet_history
            WHERE username = 'justin111'
            AND period >= '20250717340'
            AND period <= '20250717350'
            GROUP BY period
            ORDER BY period DESC
        `);
        
        if (recentStats.length > 0) {
            console.log('期号\t\t下注数\t总下注\t中奖数\t总中奖\t盈亏');
            console.log('─'.repeat(70));
            let totalProfit = 0;
            recentStats.forEach(stat => {
                console.log(`${stat.period}\t${stat.bet_count}\t${stat.total_bet}\t${stat.win_count}\t${stat.total_win}\t${stat.profit > 0 ? '+' : ''}${stat.profit}`);
                totalProfit += parseFloat(stat.profit);
            });
            console.log('─'.repeat(70));
            console.log(`总计盈亏: ${totalProfit > 0 ? '+' : ''}${totalProfit.toFixed(2)}`);
        }
        
    } catch (error) {
        console.error('查询过程中出错:', error);
    } finally {
        await db.$pool.end();
    }
}

checkPeriod346();