// compare-712-generation-vs-storage.js - 比较期号 712 生成与储存的差异
import db from './db/config.js';

async function comparePeriod712() {
    try {
        console.log('比较期号 712 生成与储存的差异...\n');
        
        // 从日志中看到的生成结果
        const logGeneratedResult = [10, 5, 4, 7, 9, 2, 1, 3, 6, 8];
        console.log('日志显示的生成结果:', logGeneratedResult);
        
        // 查询资料库中的储存结果
        const dbResult = await db.oneOrNone(`
            SELECT period, 
                   position_1, position_2, position_3, position_4, position_5,
                   position_6, position_7, position_8, position_9, position_10,
                   result
            FROM result_history 
            WHERE period = $1
        `, ['20250717712']);
        
        if (dbResult) {
            const storedPositions = [];
            for (let i = 1; i <= 10; i++) {
                storedPositions.push(dbResult[`position_${i}`]);
            }
            console.log('资料库储存的结果:', storedPositions);
            
            // 比较差异
            console.log('\n比较差异：');
            console.log('位置 | 生成的 | 储存的');
            console.log('-----|-------|-------');
            for (let i = 0; i < 10; i++) {
                const position = i + 1;
                const generated = logGeneratedResult[i];
                const stored = storedPositions[i];
                const match = generated === stored ? '✓' : '✗';
                console.log(`第${position}名 |   ${generated}   |   ${stored}   ${match}`);
            }
            
            // 分析可能的原因
            console.log('\n\n分析：');
            console.log('1. 生成的结果和储存的结果完全不同');
            console.log('2. 这不是简单的顺序错误或映射问题');
            console.log('3. 可能的原因：');
            console.log('   - 在储存前结果被其他逻辑修改了');
            console.log('   - 有并发问题，储存了错误期号的结果');
            console.log('   - 日志和实际执行的程式码不一致');
            
            // 检查其他期号是否也有类似问题
            console.log('\n\n检查其他最近的期号...');
            const recentPeriods = await db.manyOrNone(`
                SELECT period, 
                       position_1, position_2, position_3, position_4, position_5,
                       position_6, position_7, position_8, position_9, position_10
                FROM result_history 
                WHERE period >= '20250717710' AND period <= '20250717715'
                ORDER BY period
            `);
            
            for (const record of recentPeriods) {
                const positions = [];
                for (let i = 1; i <= 10; i++) {
                    positions.push(record[`position_${i}`]);
                }
                console.log(`期号 ${record.period}: [${positions.join(', ')}]`);
            }
            
        } else {
            console.log('找不到期号 712 的资料');
        }
        
    } catch (error) {
        console.error('比较错误:', error);
    } finally {
        process.exit();
    }
}

comparePeriod712();