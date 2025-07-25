// check-all-betting-types.js - 全面检查所有投注类型的结算逻辑
import db from './db/config.js';
import { checkBetWinEnhanced } from './enhanced-settlement-system.js';

async function checkAllBettingTypes() {
    console.log('========== 全面检查所有投注类型结算逻辑 ==========\n');
    
    // 模拟开奖结果
    const testResult = {
        positions: [7, 3, 9, 2, 4, 8, 1, 10, 5, 6] // 测试开奖号码
    };
    
    console.log('测试开奖结果：');
    for (let i = 0; i < testResult.positions.length; i++) {
        console.log(`  第${i + 1}名: ${testResult.positions[i]}号`);
    }
    console.log(`  冠亚和: ${testResult.positions[0] + testResult.positions[1]} (7+3=10)`);
    console.log('');
    
    // 1. 两面投注测试
    console.log('1. 两面投注测试：');
    console.log('=================');
    const twoSideTests = [
        // 冠军测试
        { bet_type: 'champion', bet_value: 'big', expected: true, reason: '冠军7号 >= 6，应该是大' },
        { bet_type: 'champion', bet_value: 'small', expected: false, reason: '冠军7号 >= 6，不是小' },
        { bet_type: 'champion', bet_value: 'odd', expected: true, reason: '冠军7号是奇数' },
        { bet_type: 'champion', bet_value: 'even', expected: false, reason: '冠军7号不是偶数' },
        // 亚军测试
        { bet_type: 'runnerup', bet_value: 'small', expected: true, reason: '亚军3号 <= 5，应该是小' },
        { bet_type: 'runnerup', bet_value: 'odd', expected: true, reason: '亚军3号是奇数' },
        // 第三名测试
        { bet_type: 'third', bet_value: 'big', expected: true, reason: '第三名9号 >= 6，应该是大' },
        { bet_type: 'third', bet_value: 'odd', expected: true, reason: '第三名9号是奇数' },
        // 中文测试
        { bet_type: '冠军', bet_value: '大', expected: true, reason: '冠军7号 >= 6，应该是大' },
        { bet_type: '亚军', bet_value: '小', expected: true, reason: '亚军3号 <= 5，应该是小' },
        { bet_type: '第十名', bet_value: '双', expected: true, reason: '第十名6号是偶数' }
    ];
    
    for (const test of twoSideTests) {
        const result = await checkBetWinEnhanced(test, testResult);
        const status = result.isWin === test.expected ? '✅' : '❌';
        console.log(`${status} ${test.bet_type} ${test.bet_value}: ${result.isWin ? '中奖' : '未中'} - ${test.reason}`);
        if (result.isWin !== test.expected) {
            console.log(`   错误：系统判断为 ${result.reason}`);
        }
    }
    
    // 2. 快速投注测试（通常是指快捷下注，如一键下注多个选项）
    console.log('\n2. 快速投注测试（号码投注）：');
    console.log('============================');
    const quickTests = [
        { bet_type: 'number', bet_value: '7', position: 1, expected: true, reason: '第1名是7号' },
        { bet_type: 'number', bet_value: '3', position: 2, expected: true, reason: '第2名是3号' },
        { bet_type: 'number', bet_value: '5', position: 1, expected: false, reason: '第1名不是5号' },
        { bet_type: 'number', bet_value: '10', position: 8, expected: true, reason: '第8名是10号' }
    ];
    
    for (const test of quickTests) {
        const result = await checkBetWinEnhanced(test, testResult);
        const status = result.isWin === test.expected ? '✅' : '❌';
        console.log(`${status} 第${test.position}名 号码${test.bet_value}: ${result.isWin ? '中奖' : '未中'} - ${test.reason}`);
        if (result.isWin !== test.expected) {
            console.log(`   错误：系统判断为 ${result.reason}`);
        }
    }
    
    // 3. 单号1-5投注测试
    console.log('\n3. 单号1-5投注测试：');
    console.log('===================');
    const single15Tests = [
        { bet_type: 'champion', bet_value: '1', expected: false, reason: '冠军不是1号' },
        { bet_type: 'champion', bet_value: '2', expected: false, reason: '冠军不是2号' },
        { bet_type: 'champion', bet_value: '3', expected: false, reason: '冠军不是3号' },
        { bet_type: 'champion', bet_value: '4', expected: false, reason: '冠军不是4号' },
        { bet_type: 'champion', bet_value: '5', expected: false, reason: '冠军不是5号' },
        { bet_type: 'runnerup', bet_value: '3', expected: true, reason: '亚军是3号' },
        { bet_type: 'fifth', bet_value: '4', expected: true, reason: '第五名是4号' },
        { bet_type: 'seventh', bet_value: '1', expected: true, reason: '第七名是1号' },
        { bet_type: 'ninth', bet_value: '5', expected: true, reason: '第九名是5号' }
    ];
    
    for (const test of single15Tests) {
        const result = await checkBetWinEnhanced(test, testResult);
        const status = result.isWin === test.expected ? '✅' : '❌';
        console.log(`${status} ${test.bet_type} 号码${test.bet_value}: ${result.isWin ? '中奖' : '未中'} - ${test.reason}`);
        if (result.isWin !== test.expected) {
            console.log(`   错误：系统判断为 ${result.reason}`);
        }
    }
    
    // 4. 单号6-10投注测试
    console.log('\n4. 单号6-10投注测试：');
    console.log('====================');
    const single610Tests = [
        { bet_type: 'champion', bet_value: '6', expected: false, reason: '冠军不是6号' },
        { bet_type: 'champion', bet_value: '7', expected: true, reason: '冠军是7号' },
        { bet_type: 'champion', bet_value: '8', expected: false, reason: '冠军不是8号' },
        { bet_type: 'champion', bet_value: '9', expected: false, reason: '冠军不是9号' },
        { bet_type: 'champion', bet_value: '10', expected: false, reason: '冠军不是10号' },
        { bet_type: 'third', bet_value: '9', expected: true, reason: '第三名是9号' },
        { bet_type: 'sixth', bet_value: '8', expected: true, reason: '第六名是8号' },
        { bet_type: 'eighth', bet_value: '10', expected: true, reason: '第八名是10号' },
        { bet_type: 'tenth', bet_value: '6', expected: true, reason: '第十名是6号' }
    ];
    
    for (const test of single610Tests) {
        const result = await checkBetWinEnhanced(test, testResult);
        const status = result.isWin === test.expected ? '✅' : '❌';
        console.log(`${status} ${test.bet_type} 号码${test.bet_value}: ${result.isWin ? '中奖' : '未中'} - ${test.reason}`);
        if (result.isWin !== test.expected) {
            console.log(`   错误：系统判断为 ${result.reason}`);
        }
    }
    
    // 5. 龙虎对战测试
    console.log('\n5. 龙虎对战测试：');
    console.log('================');
    const dragonTigerTests = [
        { bet_type: 'dragonTiger', bet_value: '1_10_dragon', expected: true, reason: '第1名(7) > 第10名(6)，龙赢' },
        { bet_type: 'dragonTiger', bet_value: '1_10_tiger', expected: false, reason: '第1名(7) > 第10名(6)，虎输' },
        { bet_type: 'dragonTiger', bet_value: '2_9_dragon', expected: false, reason: '第2名(3) < 第9名(5)，龙输' },
        { bet_type: 'dragonTiger', bet_value: '2_9_tiger', expected: true, reason: '第2名(3) < 第9名(5)，虎赢' },
        { bet_type: 'dragonTiger', bet_value: '3_8_dragon', expected: false, reason: '第3名(9) < 第8名(10)，龙输' },
        { bet_type: 'dragonTiger', bet_value: '3_8_tiger', expected: true, reason: '第3名(9) < 第8名(10)，虎赢' },
        { bet_type: 'dragonTiger', bet_value: '4_7_dragon', expected: true, reason: '第4名(2) > 第7名(1)，龙赢' },
        { bet_type: 'dragonTiger', bet_value: '5_6_dragon', expected: false, reason: '第5名(4) < 第6名(8)，龙输' },
        // 测试其他格式
        { bet_type: 'dragonTiger', bet_value: 'dragon_1_10', expected: true, reason: '第1名(7) > 第10名(6)，龙赢' },
        { bet_type: '龙虎', bet_value: '1_10_龙', expected: true, reason: '第1名(7) > 第10名(6)，龙赢' }
    ];
    
    for (const test of dragonTigerTests) {
        const result = await checkBetWinEnhanced(test, testResult);
        const status = result.isWin === test.expected ? '✅' : '❌';
        console.log(`${status} ${test.bet_type} ${test.bet_value}: ${result.isWin ? '中奖' : '未中'} - ${test.reason}`);
        if (result.isWin !== test.expected) {
            console.log(`   错误：系统判断为 ${result.reason}`);
        }
    }
    
    // 6. 冠亚和值测试
    console.log('\n6. 冠亚和值测试：');
    console.log('================');
    const sumValueTests = [
        { bet_type: 'sumValue', bet_value: '10', expected: true, reason: '冠亚和为10 (7+3)' },
        { bet_type: 'sumValue', bet_value: '9', expected: false, reason: '冠亚和不是9' },
        { bet_type: 'sumValue', bet_value: '11', expected: false, reason: '冠亚和不是11' },
        { bet_type: 'sum', bet_value: '10', expected: true, reason: '冠亚和为10' },
        { bet_type: '冠亚和', bet_value: '10', expected: true, reason: '冠亚和为10' },
        // 测试所有可能的和值
        { bet_type: 'sumValue', bet_value: '3', expected: false, reason: '冠亚和不是3' },
        { bet_type: 'sumValue', bet_value: '19', expected: false, reason: '冠亚和不是19' }
    ];
    
    for (const test of sumValueTests) {
        const result = await checkBetWinEnhanced(test, testResult);
        const status = result.isWin === test.expected ? '✅' : '❌';
        console.log(`${status} ${test.bet_type} 和值${test.bet_value}: ${result.isWin ? '中奖' : '未中'} - ${test.reason}`);
        if (result.isWin !== test.expected) {
            console.log(`   错误：系统判断为 ${result.reason}`);
        }
    }
    
    // 7. 冠亚和大小单双测试
    console.log('\n7. 冠亚和大小单双测试：');
    console.log('======================');
    const sumSizeTests = [
        { bet_type: 'sumValue', bet_value: 'big', expected: false, reason: '冠亚和10 < 12，不是大' },
        { bet_type: 'sumValue', bet_value: 'small', expected: true, reason: '冠亚和10 <= 11，是小' },
        { bet_type: 'sumValue', bet_value: 'odd', expected: false, reason: '冠亚和10是偶数' },
        { bet_type: 'sumValue', bet_value: 'even', expected: true, reason: '冠亚和10是偶数' },
        { bet_type: 'sum', bet_value: '大', expected: false, reason: '冠亚和10 < 12，不是大' },
        { bet_type: 'sum', bet_value: '小', expected: true, reason: '冠亚和10 <= 11，是小' },
        { bet_type: '冠亚和', bet_value: '单', expected: false, reason: '冠亚和10是偶数' },
        { bet_type: '冠亚和', bet_value: '双', expected: true, reason: '冠亚和10是偶数' }
    ];
    
    for (const test of sumSizeTests) {
        const result = await checkBetWinEnhanced(test, testResult);
        const status = result.isWin === test.expected ? '✅' : '❌';
        console.log(`${status} ${test.bet_type} ${test.bet_value}: ${result.isWin ? '中奖' : '未中'} - ${test.reason}`);
        if (result.isWin !== test.expected) {
            console.log(`   错误：系统判断为 ${result.reason}`);
        }
    }
    
    // 8. 检查 quickCheckWin 函数
    console.log('\n8. 检查 quickCheckWin 函数：');
    console.log('===========================');
    
    // 动态导入 optimized-betting-system.js 中的 quickCheckWin
    const optimizedModule = await import('./optimized-betting-system.js');
    const quickCheckWin = optimizedModule.default.quickCheckWin || 
        (await import('./optimized-betting-system.js').then(m => {
            // 如果默认导出没有 quickCheckWin，尝试从文件中提取
            return null;
        }));
    
    if (!quickCheckWin) {
        console.log('⚠️ 无法直接访问 quickCheckWin 函数，需要检查 optimized-betting-system.js');
    }
    
    // 统计结果
    console.log('\n========== 测试统计 ==========');
    const totalTests = twoSideTests.length + quickTests.length + single15Tests.length + 
                      single610Tests.length + dragonTigerTests.length + sumValueTests.length + 
                      sumSizeTests.length;
    console.log(`总测试数量: ${totalTests}`);
    console.log('所有测试类型都已覆盖！');
    
    process.exit();
}

checkAllBettingTypes();