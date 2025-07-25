// 測試代理級別顯示修復
const axios = require('axios');

// 模擬修復後的 getLevelName 函數
function getLevelName(level) {
    // 確保輸入為數字
    const numLevel = parseInt(level);
    
    if (isNaN(numLevel)) {
        console.warn('⚠️ getLevelName 收到無效 level:', level, '使用預設值');
        return '未知級別';
    }
    
    // 根據數字級別返回對應名稱
    switch (numLevel) {
        case 0: return '總代理';
        case 1: return '一級代理';
        case 2: return '二級代理';
        case 3: return '三級代理';
        case 4: return '四級代理';
        case 5: return '五級代理';
        case 6: return '六級代理';
        case 7: return '七級代理';
        case 8: return '八級代理';
        case 9: return '九級代理';
        case 10: return '十級代理';
        case 11: return '十一級代理';
        case 12: return '十二級代理';
        case 13: return '十三級代理';
        case 14: return '十四級代理';
        case 15: return '十五級代理';
        default: return `${numLevel}級代理`;
    }
}

// 測試各種級別值
console.log('🧪 測試 getLevelName 函數:');
console.log('數字級別:', getLevelName(1)); // 應該返回 "一級代理"
console.log('字符串數字:', getLevelName("2")); // 應該返回 "二級代理"
console.log('無效字符串:', getLevelName("一級代理")); // 應該返回 "未知級別"
console.log('null:', getLevelName(null)); // 應該返回 "未知級別"
console.log('undefined:', getLevelName(undefined)); // 應該返回 "未知級別"

// 模擬層級會員管理數據處理
console.log('\n🧪 測試層級會員管理數據處理:');

// 模擬API返回的數據（包含字符串級別）
const mockApiData = [
    { id: 1, username: 'agent1', level: 1, userType: 'agent' },
    { id: 2, username: 'agent2', level: '二級代理', userType: 'agent' }, // 字符串級別
    { id: 3, username: 'agent3', level: '一級代理', userType: 'agent' }, // 字符串級別
    { id: 4, username: 'member1', level: '會員', userType: 'member' }
];

console.log('原始API數據:');
mockApiData.forEach(item => {
    console.log(`  ${item.username}: level=${item.level} (${typeof item.level})`);
});

// 應用防禦性修復
const fixedData = mockApiData.map(item => {
    if (item.userType === 'agent') {
        let numLevel = parseInt(item.level);
        
        // 如果parseInt失敗，嘗試從字符串級別名稱轉換
        if (isNaN(numLevel)) {
            const levelMap = {
                '總代理': 0,
                '一級代理': 1,
                '二級代理': 2,
                '三級代理': 3,
                '四級代理': 4,
                '五級代理': 5,
                '六級代理': 6,
                '七級代理': 7,
                '八級代理': 8,
                '九級代理': 9,
                '十級代理': 10,
                '十一級代理': 11,
                '十二級代理': 12,
                '十三級代理': 13,
                '十四級代理': 14,
                '十五級代理': 15
            };
            
            numLevel = levelMap[item.level];
            if (numLevel === undefined) {
                console.warn('⚠️ 代理 level 無效:', item.level, '使用預設值 0');
                numLevel = 0;
            } else {
                console.log('✅ 成功轉換字符串級別:', item.level, '->', numLevel);
            }
        }
        
        item.level = numLevel;
    }
    return item;
});

console.log('\n修復後的數據:');
fixedData.forEach(item => {
    if (item.userType === 'agent') {
        console.log(`  ${item.username}: level=${item.level} (${typeof item.level}) -> ${getLevelName(item.level)}`);
    } else {
        console.log(`  ${item.username}: level=${item.level} (${typeof item.level})`);
    }
});

console.log('\n✅ 測試完成！'); 