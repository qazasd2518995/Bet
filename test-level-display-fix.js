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

// 模擬修復後的 getLevelShortName 函數
function getLevelShortName(level) {
    // 確保 level 是數字
    const n = parseInt(level, 10);
    if (isNaN(n) || n < 0) return '未知';
    
    if (n === 0) return '總代理';
    const chinese = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五'];
    return `${chinese[n] || n}級`;
}

// 測試數據
const testAgents = [
    { id: 1, username: 'agent1', level: 0 },
    { id: 2, username: 'agent2', level: 1 },
    { id: 3, username: 'agent3', level: 2 },
    { id: 4, username: 'agent4', level: '一級代理' }, // 錯誤的字符串級別
    { id: 5, username: 'agent5', level: null },
    { id: 6, username: 'agent6', level: undefined },
    { id: 7, username: 'agent7', level: 'invalid' }
];

const testHierarchicalData = [
    { id: 1, username: 'agent1', level: 0, userType: 'agent' },
    { id: 2, username: 'agent2', level: 1, userType: 'agent' },
    { id: 3, username: 'agent3', level: '一級代理', userType: 'agent' }, // 錯誤的字符串級別
    { id: 4, username: 'member1', level: '會員', userType: 'member' }
];

console.log('🔧 代理級別顯示修復測試');
console.log('=====================================');

console.log('\n📊 測試 getLevelName 函數:');
testAgents.forEach(agent => {
    const levelName = getLevelName(agent.level);
    console.log(`代理 ${agent.username} (level: ${agent.level}) → ${levelName}`);
});

console.log('\n📊 測試層級會員管理數據處理:');
const processedData = processHierarchicalData(testHierarchicalData);
processedData.forEach(item => {
    const levelName = getLevelName(item.level);
    console.log(`項目 ${item.username} (level: ${item.level}) → ${levelName}`);
});

console.log('\n✅ 測試完成！');
console.log('修復要點：');
console.log('1. 確保後端返回數字級別');
console.log('2. 前端簡化級別處理邏輯');
console.log('3. 統一使用 getLevelName 函數');
console.log('4. 無效值顯示警告並使用預設值');

// 模擬層級會員管理數據處理
function processHierarchicalData(data) {
    return data.map(item => {
        // 確保 level 為數字
        const numLevel = parseInt(item.level);
        if (isNaN(numLevel)) {
            console.warn('⚠️ 層級數據收到無效 level:', item.level, '使用預設值');
            item.level = 0; // 預設為總代理
        } else {
            item.level = numLevel;
        }
        
        return {
            ...item,
            levelName: getLevelName(item.level)
        };
    });
}
