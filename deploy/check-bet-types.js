// check-bet-types.js - 检查下注类型
import db from './db/config.js';

async function checkBetTypes() {
    console.log('🔍 检查下注类型...\n');
    
    try {
        // 1. 查看所有不同的 bet_type
        console.log('1️⃣ 所有的 bet_type 类型:');
        const betTypes = await db.any(`
            SELECT DISTINCT bet_type, COUNT(*) as count
            FROM bet_history
            GROUP BY bet_type
            ORDER BY count DESC
        `);
        
        betTypes.forEach(type => {
            console.log(`  ${type.bet_type}: ${type.count} 笔`);
        });
        
        // 2. 查看 champion 类型的下注
        console.log('\n2️⃣ champion 类型的下注范例:');
        const championBets = await db.any(`
            SELECT 
                id,
                username,
                bet_type,
                bet_value,
                position,
                amount,
                odds,
                win,
                win_amount,
                period
            FROM bet_history
            WHERE bet_type = 'champion'
            ORDER BY created_at DESC
            LIMIT 5
        `);
        
        championBets.forEach(bet => {
            console.log(`\nID: ${bet.id}`);
            console.log(`  期号: ${bet.period}`);
            console.log(`  用户: ${bet.username}`);
            console.log(`  类型: ${bet.bet_type}`);
            console.log(`  值: ${bet.bet_value}`);
            console.log(`  位置: ${bet.position}`);
            console.log(`  金额: ${bet.amount}`);
            console.log(`  赔率: ${bet.odds}`);
            console.log(`  中奖: ${bet.win ? '是' : '否'}`);
        });
        
        // 3. 分析 bet_type 和 position 的关系
        console.log('\n3️⃣ bet_type 和 position 的关系:');
        const typePositionRelation = await db.any(`
            SELECT 
                bet_type,
                position,
                COUNT(*) as count
            FROM bet_history
            WHERE bet_type IN ('champion', 'number', 'first', 'second')
            GROUP BY bet_type, position
            ORDER BY bet_type, position
            LIMIT 20
        `);
        
        let currentType = '';
        typePositionRelation.forEach(rel => {
            if (rel.bet_type !== currentType) {
                currentType = rel.bet_type;
                console.log(`\n${currentType}:`);
            }
            console.log(`  position ${rel.position}: ${rel.count} 笔`);
        });
        
        // 4. 检查结算逻辑对应
        console.log('\n4️⃣ 结算逻辑分析:');
        console.log('根据 checkWin 函数:');
        console.log('  - "number" 类型使用 position 栏位判断位置');
        console.log('  - "champion" 类型没有处理逻辑');
        console.log('\n可能的解决方案:');
        console.log('  1. 将 "champion" 映射为 "number" + position=1');
        console.log('  2. 在 checkWin 中添加 "champion" 的处理逻辑');
        console.log('  3. 统一使用位置名称作为 bet_type（first, second, third...）');
        
    } catch (error) {
        console.error('❌ 检查过程中发生错误:', error);
    }
}

// 执行
checkBetTypes()
    .then(() => {
        console.log('\n检查完成');
        process.exit(0);
    })
    .catch(error => {
        console.error('执行失败:', error);
        process.exit(1);
    });