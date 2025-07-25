// fix-result-json-consistency.js - 修復 result JSON 欄位與 position 欄位的一致性
import db from './db/config.js';

async function fixResultJsonConsistency() {
    console.log('========== 修復 result JSON 欄位一致性 ==========\n');
    
    try {
        // 1. 找出所有不一致的記錄
        const inconsistentResults = await db.manyOrNone(`
            SELECT 
                period,
                result::text as result_json,
                position_1, position_2, position_3, position_4, position_5,
                position_6, position_7, position_8, position_9, position_10
            FROM result_history
            WHERE 1=1
        `);
        
        let inconsistentCount = 0;
        const toFix = [];
        
        for (const record of inconsistentResults) {
            const jsonResult = record.result_json ? JSON.parse(record.result_json) : null;
            const positionArray = [];
            for (let i = 1; i <= 10; i++) {
                positionArray.push(record[`position_${i}`]);
            }
            
            if (jsonResult && JSON.stringify(jsonResult) !== JSON.stringify(positionArray)) {
                inconsistentCount++;
                toFix.push({
                    period: record.period,
                    jsonResult: jsonResult,
                    positionArray: positionArray
                });
                
                if (inconsistentCount <= 5) { // 只顯示前5筆
                    console.log(`發現不一致: 期號 ${record.period}`);
                    console.log(`  JSON: ${JSON.stringify(jsonResult)}`);
                    console.log(`  Position: ${JSON.stringify(positionArray)}`);
                }
            }
        }
        
        if (inconsistentCount > 5) {
            console.log(`... 還有 ${inconsistentCount - 5} 筆不一致的記錄`);
        }
        
        console.log(`\n總共發現 ${inconsistentCount} 筆不一致的記錄`);
        
        if (inconsistentCount > 0) {
            console.log('\n開始修復...');
            
            // 2. 修復不一致的記錄（以 position_* 欄位為準）
            await db.tx(async t => {
                for (const fix of toFix) {
                    await t.none(`
                        UPDATE result_history
                        SET result = $1::json
                        WHERE period = $2
                    `, [JSON.stringify(fix.positionArray), fix.period]);
                }
            });
            
            console.log(`✅ 已修復 ${inconsistentCount} 筆記錄`);
            
            // 3. 驗證修復結果
            console.log('\n驗證修復結果（檢查前5筆）：');
            for (let i = 0; i < Math.min(5, toFix.length); i++) {
                const verified = await db.oneOrNone(`
                    SELECT 
                        result::text as result_json,
                        position_1
                    FROM result_history
                    WHERE period = $1
                `, [toFix[i].period]);
                
                const newJson = JSON.parse(verified.result_json);
                console.log(`  期號 ${toFix[i].period}: ${newJson[0] === verified.position_1 ? '✅ 已修復' : '❌ 修復失敗'}`);
            }
        } else {
            console.log('\n✅ 所有記錄都已經一致，無需修復');
        }
        
        // 4. 特別檢查期號 20250718493
        console.log('\n特別驗證期號 20250718493：');
        const check493 = await db.oneOrNone(`
            SELECT 
                result::text as result_json,
                position_1, position_2, position_3
            FROM result_history
            WHERE period = '20250718493'
        `);
        
        if (check493) {
            const json = JSON.parse(check493.result_json);
            console.log(`  JSON result 第1-3名: [${json[0]}, ${json[1]}, ${json[2]}]`);
            console.log(`  Position 第1-3名: [${check493.position_1}, ${check493.position_2}, ${check493.position_3}]`);
            console.log(`  是否一致: ${json[0] === check493.position_1 ? '✅ 是' : '❌ 否'}`);
        }
        
    } catch (error) {
        console.error('修復過程中發生錯誤:', error);
    }
    
    process.exit();
}

// 執行修復
fixResultJsonConsistency();