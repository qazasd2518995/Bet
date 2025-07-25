// ensure-result-consistency.js - 確保開獎結果一致性的輔助函數
import db from './db/config.js';

/**
 * 驗證並修復單個期號的結果一致性
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
    
    // 檢查是否一致
    if (jsonResult && JSON.stringify(jsonResult) !== JSON.stringify(positionArray)) {
        // 不一致，以 position_* 為準更新 result
        await db.none(`
            UPDATE result_history
            SET result = $1::json
            WHERE period = $2
        `, [JSON.stringify(positionArray), period]);
        
        console.log(`✅ 修復期號 ${period} 的結果一致性`);
        return positionArray;
    }
    
    return positionArray;
}

/**
 * 獲取開獎結果的統一介面（確保使用 position_* 欄位）
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
    
    // 構建統一的結果物件
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
 * 批量獲取開獎結果（確保使用 position_* 欄位）
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

// 如果直接執行此檔案，執行測試
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('測試結果一致性函數...\n');
    
    // 測試特定期號
    const testPeriod = '20250718493';
    console.log(`檢查期號 ${testPeriod}:`);
    
    const result = await getDrawResult(testPeriod);
    if (result) {
        console.log(`  期號: ${result.period}`);
        console.log(`  開獎結果: [${result.positions.join(', ')}]`);
        console.log(`  開獎時間: ${result.drawTime}`);
    } else {
        console.log('  找不到該期號');
    }
    
    // 測試批量獲取
    console.log('\n最近5期開獎結果：');
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