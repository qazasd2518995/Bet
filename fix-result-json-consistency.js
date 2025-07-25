// fix-result-json-consistency.js - 修复 result JSON 栏位与 position 栏位的一致性
import db from './db/config.js';

async function fixResultJsonConsistency() {
    console.log('========== 修复 result JSON 栏位一致性 ==========\n');
    
    try {
        // 1. 找出所有不一致的记录
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
                
                if (inconsistentCount <= 5) { // 只显示前5笔
                    console.log(`发现不一致: 期号 ${record.period}`);
                    console.log(`  JSON: ${JSON.stringify(jsonResult)}`);
                    console.log(`  Position: ${JSON.stringify(positionArray)}`);
                }
            }
        }
        
        if (inconsistentCount > 5) {
            console.log(`... 还有 ${inconsistentCount - 5} 笔不一致的记录`);
        }
        
        console.log(`\n总共发现 ${inconsistentCount} 笔不一致的记录`);
        
        if (inconsistentCount > 0) {
            console.log('\n开始修复...');
            
            // 2. 修复不一致的记录（以 position_* 栏位为准）
            await db.tx(async t => {
                for (const fix of toFix) {
                    await t.none(`
                        UPDATE result_history
                        SET result = $1::json
                        WHERE period = $2
                    `, [JSON.stringify(fix.positionArray), fix.period]);
                }
            });
            
            console.log(`✅ 已修复 ${inconsistentCount} 笔记录`);
            
            // 3. 验证修复结果
            console.log('\n验证修复结果（检查前5笔）：');
            for (let i = 0; i < Math.min(5, toFix.length); i++) {
                const verified = await db.oneOrNone(`
                    SELECT 
                        result::text as result_json,
                        position_1
                    FROM result_history
                    WHERE period = $1
                `, [toFix[i].period]);
                
                const newJson = JSON.parse(verified.result_json);
                console.log(`  期号 ${toFix[i].period}: ${newJson[0] === verified.position_1 ? '✅ 已修复' : '❌ 修复失败'}`);
            }
        } else {
            console.log('\n✅ 所有记录都已经一致，无需修复');
        }
        
        // 4. 特别检查期号 20250718493
        console.log('\n特别验证期号 20250718493：');
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
        console.error('修复过程中发生错误:', error);
    }
    
    process.exit();
}

// 执行修复
fixResultJsonConsistency();