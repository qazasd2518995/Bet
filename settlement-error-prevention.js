// 结算错误预防机制
import db from './db/config.js';

/**
 * 验证开奖结果的完整性和正确性
 */
export function validateDrawResult(drawResult) {
    // 标准化开奖结果
    let positions = null;
    
    if (drawResult.positions && Array.isArray(drawResult.positions)) {
        positions = drawResult.positions;
    } else if (drawResult.result && Array.isArray(drawResult.result)) {
        positions = drawResult.result;
    } else if (drawResult.position_1 !== undefined) {
        positions = [];
        for (let i = 1; i <= 10; i++) {
            positions.push(drawResult[`position_${i}`]);
        }
    } else if (Array.isArray(drawResult) && drawResult.length === 10) {
        positions = drawResult;
    }
    
    // 验证结果
    if (!positions || positions.length !== 10) {
        throw new Error('开奖结果格式错误：必须包含10个位置');
    }
    
    // 检查每个号码是否在有效范围内
    const usedNumbers = new Set();
    for (let i = 0; i < 10; i++) {
        const num = parseInt(positions[i]);
        
        if (isNaN(num) || num < 1 || num > 10) {
            throw new Error(`第${i + 1}名的开奖号码无效：${positions[i]}`);
        }
        
        if (usedNumbers.has(num)) {
            throw new Error(`开奖号码重复：${num} 出现多次`);
        }
        
        usedNumbers.add(num);
    }
    
    // 确保1-10每个号码都出现一次
    if (usedNumbers.size !== 10) {
        throw new Error('开奖结果错误：必须包含1-10所有号码');
    }
    
    return { positions: positions.map(n => parseInt(n)) };
}

/**
 * 双重验证中奖判定
 */
export function doubleCheckWinning(bet, drawResult) {
    const { positions } = drawResult;
    
    if (bet.bet_type !== 'number' || !bet.position) {
        return null; // 不是号码投注，跳过
    }
    
    const position = parseInt(bet.position);
    const betValue = parseInt(bet.bet_value);
    const winningNumber = parseInt(positions[position - 1]);
    
    // 多种比较方式
    const checks = {
        strictEqual: winningNumber === betValue,
        looseEqual: winningNumber == betValue,
        stringEqual: String(winningNumber) === String(betValue),
        trimEqual: String(winningNumber).trim() === String(betValue).trim()
    };
    
    // 如果有任何不一致，记录警告
    const allChecks = Object.values(checks);
    if (!allChecks.every(v => v === allChecks[0])) {
        console.warn(`⚠️ 中奖判定不一致: 投注ID=${bet.id}, 检查结果=${JSON.stringify(checks)}`);
    }
    
    return {
        shouldWin: checks.strictEqual,
        position: position,
        betNumber: betValue,
        winningNumber: winningNumber,
        checks: checks
    };
}

/**
 * 结算前的完整性检查
 */
export async function preSettlementCheck(period) {
    console.log(`🔍 执行结算前检查: 期号 ${period}`);
    
    try {
        // 1. 检查开奖结果是否存在
        const drawResult = await db.oneOrNone(`
            SELECT * FROM result_history
            WHERE period = $1
        `, [period]);
        
        if (!drawResult) {
            throw new Error(`期号 ${period} 的开奖结果不存在`);
        }
        
        // 2. 验证开奖结果
        const validatedResult = validateDrawResult(drawResult);
        console.log(`✅ 开奖结果验证通过: ${JSON.stringify(validatedResult.positions)}`);
        
        // 3. 检查是否有未结算的投注
        const unsettledCount = await db.one(`
            SELECT COUNT(*) as count
            FROM bet_history
            WHERE period = $1 AND settled = false
        `, [period]);
        
        console.log(`📊 未结算投注数: ${unsettledCount.count}`);
        
        // 4. 检查是否已经结算过
        const settledCount = await db.one(`
            SELECT COUNT(*) as count
            FROM bet_history
            WHERE period = $1 AND settled = true
        `, [period]);
        
        if (parseInt(settledCount.count) > 0) {
            console.warn(`⚠️ 期号 ${period} 已有 ${settledCount.count} 笔已结算投注`);
        }
        
        // 5. 检查号码投注的预期结果
        const numberBets = await db.manyOrNone(`
            SELECT id, username, position, bet_value, amount, odds
            FROM bet_history
            WHERE period = $1 
            AND bet_type = 'number'
            AND settled = false
            ORDER BY position, bet_value
        `, [period]);
        
        if (numberBets.length > 0) {
            console.log(`\n📋 号码投注预览 (共${numberBets.length}笔):`);
            let previewCount = 0;
            
            for (const bet of numberBets) {
                const check = doubleCheckWinning(bet, validatedResult);
                if (check && previewCount < 5) {
                    console.log(`- ${bet.username} 投注第${check.position}名号码${check.betNumber}: ${check.shouldWin ? '将中奖' : '未中奖'} (开出${check.winningNumber})`);
                    previewCount++;
                }
            }
        }
        
        return {
            success: true,
            drawResult: validatedResult,
            unsettledCount: parseInt(unsettledCount.count),
            settledCount: parseInt(settledCount.count)
        };
        
    } catch (error) {
        console.error(`❌ 结算前检查失败: ${error.message}`);
        return {
            success: false,
            error: error.message
        };
    }
}

// 如果直接执行此文件，进行测试
if (import.meta.url === `file://${process.argv[1]}`) {
    // 测试验证函数
    console.log('🧪 测试结算错误预防机制\n');
    
    // 测试开奖结果验证
    try {
        const testResult1 = { positions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] };
        validateDrawResult(testResult1);
        console.log('✅ 测试1通过：正常开奖结果');
        
        const testResult2 = { result: [10, 9, 8, 7, 6, 5, 4, 3, 2, 1] };
        validateDrawResult(testResult2);
        console.log('✅ 测试2通过：不同格式的开奖结果');
        
        try {
            const testResult3 = { positions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 9] }; // 重复号码
            validateDrawResult(testResult3);
        } catch (e) {
            console.log('✅ 测试3通过：正确检测到重复号码');
        }
        
        try {
            const testResult4 = { positions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 11] }; // 超出范围
            validateDrawResult(testResult4);
        } catch (e) {
            console.log('✅ 测试4通过：正确检测到无效号码');
        }
        
    } catch (error) {
        console.error('测试失败：', error);
    }
    
    process.exit(0);
}