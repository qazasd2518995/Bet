// 在浏览器控制台中执行这段代码来检查前端状态

console.log('🔍 检查前端退水计算状态...');

// 检查当前数据
console.log('1. 当前用户:', app.user);
console.log('2. currentManagingAgent:', app.currentManagingAgent);
console.log('3. currentMemberManagingAgent:', app.currentMemberManagingAgent);
console.log('4. activeTab:', app.activeTab);

// 计算 availableMaxRebatePercentage
console.log('\n计算 availableMaxRebatePercentage:');
let managingAgent;
if (app.activeTab === 'accounts' && app.currentMemberManagingAgent && app.currentMemberManagingAgent.id) {
    managingAgent = app.currentMemberManagingAgent;
    console.log('使用 currentMemberManagingAgent:', managingAgent);
} else {
    managingAgent = app.currentManagingAgent;
    console.log('使用 currentManagingAgent:', managingAgent);
}

// 如果没有管理代理，回退到用户自己
if (!managingAgent || !managingAgent.id) {
    managingAgent = app.user;
    console.log('回退到 user:', managingAgent);
}

let actualRebatePercentage = managingAgent.rebate_percentage;
console.log('原始 rebate_percentage:', actualRebatePercentage);

// 确保转换为数字类型
if (actualRebatePercentage !== undefined && actualRebatePercentage !== null) {
    actualRebatePercentage = parseFloat(actualRebatePercentage);
}
console.log('parseFloat 后:', actualRebatePercentage);

// 如果没有 rebate_percentage 或解析失败，使用 max_rebate_percentage
if (isNaN(actualRebatePercentage) || actualRebatePercentage === undefined || actualRebatePercentage === null) {
    actualRebatePercentage = parseFloat(managingAgent.max_rebate_percentage) || 0;
    console.log('使用 max_rebate_percentage:', actualRebatePercentage);
}

// 如果还是没有，根据盘口类型使用默认值
if (isNaN(actualRebatePercentage) || actualRebatePercentage <= 0) {
    const marketType = managingAgent.market_type || app.user.market_type || 'D';
    actualRebatePercentage = marketType === 'A' ? 0.011 : 0.041;
    console.log('使用默认值:', actualRebatePercentage);
}

const displayPercentage = (actualRebatePercentage * 100).toFixed(1);
console.log(`\n🎯 最终结果: 应该显示 0% - ${displayPercentage}% (直属上级代理分配额度)`);

// 检查实际的 computed 属性值
console.log('\n💡 实际 computed 属性值:', app.availableMaxRebatePercentage);
console.log('💡 实际显示百分比:', (app.availableMaxRebatePercentage * 100).toFixed(1) + '%');
