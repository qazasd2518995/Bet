// check-period-697-result.js - 检查期号 697 的开奖结果问题
import db from './db/config.js';

async function checkPeriod697() {
    try {
        console.log('检查期号 20250717697 的开奖结果...\n');
        
        // 1. 查询资料库中的开奖结果
        const dbResult = await db.oneOrNone(`
            SELECT period, 
                   position_1, position_2, position_3, position_4, position_5,
                   position_6, position_7, position_8, position_9, position_10,
                   result,
                   draw_time
            FROM result_history 
            WHERE period = $1
        `, ['20250717697']);
        
        if (dbResult) {
            console.log('资料库中的开奖结果：');
            console.log('期号:', dbResult.period);
            console.log('开奖时间:', dbResult.draw_time);
            console.log('\n各位置的号码：');
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
                console.log('\n解析后的 JSON 阵列:', jsonResult);
                
                // 比较两种储存方式
                console.log('\n比较 position_N 和 JSON 阵列：');
                const positionArray = [];
                for (let i = 1; i <= 10; i++) {
                    positionArray.push(dbResult[`position_${i}`]);
                }
                console.log('Position 阵列:', positionArray);
                console.log('JSON 阵列:', jsonResult);
                
                // 检查是否一致
                const isConsistent = positionArray.every((val, idx) => val === jsonResult[idx]);
                console.log('\n两种储存方式是否一致:', isConsistent ? '✅ 一致' : '❌ 不一致');
            }
        } else {
            console.log('❌ 找不到期号 20250717697 的开奖结果');
        }
        
        // 2. 检查游戏状态表中的 last_result
        const gameState = await db.oneOrNone(`
            SELECT last_result, current_period
            FROM game_state
            WHERE id = 1
        `);
        
        if (gameState) {
            console.log('\n\n游戏状态表资讯：');
            console.log('当前期号:', gameState.current_period);
            console.log('最后开奖结果 (last_result):', gameState.last_result);
            
            if (gameState.last_result) {
                const lastResult = typeof gameState.last_result === 'string' ? JSON.parse(gameState.last_result) : gameState.last_result;
                console.log('解析后的阵列:', lastResult);
            }
        }
        
        // 3. 检查相关的下注记录
        const bets = await db.manyOrNone(`
            SELECT id, username, bet_type, bet_value, position, amount, win, win_amount
            FROM bet_history
            WHERE period = $1
            ORDER BY id
        `, ['20250717697']);
        
        if (bets && bets.length > 0) {
            console.log(`\n\n找到 ${bets.length} 笔下注记录：`);
            bets.forEach((bet, idx) => {
                console.log(`${idx + 1}. ID:${bet.id}, 用户:${bet.username}, ` +
                           `类型:${bet.bet_type}, 值:${bet.bet_value}, ` +
                           `位置:${bet.position || 'N/A'}, 金额:${bet.amount}, ` +
                           `中奖:${bet.win ? '是' : '否'}, 派彩:${bet.win_amount || 0}`);
            });
        }
        
        // 4. 分析问题
        console.log('\n\n问题分析：');
        console.log('1. 资料库储存的开奖结果应该是按照位置顺序 (position_1 到 position_10)');
        console.log('2. 前端显示时需要确保正确读取各位置的号码');
        console.log('3. 可能是前端显示逻辑或资料传输时的顺序问题');
        
    } catch (error) {
        console.error('检查错误:', error);
    } finally {
        process.exit();
    }
}

checkPeriod697();