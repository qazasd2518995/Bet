// init-settlement-system.js - 初始化结算系统
import db from './db/config.js';
import { createSettlementTables } from './improved-settlement-system.js';

async function initializeSettlementSystem() {
    console.log('🚀 开始初始化结算系统...');
    
    try {
        // 1. 创建结算相关表
        console.log('📋 创建结算系统表...');
        await createSettlementTables();
        
        // 2. 检查现有的未结算注单
        console.log('🔍 检查未结算的注单...');
        const unsettledBets = await db.oneOrNone(`
            SELECT COUNT(*) as count, MIN(period) as min_period, MAX(period) as max_period
            FROM bet_history
            WHERE settled = false
        `);
        
        if (unsettledBets && parseInt(unsettledBets.count) > 0) {
            console.log(`⚠️ 发现 ${unsettledBets.count} 笔未结算注单`);
            console.log(`   期号范围: ${unsettledBets.min_period} - ${unsettledBets.max_period}`);
        } else {
            console.log('✅ 没有未结算的注单');
        }
        
        // 3. 检查重复结算的情况
        console.log('🔍 检查重复结算情况...');
        const duplicateSettlements = await db.manyOrNone(`
            SELECT period, username, COUNT(*) as count, SUM(win_amount) as total_win
            FROM bet_history
            WHERE settled = true
            GROUP BY period, username, bet_type, bet_value, position, amount
            HAVING COUNT(*) > 1
            ORDER BY period DESC
            LIMIT 10
        `);
        
        if (duplicateSettlements && duplicateSettlements.length > 0) {
            console.log(`⚠️ 发现可能的重复结算情况：`);
            duplicateSettlements.forEach(dup => {
                console.log(`   期号: ${dup.period}, 用户: ${dup.username}, 重复次数: ${dup.count}, 总中奖: ${dup.total_win}`);
            });
        } else {
            console.log('✅ 没有发现重复结算的情况');
        }
        
        // 4. 清理过期的结算锁
        console.log('🧹 清理过期的结算锁...');
        const cleanedLocks = await db.result(`
            DELETE FROM settlement_locks 
            WHERE expires_at < NOW()
        `);
        console.log(`   清理了 ${cleanedLocks.rowCount} 个过期锁`);
        
        // 5. 创建测试数据（可选）
        const createTestData = process.argv.includes('--test');
        if (createTestData) {
            console.log('📝 创建测试数据...');
            await createTestBets();
        }
        
        console.log('✅ 结算系统初始化完成！');
        
    } catch (error) {
        console.error('❌ 初始化结算系统时发生错误:', error);
        throw error;
    }
}

// 创建测试注单（用于测试）
async function createTestBets() {
    const testPeriod = Date.now();
    const testUsers = ['test_user1', 'test_user2', 'test_user3'];
    const betTypes = [
        { type: 'number', value: '1', position: 1, amount: 100, odds: 9 },
        { type: 'big_small', value: 'big', position: null, amount: 200, odds: 1.95 },
        { type: 'odd_even', value: 'odd', position: null, amount: 150, odds: 1.95 },
        { type: 'dragon_tiger', value: '1_10', position: null, amount: 300, odds: 1.95 },
        { type: 'sum', value: '11', position: null, amount: 100, odds: 8.3 }
    ];
    
    for (const user of testUsers) {
        for (const bet of betTypes) {
            await db.none(`
                INSERT INTO bet_history (username, bet_type, bet_value, position, amount, odds, period, settled, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, false, NOW())
            `, [user, bet.type, bet.value, bet.position, bet.amount, bet.odds, testPeriod]);
        }
    }
    
    console.log(`   创建了 ${testUsers.length * betTypes.length} 笔测试注单，期号: ${testPeriod}`);
}

// 如果直接执行此文件
if (process.argv[1] === new URL(import.meta.url).pathname) {
    initializeSettlementSystem()
        .then(() => {
            console.log('程序执行完毕');
            process.exit(0);
        })
        .catch(error => {
            console.error('程序执行失败:', error);
            process.exit(1);
        });
}

export default initializeSettlementSystem;