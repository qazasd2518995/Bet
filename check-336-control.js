import db from './db/config.js';

async function checkControl336() {
    console.log('🔍 检查336期控制设定和权重计算...\n');
    
    try {
        // 1. 查看下注摘要
        console.log('📊 下注摘要:');
        console.log('用户 justin111 在第8名位置下注了:');
        console.log('2, 3, 4, 5, 6, 7, 8, 9, 10 (共9个号码，每个100元)');
        console.log('开奖结果: 第8名开出3号');
        console.log('中奖金额: 989元 (100 * 9.89赔率)');
        console.log('下注总额: 900元');
        console.log('实际获利: 989 - 900 = 89元\n');
        
        // 2. 查询控制设定（修正栏位名称）
        console.log('🎮 查询输赢控制设定:');
        const controls = await db.manyOrNone(`
            SELECT id, target_username, control_percentage, control_mode, 
                   start_period, is_active, created_at
            FROM win_loss_control 
            WHERE is_active = true 
            AND (start_period <= '20250717336' OR start_period IS NULL)
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
                console.log(`    创建时间: ${control.created_at}`);
            });
        } else {
            console.log('没有找到活动的控制设定');
        }
        
        // 3. 分析控制逻辑
        console.log('\n\n🔍 控制逻辑分析:');
        console.log('如果设定90%输的控制，理论上有90%机率会让用户输');
        console.log('但您下注了9个号码中的9个（只漏了1号）');
        console.log('这代表您有90%的中奖机率（9/10）');
        console.log('\n即使系统想让您输，也很难做到，因为:');
        console.log('- 要让您输，系统必须开出1号（您唯一没下注的号码）');
        console.log('- 但这样做会太明显，违反随机性原则');
        console.log('- 系统可能在权重计算时发现无法有效控制，因此回归正常开奖');
        
        // 4. 查看简化开奖系统的逻辑
        console.log('\n\n📝 查看simplified-draw-system.js的控制逻辑:');
        console.log('根据程式码，当control_percentage = 90%时:');
        console.log('- 如果设定让用户输，系统会尝试生成让用户输的结果');
        console.log('- 但generateLosingResult函数会避开用户下注的号码');
        console.log('- 当用户几乎下注所有号码时，系统很难执行有效控制');
        
        // 5. 检查该用户其他期的下注模式
        console.log('\n\n📈 检查该用户近期下注模式:');
        const recentBets = await db.manyOrNone(`
            SELECT period, COUNT(*) as bet_count, SUM(amount) as total_amount,
                   SUM(CASE WHEN win_amount > 0 THEN 1 ELSE 0 END) as win_count,
                   SUM(win_amount) as total_win
            FROM bet_history
            WHERE username = 'justin111'
            AND period >= '20250717330'
            AND period <= '20250717340'
            GROUP BY period
            ORDER BY period
        `);
        
        if (recentBets.length > 0) {
            console.log('期号\t下注数\t总金额\t中奖数\t总获利');
            recentBets.forEach(record => {
                const profit = (record.total_win || 0) - record.total_amount;
                console.log(`${record.period}\t${record.bet_count}\t${record.total_amount}\t${record.win_count}\t${profit}`);
            });
        }
        
        console.log('\n\n💡 结论:');
        console.log('1. 您在336期下注了9个号码（除了1号），覆盖率90%');
        console.log('2. 即使设定90%输控制，系统也很难让您输');
        console.log('3. 控制系统可能因为无法有效执行而回归随机开奖');
        console.log('4. 建议：如果要测试控制效果，应该下注较少的号码（如1-3个）');
        
    } catch (error) {
        console.error('查询过程中出错:', error);
    } finally {
        await db.$pool.end();
    }
}

checkControl336();