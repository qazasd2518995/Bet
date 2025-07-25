// analyze-period-630-bets.js - 分析期号 20250717630 的下注问题
import db from './db/config.js';

async function analyzePeriod630() {
    try {
        console.log('分析期号 20250717630 的下注问题...\n');
        
        const period = '20250717630';
        
        // 1. 检查期号的数据类型
        console.log('1. 检查 period 字段的数据类型:');
        const columnInfo = await db.one(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'bet_history' AND column_name = 'period'
        `);
        console.log('   数据类型:', columnInfo.data_type);
        
        // 2. 使用不同方式查询
        console.log('\n2. 使用不同方式查询期号 20250717630:');
        
        // 方式1: 直接数字
        const bets1 = await db.manyOrNone(`
            SELECT COUNT(*) as count FROM bet_history WHERE period = 20250717630
        `);
        console.log('   直接数字查询:', bets1[0].count, '笔');
        
        // 方式2: 字符串参数
        const bets2 = await db.manyOrNone(`
            SELECT COUNT(*) as count FROM bet_history WHERE period = $1
        `, [period]);
        console.log('   字符串参数查询:', bets2[0].count, '笔');
        
        // 方式3: 数字参数
        const bets3 = await db.manyOrNone(`
            SELECT COUNT(*) as count FROM bet_history WHERE period = $1
        `, [parseInt(period)]);
        console.log('   数字参数查询:', bets3[0].count, '笔');
        
        // 3. 模拟 analyzePeriodBets 的查询
        console.log('\n3. 模拟 analyzePeriodBets 函数的查询:');
        const allBets = await db.manyOrNone(`
            SELECT bet_type, bet_value, position, amount, username
            FROM bet_history 
            WHERE period = $1 AND settled = false
        `, [period]);
        
        console.log(`   找到 ${allBets.length} 笔未结算的下注`);
        
        // 4. 检查所有下注的结算状态
        console.log('\n4. 检查期号 20250717630 的所有下注:');
        const allBetsDetail = await db.manyOrNone(`
            SELECT id, username, bet_type, position, bet_value, amount, settled, created_at
            FROM bet_history 
            WHERE period = $1
            ORDER BY id
        `, [period]);
        
        console.log(`   总共 ${allBetsDetail.length} 笔下注:`);
        allBetsDetail.forEach((bet, index) => {
            console.log(`   ${index + 1}. ID:${bet.id}, 用户:${bet.username}, ` +
                       `第${bet.position}名${bet.bet_value}号, ` +
                       `金额:${bet.amount}, 已结算:${bet.settled}, ` +
                       `创建时间:${bet.created_at.toLocaleString('zh-TW')}`);
        });
        
        // 5. 统计结算状态
        const settledCount = allBetsDetail.filter(b => b.settled).length;
        const unsettledCount = allBetsDetail.filter(b => !b.settled).length;
        console.log(`\n   结算统计: 已结算 ${settledCount} 笔, 未结算 ${unsettledCount} 笔`);
        
        // 6. 检查是否有结算时间问题
        console.log('\n5. 检查时间问题:');
        const latestBet = await db.oneOrNone(`
            SELECT MAX(created_at) as latest_time 
            FROM bet_history 
            WHERE period = $1
        `, [period]);
        
        const drawResult = await db.oneOrNone(`
            SELECT draw_time 
            FROM result_history 
            WHERE period = $1
        `, [period]);
        
        if (latestBet && latestBet.latest_time) {
            console.log('   最后下注时间:', latestBet.latest_time.toLocaleString('zh-TW'));
        }
        if (drawResult && drawResult.draw_time) {
            console.log('   开奖时间:', drawResult.draw_time.toLocaleString('zh-TW'));
            
            if (latestBet && latestBet.latest_time && drawResult.draw_time < latestBet.latest_time) {
                console.log('   ⚠️  警告: 开奖时间早于最后下注时间！');
            }
        }
        
        // 7. 找出问题原因
        console.log('\n\n问题分析结论:');
        if (unsettledCount === allBetsDetail.length) {
            console.log('❌ 所有下注都是未结算状态 (settled = false)');
            console.log('   这就是为什么 analyzePeriodBets 查询 "settled = false" 时会返回 0 笔');
            console.log('   可能原因:');
            console.log('   1. 下注在开奖查询时还未保存到数据库');
            console.log('   2. 开奖时机太早，在下注完成前就执行了');
            console.log('   3. 批量下注的事务还未提交');
        } else if (settledCount > 0) {
            console.log('✅ 有部分下注已结算，可能是时序问题');
        }
        
    } catch (error) {
        console.error('分析错误:', error);
    } finally {
        process.exit();
    }
}

analyzePeriod630();