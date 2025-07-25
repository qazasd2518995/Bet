// 在瀏覽器控制台中執行這段代碼來檢查前端狀態

console.log('🔍 檢查前端退水計算狀態...');

// 檢查當前數據
console.log('1. 當前用戶:', app.user);
console.log('2. currentManagingAgent:', app.currentManagingAgent);
console.log('3. currentMemberManagingAgent:', app.currentMemberManagingAgent);
console.log('4. activeTab:', app.activeTab);

// 計算 availableMaxRebatePercentage
console.log('\n計算 availableMaxRebatePercentage:');
let managingAgent;
if (app.activeTab === 'accounts' && app.currentMemberManagingAgent && app.currentMemberManagingAgent.id) {
    managingAgent = app.currentMemberManagingAgent;
    console.log('使用 currentMemberManagingAgent:', managingAgent);
} else {
    managingAgent = app.currentManagingAgent;
    console.log('使用 currentManagingAgent:', managingAgent);
}

// 如果沒有管理代理，回退到用戶自己
if (!managingAgent || !managingAgent.id) {
    managingAgent = app.user;
    console.log('回退到 user:', managingAgent);
}

let actualRebatePercentage = managingAgent.rebate_percentage;
console.log('原始 rebate_percentage:', actualRebatePercentage);

// 確保轉換為數字類型
if (actualRebatePercentage !== undefined && actualRebatePercentage !== null) {
    actualRebatePercentage = parseFloat(actualRebatePercentage);
}
console.log('parseFloat 後:', actualRebatePercentage);

// 如果沒有 rebate_percentage 或解析失敗，使用 max_rebate_percentage
if (isNaN(actualRebatePercentage) || actualRebatePercentage === undefined || actualRebatePercentage === null) {
    actualRebatePercentage = parseFloat(managingAgent.max_rebate_percentage) || 0;
    console.log('使用 max_rebate_percentage:', actualRebatePercentage);
}

// 如果還是沒有，根據盤口類型使用默認值
if (isNaN(actualRebatePercentage) || actualRebatePercentage <= 0) {
    const marketType = managingAgent.market_type || app.user.market_type || 'D';
    actualRebatePercentage = marketType === 'A' ? 0.011 : 0.041;
    console.log('使用默認值:', actualRebatePercentage);
}

const displayPercentage = (actualRebatePercentage * 100).toFixed(1);
console.log(`\n🎯 最終結果: 應該顯示 0% - ${displayPercentage}% (直屬上級代理分配額度)`);

// 檢查實際的 computed 屬性值
console.log('\n💡 實際 computed 屬性值:', app.availableMaxRebatePercentage);
console.log('💡 實際顯示百分比:', (app.availableMaxRebatePercentage * 100).toFixed(1) + '%');
