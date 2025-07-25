// 修复开奖结果解析的工具函数
export function parseDrawResult(result) {
    if (!result) return null;
    
    // 如果已经是阵列，直接返回
    if (Array.isArray(result)) {
        return result;
    }
    
    // 如果是字串
    if (typeof result === 'string') {
        try {
            // 首先尝试 JSON 解析
            return JSON.parse(result);
        } catch (e) {
            // 如果失败，尝试逗号分隔格式
            const arr = result.split(',').map(n => {
                const num = parseInt(n.trim());
                return isNaN(num) ? null : num;
            }).filter(n => n !== null);
            
            return arr.length > 0 ? arr : null;
        }
    }
    
    return null;
}

// 测试函数
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('测试 parseDrawResult 函数:');
    
    // 测试案例
    const testCases = [
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],  // 阵列
        '[1,2,3,4,5,6,7,8,9,10]',  // JSON 字串
        '1,2,3,4,5,6,7,8,9,10',  // 逗号分隔
        null,  // null
        undefined,  // undefined
        '',  // 空字串
    ];
    
    testCases.forEach((testCase, index) => {
        console.log(`\n测试 ${index + 1}:`, testCase);
        console.log('结果:', parseDrawResult(testCase));
    });
}