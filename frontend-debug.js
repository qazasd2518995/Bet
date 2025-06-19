// 前端除錯腳本 - 在瀏覽器控制台執行

console.log('=== 公告系統除錯開始 ===');

// 1. 檢查 Vue 實例
if (typeof app !== 'undefined') {
    console.log('✅ Vue 實例存在');
    console.log('當前公告數量:', app.notices.length);
    console.log('公告數據:', app.notices);
    console.log('是否為客服:', app.isCustomerService);
    console.log('用戶資訊:', app.user);
} else {
    console.log('❌ Vue 實例不存在');
}

// 2. 檢查 API 連接
async function testNoticeAPI() {
    try {
        const response = await fetch('http://localhost:3003/api/agent/notices');
        const data = await response.json();
        console.log('✅ API 連接正常');
        console.log('API 返回數據:', data);
        return data;
    } catch (error) {
        console.log('❌ API 連接失敗:', error);
        return null;
    }
}

// 3. 強制刷新公告數據
async function forceRefreshNotices() {
    if (typeof app !== 'undefined' && app.fetchNotices) {
        console.log('正在刷新公告數據...');
        await app.fetchNotices();
        console.log('刷新後公告數量:', app.notices.length);
    } else {
        console.log('❌ 無法找到 fetchNotices 方法');
    }
}

// 4. 檢查活動頁籤
function checkActiveTab() {
    if (typeof app !== 'undefined') {
        console.log('當前活動頁籤:', app.activeTab);
        if (app.activeTab === 'notices') {
            console.log('✅ 正在公告頁面');
        } else {
            console.log('切換到公告頁面...');
            app.activeTab = 'notices';
        }
    }
}

// 執行除錯
testNoticeAPI().then(() => {
    if (typeof app !== 'undefined') {
        forceRefreshNotices();
        checkActiveTab();
    }
});

console.log('=== 公告系統除錯完成 ===');
console.log('如果問題持續，請執行: forceRefreshNotices()'); 