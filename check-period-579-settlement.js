import db from './db/config.js';

async function checkPeriod579Settlement() {
    try {
        console.log('🔍 检查期号 20250717579 的结算情况...\n');
        
        // 1. 查询开奖结果
        const result = await db.oneOrNone(`
            SELECT * FROM result_history 
            WHERE period = '20250717579'
        `);
        
        if (result) {
            console.log('=== 开奖结果 ===');
            console.log('期号:', result.period);
            console.log('第1名（冠军）:', result.position_1, '号');
            console.log('开奖时间:', result.created_at);
            console.log('完整结果:', [
                result.position_1, result.position_2, result.position_3, 
                result.position_4, result.position_5, result.position_6,
                result.position_7, result.position_8, result.position_9, 
                result.position_10
            ].join(', '));
            
            // 判断大小单双
            const champion = parseInt(result.position_1);
            console.log('\n冠军分析:');
            console.log(`  号码: ${champion}`);
            console.log(`  大小: ${champion >= 6 ? '大' : '小'} (1-5小, 6-10大)`);
            console.log(`  单双: ${champion % 2 === 1 ? '单' : '双'}`);
        }
        
        // 2. 查询该期所有投注
        const bets = await db.manyOrNone(`
            SELECT * FROM bet_history 
            WHERE period = '20250717579' 
            AND username = 'justin111'
            ORDER BY id
        `);
        
        console.log(`\n=== 用户 justin111 的投注记录 (共 ${bets.length} 笔) ===`);
        
        bets.forEach((bet, index) => {
            console.log(`\n[${index + 1}] ID: ${bet.id}`);
            console.log(`  投注类型: ${bet.bet_type}`);
            console.log(`  投注内容: ${bet.bet_value}`);
            console.log(`  金额: $${bet.amount}`);
            console.log(`  赔率: ${bet.odds}`);
            console.log(`  结算状态: ${bet.settled ? '已结算' : '未结算'}`);
            console.log(`  中奖: ${bet.win ? '是' : '否'}`);
            console.log(`  派彩: $${bet.win_amount || 0}`);
            console.log(`  创建时间: ${bet.created_at}`);
            console.log(`  结算时间: ${bet.settled_at || '未结算'}`);
            
            // 判断应该的结果
            if (result && bet.bet_type === 'champion' || bet.bet_type === '冠军') {
                const champion = parseInt(result.position_1);
                let shouldWin = false;
                
                if (bet.bet_value === 'small' || bet.bet_value === '小') {
                    shouldWin = champion <= 5;
                    console.log(`  ⚠️ 应该${shouldWin ? '赢' : '输'} (冠军${champion}号是${champion <= 5 ? '小' : '大'})`);
                } else if (bet.bet_value === 'big' || bet.bet_value === '大') {
                    shouldWin = champion >= 6;
                    console.log(`  ⚠️ 应该${shouldWin ? '赢' : '输'} (冠军${champion}号是${champion >= 6 ? '大' : '小'})`);
                } else if (bet.bet_value === 'odd' || bet.bet_value === '单') {
                    shouldWin = champion % 2 === 1;
                    console.log(`  ⚠️ 应该${shouldWin ? '赢' : '输'} (冠军${champion}号是${champion % 2 === 1 ? '单' : '双'})`);
                } else if (bet.bet_value === 'even' || bet.bet_value === '双') {
                    shouldWin = champion % 2 === 0;
                    console.log(`  ⚠️ 应该${shouldWin ? '赢' : '输'} (冠军${champion}号是${champion % 2 === 0 ? '双' : '单'})`);
                }
                
                if (shouldWin !== bet.win) {
                    console.log(`  ❌ 结算错误！实际结算为${bet.win ? '赢' : '输'}，但应该${shouldWin ? '赢' : '输'}`);
                }
            }
        });
        
        // 3. 查询结算日志
        const logs = await db.manyOrNone(`
            SELECT * FROM settlement_logs 
            WHERE period = '20250717579'
            ORDER BY created_at
        `);
        
        if (logs.length > 0) {
            console.log('\n=== 结算日志 ===');
            logs.forEach((log, index) => {
                console.log(`\n[${index + 1}] ${log.created_at}`);
                console.log(`  状态: ${log.status}`);
                console.log(`  讯息: ${log.message}`);
                if (log.details) {
                    console.log(`  详情: ${JSON.stringify(log.details)}`);
                }
            });
        }
        
    } catch (error) {
        console.error('查询失败:', error);
    } finally {
        process.exit(0);
    }
}

checkPeriod579Settlement();