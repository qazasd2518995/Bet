// ensure-result-consistency.js - 确保开奖结果一致性的辅助函数
import db from './db/config.js';

/**
 * 验证并修复单个期号的结果一致性
 */
export async function ensureResultConsistency(period) {
    const record = await db.oneOrNone(`
        SELECT 
            result::text as result_json,
            position_1, position_2, position_3, position_4, position_5,
            position_6, position_7, position_8, position_9, position_10
        FROM result_history
        WHERE period = $1
    `, [period]);
    
    if (!record) return null;
    
    const jsonResult = record.result_json ? JSON.parse(record.result_json) : null;
    const positionArray = [];
    for (let i = 1; i <= 10; i++) {
        positionArray.push(record[`position_${i}`]);
    }
    
    // 检查是否一致
    if (jsonResult && JSON.stringify(jsonResult) !== JSON.stringify(positionArray)) {
        // 不一致，以 position_* 为准更新 result
        await db.none(`
            UPDATE result_history
            SET result = $1::json
            WHERE period = $2
        `, [JSON.stringify(positionArray), period]);
        
        console.log(`✅ 修复期号 ${period} 的结果一致性`);
        return positionArray;
    }
    
    return positionArray;
}

/**
 * 获取开奖结果的统一介面（确保使用 position_* 栏位）
 */
export async function getDrawResult(period) {
    const result = await db.oneOrNone(`
        SELECT 
            period,
            position_1, position_2, position_3, position_4, position_5,
            position_6, position_7, position_8, position_9, position_10,
            draw_time,
            block_height,
            block_hash
        FROM result_history
        WHERE period = $1
    `, [period]);
    
    if (!result) return null;
    
    // 构建统一的结果物件
    const positions = [];
    for (let i = 1; i <= 10; i++) {
        positions.push(result[`position_${i}`]);
    }
    
    return {
        period: result.period,
        positions: positions,
        drawTime: result.draw_time,
        blockHeight: result.block_height,
        blockHash: result.block_hash
    };
}

/**
 * 批量获取开奖结果（确保使用 position_* 栏位）
 */
export async function getDrawResults(limit = 10) {
    const results = await db.manyOrNone(`
        SELECT 
            period,
            position_1, position_2, position_3, position_4, position_5,
            position_6, position_7, position_8, position_9, position_10,
            draw_time,
            block_height,
            block_hash
        FROM result_history
        ORDER BY period DESC
        LIMIT $1
    `, [limit]);
    
    return results.map(result => {
        const positions = [];
        for (let i = 1; i <= 10; i++) {
            positions.push(result[`position_${i}`]);
        }
        
        return {
            period: result.period,
            positions: positions,
            drawTime: result.draw_time,
            blockHeight: result.block_height,
            blockHash: result.block_hash
        };
    });
}

// 如果直接执行此档案，执行测试
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('测试结果一致性函数...\n');
    
    // 测试特定期号
    const testPeriod = '20250718493';
    console.log(`检查期号 ${testPeriod}:`);
    
    const result = await getDrawResult(testPeriod);
    if (result) {
        console.log(`  期号: ${result.period}`);
        console.log(`  开奖结果: [${result.positions.join(', ')}]`);
        console.log(`  开奖时间: ${result.drawTime}`);
    } else {
        console.log('  找不到该期号');
    }
    
    // 测试批量获取
    console.log('\n最近5期开奖结果：');
    const recentResults = await getDrawResults(5);
    for (const res of recentResults) {
        console.log(`  ${res.period}: [${res.positions.join(', ')}]`);
    }
    
    process.exit();
}

export default {
    ensureResultConsistency,
    getDrawResult,
    getDrawResults
};