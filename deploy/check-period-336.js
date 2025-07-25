import db from './db/config.js';

async function checkPeriod336() {
    console.log('🔍 检查第336期相关资料...\n');
    
    try {
        // 1. 查询下注记录
        console.log('📋 1. 查询第336期下注记录:');
        const bets = await db.manyOrNone(`
            SELECT username, bet_type, bet_value, position, amount, odds, settled, win_amount, created_at
            FROM bet_history 
            WHERE period = '20250717336'
            ORDER BY created_at
        `);
        
        if (bets.length > 0) {
            console.log(`找到 ${bets.length} 笔下注记录:`);
            bets.forEach((bet, index) => {
                console.log(`\n  下注 ${index + 1}:`);
                console.log(`    用户: ${bet.username}`);
                console.log(`    类型: ${bet.bet_type}`);
                console.log(`    数值: ${bet.bet_value}`);
                console.log(`    位置: ${bet.position || 'N/A'}`);
                console.log(`    金额: ${bet.amount}`);
                console.log(`    赔率: ${bet.odds}`);
                console.log(`    已结算: ${bet.settled ? '是' : '否'}`);
                console.log(`    中奖金额: ${bet.win_amount || 0}`);
                console.log(`    时间: ${bet.created_at}`);
            });
        } else {
            console.log('没有找到下注记录');
        }
        
        // 2. 查询开奖结果
        console.log('\n\n📊 2. 查询第336期开奖结果:');
        const result = await db.oneOrNone(`
            SELECT period, result, position_1, position_2, position_3, position_4, position_5, 
                   position_6, position_7, position_8, position_9, position_10, draw_time
            FROM result_history 
            WHERE period = '20250717336'
        `);
        
        if (result) {
            console.log(`期号: ${result.period}`);
            console.log(`开奖时间: ${result.draw_time}`);
            console.log(`结果阵列: ${JSON.stringify(result.result)}`);
            console.log('各位置号码:');
            for (let i = 1; i <= 10; i++) {
                console.log(`  第${i}名: ${result[`position_${i}`]}`);
            }
        } else {
            console.log('没有找到开奖结果');
        }
        
        // 3. 查询当时的控制设定
        console.log('\n\n🎮 3. 查询输赢控制设定:');
        const controls = await db.manyOrNone(`
            SELECT id, target_username, control_percentage, control_mode, 
                   start_period, end_period, is_active, created_at
            FROM win_loss_control 
            WHERE is_active = true 
            AND (start_period <= '20250717336' OR start_period IS NULL)
            AND (end_period >= '20250717336' OR end_period IS NULL)
            ORDER BY created_at DESC
        `);
        
        if (controls.length > 0) {
            console.log(`找到 ${controls.length} 个活动控制设定:`);
            controls.forEach((control, index) => {
                console.log(`\n  控制设定 ${index + 1}:`);
                console.log(`    ID: ${control.id}`);
                console.log(`    目标用户: ${control.target_username || '全部'}`);
                console.log(`    控制百分比: ${control.control_percentage}%`);
                console.log(`    控制模式: ${control.control_mode}`);
                console.log(`    起始期号: ${control.start_period || '不限'}`);
                console.log(`    结束期号: ${control.end_period || '不限'}`);
                console.log(`    创建时间: ${control.created_at}`);
            });
        } else {
            console.log('没有找到活动的控制设定');
        }
        
        // 4. 查询结算记录
        console.log('\n\n💰 4. 查询第336期结算记录:');
        const settlements = await db.manyOrNone(`
            SELECT username, bet_type, bet_value, position, amount, odds, 
                   win_amount, is_win, settled_at
            FROM settlement_records 
            WHERE period = '20250717336'
            ORDER BY settled_at
        `);
        
        if (settlements.length > 0) {
            console.log(`找到 ${settlements.length} 笔结算记录:`);
            let totalBetAmount = 0;
            let totalWinAmount = 0;
            let winCount = 0;
            
            settlements.forEach((settlement, index) => {
                console.log(`\n  结算 ${index + 1}:`);
                console.log(`    用户: ${settlement.username}`);
                console.log(`    下注类型: ${settlement.bet_type}`);
                console.log(`    下注值: ${settlement.bet_value}`);
                console.log(`    位置: ${settlement.position || 'N/A'}`);
                console.log(`    下注金额: ${settlement.amount}`);
                console.log(`    赔率: ${settlement.odds}`);
                console.log(`    中奖金额: ${settlement.win_amount}`);
                console.log(`    是否中奖: ${settlement.is_win ? '✅ 中奖' : '❌ 未中'}`);
                console.log(`    结算时间: ${settlement.settled_at}`);
                
                totalBetAmount += parseFloat(settlement.amount);
                totalWinAmount += parseFloat(settlement.win_amount || 0);
                if (settlement.is_win) winCount++;
            });
            
            console.log('\n📈 结算统计:');
            console.log(`  总下注金额: ${totalBetAmount}`);
            console.log(`  总中奖金额: ${totalWinAmount}`);
            console.log(`  中奖笔数: ${winCount}/${settlements.length}`);
            console.log(`  中奖率: ${(winCount/settlements.length * 100).toFixed(2)}%`);
            console.log(`  平台盈利: ${totalBetAmount - totalWinAmount}`);
        } else {
            console.log('没有找到结算记录');
        }
        
        // 5. 检查权重计算日志（如果有）
        console.log('\n\n📝 5. 检查开奖计算日志:');
        // 查看是否有相关的计算日志
        const logs = await db.manyOrNone(`
            SELECT created_at, message 
            FROM system_logs 
            WHERE created_at >= '2025-01-17 00:00:00' 
            AND created_at <= '2025-01-17 23:59:59'
            AND (message LIKE '%336%' OR message LIKE '%控制%' OR message LIKE '%权重%')
            ORDER BY created_at
            LIMIT 20
        `).catch(() => []);
        
        if (logs.length > 0) {
            console.log(`找到 ${logs.length} 条相关日志:`);
            logs.forEach(log => {
                console.log(`  ${log.created_at}: ${log.message}`);
            });
        } else {
            console.log('没有找到相关日志记录');
        }
        
    } catch (error) {
        console.error('查询过程中出错:', error);
    } finally {
        await db.$pool.end();
    }
}

checkPeriod336();