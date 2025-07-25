// analyze-data-format.js - 分析數據格式問題
import db from './db/config.js';

async function analyzeDataFormat() {
    console.log('🔍 深入分析期號219的數據格式問題...\n');
    
    try {
        // 1. 分析開獎結果的數據格式
        console.log('📊 分析開獎結果數據格式：');
        const result = await db.one(`
            SELECT period, result, created_at
            FROM result_history
            WHERE period = 20250714219
        `);
        
        console.log(`期號: ${result.period}`);
        console.log(`原始結果: ${result.result}`);
        console.log(`數據類型: ${typeof result.result}`);
        console.log(`是否為字符串: ${typeof result.result === 'string'}`);
        
        // 解析結果的多種方式
        console.log('\n🔧 嘗試不同的解析方式：');
        
        let parsedResults = [];
        
        // 方式1: 直接使用（如果是數組）
        if (Array.isArray(result.result)) {
            parsedResults.push({
                method: '直接數組',
                result: result.result,
                position7: result.result[6]
            });
        }
        
        // 方式2: 字符串逗號分割
        if (typeof result.result === 'string' && result.result.includes(',')) {
            try {
                const commaSplit = result.result.split(',').map(n => parseInt(n.trim()));
                parsedResults.push({
                    method: '逗號分割',
                    result: commaSplit,
                    position7: commaSplit[6]
                });
            } catch (e) {
                console.log(`逗號分割錯誤: ${e.message}`);
            }
        }
        
        // 方式3: JSON解析
        try {
            const jsonParsed = JSON.parse(JSON.stringify(result.result));
            if (Array.isArray(jsonParsed)) {
                parsedResults.push({
                    method: 'JSON解析',
                    result: jsonParsed,
                    position7: jsonParsed[6]
                });
            }
        } catch (e) {
            console.log(`JSON解析錯誤: ${e.message}`);
        }
        
        // 顯示所有解析結果
        parsedResults.forEach((parsed, idx) => {
            console.log(`方式 ${idx + 1} (${parsed.method}):`);
            console.log(`  完整結果: [${parsed.result.join(',')}]`);
            console.log(`  第7名 (索引6): ${parsed.position7}號`);
            console.log('');
        });
        
        // 2. 檢查結算系統實際接收到的數據格式
        console.log('🎯 模擬結算系統的數據處理：');
        
        // 模擬backend.js中的數據傳遞
        console.log('Backend.js 傳遞格式:');
        console.log('- 修復前: settleBets(period, newResult)  // newResult是數組');
        console.log('- 修復後: settleBets(period, { positions: newResult })  // 包裝成對象');
        
        // 檢查當前的開獎結果會如何被處理
        const simulateOldFormat = parsedResults[0]?.result || [];
        const simulateNewFormat = { positions: simulateOldFormat };
        
        console.log('\n模擬數據傳遞：');
        console.log(`舊格式 (數組): [${simulateOldFormat.join(',')}]`);
        console.log(`新格式 (對象): ${JSON.stringify(simulateNewFormat)}`);
        
        // 3. 檢查improved-settlement-system.js的checkWin函數
        console.log('\n🔍 分析checkWin函數的邏輯：');
        console.log('checkWin函數期望的格式: winResult.positions[position-1]');
        console.log('對於第7名投注，使用索引: winResult.positions[7-1] = winResult.positions[6]');
        
        if (parsedResults.length > 0) {
            const testData = parsedResults[0].result;
            console.log(`\n使用實際數據測試:`);
            console.log(`winResult = { positions: [${testData.join(',')}] }`);
            console.log(`第7名號碼: positions[6] = ${testData[6]}`);
            
            // 測試各個投注的中獎邏輯
            const testBets = [
                { bet_value: '2', position: 7, desc: '投注2號' },
                { bet_value: '3', position: 7, desc: '投注3號' },
                { bet_value: '9', position: 7, desc: '投注9號' }
            ];
            
            console.log('\n投注中獎測試：');
            testBets.forEach(bet => {
                const shouldWin = testData[bet.position - 1] === parseInt(bet.bet_value);
                console.log(`${bet.desc}: ${shouldWin ? '應該中獎 ✅' : '應該未中獎 ❌'}`);
            });
        }
        
        // 4. 檢查可能的數據格式混淆問題
        console.log('\n⚠️ 可能的問題源頭：');
        
        // 檢查result_history中的數據是否一致
        const recentResults = await db.any(`
            SELECT period, result, created_at
            FROM result_history
            WHERE period >= 20250714218
            ORDER BY period ASC
            LIMIT 3
        `);
        
        console.log('\n最近幾期的結果格式：');
        recentResults.forEach(r => {
            console.log(`期號 ${r.period}:`);
            console.log(`  結果: ${r.result}`);
            console.log(`  類型: ${typeof r.result}`);
            
            // 嘗試解析第7名
            try {
                let positions = [];
                if (typeof r.result === 'string' && r.result.includes(',')) {
                    positions = r.result.split(',').map(n => parseInt(n.trim()));
                } else if (Array.isArray(r.result)) {
                    positions = r.result;
                }
                
                if (positions.length >= 7) {
                    console.log(`  第7名: ${positions[6]}號`);
                } else {
                    console.log(`  第7名: 無法解析`);
                }
            } catch (e) {
                console.log(`  第7名: 解析錯誤 - ${e.message}`);
            }
            console.log('');
        });
        
        // 5. 檢查是否有時間差問題
        console.log('⏰ 檢查時間相關問題：');
        
        const betCreationTimes = await db.any(`
            SELECT id, bet_value, created_at, settled_at
            FROM bet_history
            WHERE period = 20250714219
            AND position = 7
            ORDER BY id ASC
        `);
        
        console.log('投注創建時間 vs 開獎時間：');
        console.log(`開獎時間: ${result.created_at}`);
        console.log('投注時間：');
        betCreationTimes.forEach(bet => {
            const timeDiff = new Date(result.created_at) - new Date(bet.created_at);
            console.log(`  ID ${bet.id} (${bet.bet_value}號): ${bet.created_at}, 時差: ${Math.round(timeDiff/1000)}秒`);
        });
        
        console.log('\n🔍 結論和建議：');
        console.log('1. 檢查數據格式轉換是否正確');
        console.log('2. 確認checkWin函數使用的數據格式');
        console.log('3. 驗證位置索引計算 (0-based vs 1-based)');
        console.log('4. 檢查是否有多個結算進程同時運行');
        console.log('5. 確認結算時間點的數據一致性');
        
    } catch (error) {
        console.error('分析過程中發生錯誤:', error);
    } finally {
        await db.$pool.end();
    }
}

// 執行分析
analyzeDataFormat();