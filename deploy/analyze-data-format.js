// analyze-data-format.js - 分析数据格式问题
import db from './db/config.js';

async function analyzeDataFormat() {
    console.log('🔍 深入分析期号219的数据格式问题...\n');
    
    try {
        // 1. 分析开奖结果的数据格式
        console.log('📊 分析开奖结果数据格式：');
        const result = await db.one(`
            SELECT period, result, created_at
            FROM result_history
            WHERE period = 20250714219
        `);
        
        console.log(`期号: ${result.period}`);
        console.log(`原始结果: ${result.result}`);
        console.log(`数据类型: ${typeof result.result}`);
        console.log(`是否为字符串: ${typeof result.result === 'string'}`);
        
        // 解析结果的多种方式
        console.log('\n🔧 尝试不同的解析方式：');
        
        let parsedResults = [];
        
        // 方式1: 直接使用（如果是数组）
        if (Array.isArray(result.result)) {
            parsedResults.push({
                method: '直接数组',
                result: result.result,
                position7: result.result[6]
            });
        }
        
        // 方式2: 字符串逗号分割
        if (typeof result.result === 'string' && result.result.includes(',')) {
            try {
                const commaSplit = result.result.split(',').map(n => parseInt(n.trim()));
                parsedResults.push({
                    method: '逗号分割',
                    result: commaSplit,
                    position7: commaSplit[6]
                });
            } catch (e) {
                console.log(`逗号分割错误: ${e.message}`);
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
            console.log(`JSON解析错误: ${e.message}`);
        }
        
        // 显示所有解析结果
        parsedResults.forEach((parsed, idx) => {
            console.log(`方式 ${idx + 1} (${parsed.method}):`);
            console.log(`  完整结果: [${parsed.result.join(',')}]`);
            console.log(`  第7名 (索引6): ${parsed.position7}号`);
            console.log('');
        });
        
        // 2. 检查结算系统实际接收到的数据格式
        console.log('🎯 模拟结算系统的数据处理：');
        
        // 模拟backend.js中的数据传递
        console.log('Backend.js 传递格式:');
        console.log('- 修复前: settleBets(period, newResult)  // newResult是数组');
        console.log('- 修复后: settleBets(period, { positions: newResult })  // 包装成对象');
        
        // 检查当前的开奖结果会如何被处理
        const simulateOldFormat = parsedResults[0]?.result || [];
        const simulateNewFormat = { positions: simulateOldFormat };
        
        console.log('\n模拟数据传递：');
        console.log(`旧格式 (数组): [${simulateOldFormat.join(',')}]`);
        console.log(`新格式 (对象): ${JSON.stringify(simulateNewFormat)}`);
        
        // 3. 检查improved-settlement-system.js的checkWin函数
        console.log('\n🔍 分析checkWin函数的逻辑：');
        console.log('checkWin函数期望的格式: winResult.positions[position-1]');
        console.log('对于第7名投注，使用索引: winResult.positions[7-1] = winResult.positions[6]');
        
        if (parsedResults.length > 0) {
            const testData = parsedResults[0].result;
            console.log(`\n使用实际数据测试:`);
            console.log(`winResult = { positions: [${testData.join(',')}] }`);
            console.log(`第7名号码: positions[6] = ${testData[6]}`);
            
            // 测试各个投注的中奖逻辑
            const testBets = [
                { bet_value: '2', position: 7, desc: '投注2号' },
                { bet_value: '3', position: 7, desc: '投注3号' },
                { bet_value: '9', position: 7, desc: '投注9号' }
            ];
            
            console.log('\n投注中奖测试：');
            testBets.forEach(bet => {
                const shouldWin = testData[bet.position - 1] === parseInt(bet.bet_value);
                console.log(`${bet.desc}: ${shouldWin ? '应该中奖 ✅' : '应该未中奖 ❌'}`);
            });
        }
        
        // 4. 检查可能的数据格式混淆问题
        console.log('\n⚠️ 可能的问题源头：');
        
        // 检查result_history中的数据是否一致
        const recentResults = await db.any(`
            SELECT period, result, created_at
            FROM result_history
            WHERE period >= 20250714218
            ORDER BY period ASC
            LIMIT 3
        `);
        
        console.log('\n最近几期的结果格式：');
        recentResults.forEach(r => {
            console.log(`期号 ${r.period}:`);
            console.log(`  结果: ${r.result}`);
            console.log(`  类型: ${typeof r.result}`);
            
            // 尝试解析第7名
            try {
                let positions = [];
                if (typeof r.result === 'string' && r.result.includes(',')) {
                    positions = r.result.split(',').map(n => parseInt(n.trim()));
                } else if (Array.isArray(r.result)) {
                    positions = r.result;
                }
                
                if (positions.length >= 7) {
                    console.log(`  第7名: ${positions[6]}号`);
                } else {
                    console.log(`  第7名: 无法解析`);
                }
            } catch (e) {
                console.log(`  第7名: 解析错误 - ${e.message}`);
            }
            console.log('');
        });
        
        // 5. 检查是否有时间差问题
        console.log('⏰ 检查时间相关问题：');
        
        const betCreationTimes = await db.any(`
            SELECT id, bet_value, created_at, settled_at
            FROM bet_history
            WHERE period = 20250714219
            AND position = 7
            ORDER BY id ASC
        `);
        
        console.log('投注创建时间 vs 开奖时间：');
        console.log(`开奖时间: ${result.created_at}`);
        console.log('投注时间：');
        betCreationTimes.forEach(bet => {
            const timeDiff = new Date(result.created_at) - new Date(bet.created_at);
            console.log(`  ID ${bet.id} (${bet.bet_value}号): ${bet.created_at}, 时差: ${Math.round(timeDiff/1000)}秒`);
        });
        
        console.log('\n🔍 结论和建议：');
        console.log('1. 检查数据格式转换是否正确');
        console.log('2. 确认checkWin函数使用的数据格式');
        console.log('3. 验证位置索引计算 (0-based vs 1-based)');
        console.log('4. 检查是否有多个结算进程同时运行');
        console.log('5. 确认结算时间点的数据一致性');
        
    } catch (error) {
        console.error('分析过程中发生错误:', error);
    } finally {
        await db.$pool.end();
    }
}

// 执行分析
analyzeDataFormat();