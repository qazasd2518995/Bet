// 結算錯誤預防機制
import db from './db/config.js';

/**
 * 驗證開獎結果的完整性和正確性
 */
export function validateDrawResult(drawResult) {
    // 標準化開獎結果
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
    
    // 驗證結果
    if (!positions || positions.length !== 10) {
        throw new Error('開獎結果格式錯誤：必須包含10個位置');
    }
    
    // 檢查每個號碼是否在有效範圍內
    const usedNumbers = new Set();
    for (let i = 0; i < 10; i++) {
        const num = parseInt(positions[i]);
        
        if (isNaN(num) || num < 1 || num > 10) {
            throw new Error(`第${i + 1}名的開獎號碼無效：${positions[i]}`);
        }
        
        if (usedNumbers.has(num)) {
            throw new Error(`開獎號碼重複：${num} 出現多次`);
        }
        
        usedNumbers.add(num);
    }
    
    // 確保1-10每個號碼都出現一次
    if (usedNumbers.size !== 10) {
        throw new Error('開獎結果錯誤：必須包含1-10所有號碼');
    }
    
    return { positions: positions.map(n => parseInt(n)) };
}

/**
 * 雙重驗證中獎判定
 */
export function doubleCheckWinning(bet, drawResult) {
    const { positions } = drawResult;
    
    if (bet.bet_type !== 'number' || !bet.position) {
        return null; // 不是號碼投注，跳過
    }
    
    const position = parseInt(bet.position);
    const betValue = parseInt(bet.bet_value);
    const winningNumber = parseInt(positions[position - 1]);
    
    // 多種比較方式
    const checks = {
        strictEqual: winningNumber === betValue,
        looseEqual: winningNumber == betValue,
        stringEqual: String(winningNumber) === String(betValue),
        trimEqual: String(winningNumber).trim() === String(betValue).trim()
    };
    
    // 如果有任何不一致，記錄警告
    const allChecks = Object.values(checks);
    if (!allChecks.every(v => v === allChecks[0])) {
        console.warn(`⚠️ 中獎判定不一致: 投注ID=${bet.id}, 檢查結果=${JSON.stringify(checks)}`);
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
 * 結算前的完整性檢查
 */
export async function preSettlementCheck(period) {
    console.log(`🔍 執行結算前檢查: 期號 ${period}`);
    
    try {
        // 1. 檢查開獎結果是否存在
        const drawResult = await db.oneOrNone(`
            SELECT * FROM result_history
            WHERE period = $1
        `, [period]);
        
        if (!drawResult) {
            throw new Error(`期號 ${period} 的開獎結果不存在`);
        }
        
        // 2. 驗證開獎結果
        const validatedResult = validateDrawResult(drawResult);
        console.log(`✅ 開獎結果驗證通過: ${JSON.stringify(validatedResult.positions)}`);
        
        // 3. 檢查是否有未結算的投注
        const unsettledCount = await db.one(`
            SELECT COUNT(*) as count
            FROM bet_history
            WHERE period = $1 AND settled = false
        `, [period]);
        
        console.log(`📊 未結算投注數: ${unsettledCount.count}`);
        
        // 4. 檢查是否已經結算過
        const settledCount = await db.one(`
            SELECT COUNT(*) as count
            FROM bet_history
            WHERE period = $1 AND settled = true
        `, [period]);
        
        if (parseInt(settledCount.count) > 0) {
            console.warn(`⚠️ 期號 ${period} 已有 ${settledCount.count} 筆已結算投注`);
        }
        
        // 5. 檢查號碼投注的預期結果
        const numberBets = await db.manyOrNone(`
            SELECT id, username, position, bet_value, amount, odds
            FROM bet_history
            WHERE period = $1 
            AND bet_type = 'number'
            AND settled = false
            ORDER BY position, bet_value
        `, [period]);
        
        if (numberBets.length > 0) {
            console.log(`\n📋 號碼投注預覽 (共${numberBets.length}筆):`);
            let previewCount = 0;
            
            for (const bet of numberBets) {
                const check = doubleCheckWinning(bet, validatedResult);
                if (check && previewCount < 5) {
                    console.log(`- ${bet.username} 投注第${check.position}名號碼${check.betNumber}: ${check.shouldWin ? '將中獎' : '未中獎'} (開出${check.winningNumber})`);
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
        console.error(`❌ 結算前檢查失敗: ${error.message}`);
        return {
            success: false,
            error: error.message
        };
    }
}

// 如果直接執行此文件，進行測試
if (import.meta.url === `file://${process.argv[1]}`) {
    // 測試驗證函數
    console.log('🧪 測試結算錯誤預防機制\n');
    
    // 測試開獎結果驗證
    try {
        const testResult1 = { positions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] };
        validateDrawResult(testResult1);
        console.log('✅ 測試1通過：正常開獎結果');
        
        const testResult2 = { result: [10, 9, 8, 7, 6, 5, 4, 3, 2, 1] };
        validateDrawResult(testResult2);
        console.log('✅ 測試2通過：不同格式的開獎結果');
        
        try {
            const testResult3 = { positions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 9] }; // 重複號碼
            validateDrawResult(testResult3);
        } catch (e) {
            console.log('✅ 測試3通過：正確檢測到重複號碼');
        }
        
        try {
            const testResult4 = { positions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 11] }; // 超出範圍
            validateDrawResult(testResult4);
        } catch (e) {
            console.log('✅ 測試4通過：正確檢測到無效號碼');
        }
        
    } catch (error) {
        console.error('測試失敗：', error);
    }
    
    process.exit(0);
}