// analyze-draw-result-logic.js - 分析开奖结果逻辑
import db from './db/config.js';

async function analyzeDrawResultLogic() {
    try {
        console.log('分析开奖结果逻辑...\n');
        
        // 原始生成的结果
        const generatedResult = [10, 5, 4, 7, 9, 2, 1, 3, 6, 8];
        console.log('生成的结果阵列:', generatedResult);
        console.log('\n这个阵列的含义应该是：');
        console.log('索引 0 (第1名/冠军): 10号车');
        console.log('索引 1 (第2名/亚军): 5号车');
        console.log('索引 2 (第3名/季军): 4号车');
        console.log('以此类推...\n');
        
        // 但是看用户报告的近期开奖显示
        const userReportedDisplay = [1, 5, 8, 2, 10, 4, 3, 9, 7];
        console.log('用户报告的近期开奖显示:', userReportedDisplay);
        
        // 尝试理解转换逻辑
        console.log('\n分析可能的转换逻辑：');
        
        // 方法1: 直接储存（目前的做法）
        console.log('\n方法1 - 直接储存（目前的做法）：');
        console.log('position_1 = generatedResult[0] = 10');
        console.log('position_2 = generatedResult[1] = 5');
        console.log('这样储存后，position_N 代表第N名是几号车');
        
        // 方法2: 反向映射
        console.log('\n方法2 - 反向映射（可能是错误的理解）：');
        const reverseMapping = new Array(11).fill(0); // 索引0不用，1-10对应车号
        generatedResult.forEach((carNumber, position) => {
            reverseMapping[carNumber] = position + 1;
        });
        console.log('如果理解为"N号车在第几名"：');
        for (let i = 1; i <= 10; i++) {
            console.log(`${i}号车在第${reverseMapping[i]}名`);
        }
        
        // 建立反向阵列
        const reverseArray = [];
        for (let i = 1; i <= 10; i++) {
            reverseArray.push(reverseMapping[i]);
        }
        console.log('\n反向阵列（每个车号的名次）:', reverseArray);
        
        // 查询实际储存的资料
        console.log('\n\n查询最近的开奖结果...');
        const recentResults = await db.manyOrNone(`
            SELECT period, 
                   position_1, position_2, position_3, position_4, position_5,
                   position_6, position_7, position_8, position_9, position_10,
                   result
            FROM result_history 
            ORDER BY created_at DESC 
            LIMIT 5
        `);
        
        for (const record of recentResults) {
            console.log(`\n期号 ${record.period}:`);
            const positionArray = [];
            for (let i = 1; i <= 10; i++) {
                positionArray.push(record[`position_${i}`]);
            }
            console.log('Position 阵列:', positionArray);
            const jsonResult = typeof record.result === 'string' ? JSON.parse(record.result) : record.result;
            console.log('JSON result:', jsonResult);
            console.log('两者是否相同:', JSON.stringify(positionArray) === JSON.stringify(jsonResult));
        }
        
    } catch (error) {
        console.error('分析错误:', error);
    } finally {
        process.exit();
    }
}

analyzeDrawResultLogic();