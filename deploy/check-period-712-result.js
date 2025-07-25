// check-period-712-result.js - 检查期号 712 的开奖结果
import db from './db/config.js';

async function checkPeriod712() {
    try {
        console.log('检查期号 20250717712 的开奖结果...\n');
        
        // 1. 查询资料库中的开奖结果
        const dbResult = await db.oneOrNone(`
            SELECT period, 
                   position_1, position_2, position_3, position_4, position_5,
                   position_6, position_7, position_8, position_9, position_10,
                   result,
                   draw_time
            FROM result_history 
            WHERE period = $1
        `, ['20250717712']);
        
        if (dbResult) {
            console.log('资料库中的开奖结果：');
            console.log('期号:', dbResult.period);
            console.log('开奖时间:', dbResult.draw_time);
            console.log('\n各位置的号码（这是正确的开奖结果）：');
            console.log(`第1名(冠军): ${dbResult.position_1}号`);
            console.log(`第2名(亚军): ${dbResult.position_2}号`);
            console.log(`第3名(季军): ${dbResult.position_3}号`);
            console.log(`第4名: ${dbResult.position_4}号`);
            console.log(`第5名: ${dbResult.position_5}号`);
            console.log(`第6名: ${dbResult.position_6}号`);
            console.log(`第7名: ${dbResult.position_7}号`);
            console.log(`第8名: ${dbResult.position_8}号`);
            console.log(`第9名: ${dbResult.position_9}号`);
            console.log(`第10名: ${dbResult.position_10}号`);
            
            console.log('\nJSON result 栏位:', dbResult.result);
            
            // 解析 JSON 结果
            if (dbResult.result) {
                const jsonResult = typeof dbResult.result === 'string' ? JSON.parse(dbResult.result) : dbResult.result;
                console.log('\n解析后的 JSON 阵列（这是错误的顺序）:', jsonResult);
                
                // 比较两种储存方式
                console.log('\n比较 position_N 和 JSON 阵列：');
                const positionArray = [];
                for (let i = 1; i <= 10; i++) {
                    positionArray.push(dbResult[`position_${i}`]);
                }
                console.log('Position 阵列（正确）:', positionArray);
                console.log('JSON 阵列（错误）:', jsonResult);
                
                console.log('\n主画面应该显示:', positionArray);
                console.log('近期开奖如果显示:', jsonResult, '就是错误的');
            }
        } else {
            console.log('❌ 找不到期号 20250717712 的开奖结果');
        }
        
        // 2. 模拟 /api/history API 查询
        console.log('\n\n模拟 /api/history API 查询：');
        const historyResult = await db.oneOrNone(`
            SELECT period, result, created_at,
                   position_1, position_2, position_3, position_4, position_5,
                   position_6, position_7, position_8, position_9, position_10
            FROM result_history 
            WHERE period = $1
        `, ['20250717712']);
        
        if (historyResult) {
            // 模拟 API 返回的格式
            const positionArray = [];
            for (let i = 1; i <= 10; i++) {
                positionArray.push(historyResult[`position_${i}`]);
            }
            
            console.log('API 应该返回的正确结果:', {
                period: historyResult.period,
                result: positionArray,
                time: historyResult.created_at
            });
        }
        
    } catch (error) {
        console.error('检查错误:', error);
    } finally {
        process.exit();
    }
}

checkPeriod712();