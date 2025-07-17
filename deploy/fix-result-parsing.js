// 修復開獎結果解析的工具函數
export function parseDrawResult(result) {
    if (!result) return null;
    
    // 如果已經是陣列，直接返回
    if (Array.isArray(result)) {
        return result;
    }
    
    // 如果是字串
    if (typeof result === 'string') {
        try {
            // 首先嘗試 JSON 解析
            return JSON.parse(result);
        } catch (e) {
            // 如果失敗，嘗試逗號分隔格式
            const arr = result.split(',').map(n => {
                const num = parseInt(n.trim());
                return isNaN(num) ? null : num;
            }).filter(n => n !== null);
            
            return arr.length > 0 ? arr : null;
        }
    }
    
    return null;
}

// 測試函數
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('測試 parseDrawResult 函數:');
    
    // 測試案例
    const testCases = [
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],  // 陣列
        '[1,2,3,4,5,6,7,8,9,10]',  // JSON 字串
        '1,2,3,4,5,6,7,8,9,10',  // 逗號分隔
        null,  // null
        undefined,  // undefined
        '',  // 空字串
    ];
    
    testCases.forEach((testCase, index) => {
        console.log(`\n測試 ${index + 1}:`, testCase);
        console.log('結果:', parseDrawResult(testCase));
    });
}