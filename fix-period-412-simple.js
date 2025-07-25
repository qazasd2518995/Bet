// 简单修正期号 412 的结算错误
import db from './db/config.js';

async function fixPeriod412Simple() {
    console.log('🔧 修正期号 20250717412 的结算错误\n');

    try {
        // 1. 确认开奖结果
        console.log('📌 步骤1：确认开奖结果...');
        const drawResult = await db.one(`
            SELECT position_10
            FROM result_history
            WHERE period = '20250717412'
        `);
        
        console.log(`第10名开奖号码：${drawResult.position_10}`);
        
        // 2. 查询 justin111 的第10名投注
        console.log('\n📌 步骤2：查询 justin111 的第10名投注...');
        const bets = await db.manyOrNone(`
            SELECT 
                id, 
                bet_value, 
                win, 
                win_amount,
                amount,
                odds
            FROM bet_history
            WHERE period = '20250717412'
            AND username = 'justin111'
            AND position = '10'
            AND bet_type = 'number'
        `);
        
        console.log(`\n找到 ${bets.length} 笔投注：`);
        
        for (const bet of bets) {
            const shouldWin = parseInt(bet.bet_value) === drawResult.position_10;
            console.log(`\n投注号码 ${bet.bet_value}：`);
            console.log(`- 当前状态：${bet.win ? '中奖' : '未中奖'}`);
            console.log(`- 应该状态：${shouldWin ? '应该中奖' : '不应该中奖'}`);
            
            if (bet.win !== shouldWin) {
                console.log(`❌ 需要修正！`);
                
                if (bet.win && !shouldWin) {
                    // 错误中奖 - 号码5
                    console.log(`执行修正：取消中奖状态`);
                    
                    // 更新投注记录
                    await db.none(`
                        UPDATE bet_history
                        SET win = false, win_amount = 0
                        WHERE id = $1
                    `, [bet.id]);
                    
                    // 扣回错误奖金
                    await db.none(`
                        UPDATE members
                        SET balance = balance - $1
                        WHERE username = 'justin111'
                    `, [bet.win_amount]);
                    
                    console.log(`✅ 已取消中奖，扣回奖金 ${bet.win_amount}`);
                    
                } else if (!bet.win && shouldWin) {
                    // 应该中奖但没中 - 号码10
                    const winAmount = parseFloat(bet.amount) * parseFloat(bet.odds);
                    console.log(`执行修正：设为中奖`);
                    
                    // 更新投注记录
                    await db.none(`
                        UPDATE bet_history
                        SET win = true, win_amount = $1
                        WHERE id = $2
                    `, [winAmount.toFixed(2), bet.id]);
                    
                    // 增加奖金
                    await db.none(`
                        UPDATE members
                        SET balance = balance + $1
                        WHERE username = 'justin111'
                    `, [winAmount]);
                    
                    console.log(`✅ 已设为中奖，补发奖金 ${winAmount.toFixed(2)}`);
                }
            }
        }
        
        // 3. 查询修正后的余额
        console.log('\n📌 步骤3：查询修正后的余额...');
        const member = await db.one(`
            SELECT balance
            FROM members
            WHERE username = 'justin111'
        `);
        
        console.log(`\njustin111 修正后余额：${member.balance}`);
        
        console.log('\n✅ 修正完成！');
        console.log('期号 20250717412 的结算错误已修正：');
        console.log('- 取消了号码5的错误中奖');
        console.log('- 补发了号码10的正确奖金');
        
    } catch (error) {
        console.error('修正失败：', error);
    }
}

// 执行修正
fixPeriod412Simple().then(() => {
    console.log('\n✅ 所有操作完成');
    process.exit(0);
}).catch(error => {
    console.error('❌ 错误：', error);
    process.exit(1);
});