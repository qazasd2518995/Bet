// check-bet-table.js - 检查下注表结构
import db from './db/config.js';

async function checkBetTable() {
    console.log('🔍 检查 bet_history 表结构...\n');
    
    try {
        // 1. 检查表结构
        const columns = await db.any(`
            SELECT 
                column_name,
                data_type,
                is_nullable,
                column_default
            FROM information_schema.columns
            WHERE table_name = 'bet_history'
            ORDER BY ordinal_position
        `);
        
        console.log('📊 bet_history 表结构:');
        columns.forEach(col => {
            console.log(`  ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
        });
        
        // 2. 检查最近的下注记录
        console.log('\n📋 最近的下注记录:');
        const recentBets = await db.any(`
            SELECT 
                id,
                username,
                bet_type,
                bet_value,
                position,
                amount,
                period,
                win,
                win_amount,
                settled,
                created_at
            FROM bet_history
            WHERE username = 'justin111'
            ORDER BY created_at DESC
            LIMIT 10
        `);
        
        if (recentBets.length > 0) {
            recentBets.forEach(bet => {
                console.log(`\nID: ${bet.id}`);
                console.log(`  期号: ${bet.period}`);
                console.log(`  类型: ${bet.bet_type}`);
                console.log(`  值: ${bet.bet_value}`);
                console.log(`  位置: ${bet.position}`);
                console.log(`  金额: ${bet.amount}`);
                console.log(`  结算: ${bet.settled ? '是' : '否'}`);
                console.log(`  中奖: ${bet.win ? '是' : '否'}`);
                console.log(`  中奖金额: ${bet.win_amount || 0}`);
            });
        } else {
            console.log('没有找到下注记录');
        }
        
        // 3. 检查位置映射
        console.log('\n📍 位置映射检查:');
        console.log('champion 应该对应 position = 1');
        console.log('runnerup 应该对应 position = 2');
        console.log('third 应该对应 position = 3');
        console.log('...');
        
    } catch (error) {
        console.error('❌ 检查过程中发生错误:', error);
    }
}

// 执行
checkBetTable()
    .then(() => {
        console.log('\n检查完成');
        process.exit(0);
    })
    .catch(error => {
        console.error('执行失败:', error);
        process.exit(1);
    });