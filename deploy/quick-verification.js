// 快速验证 ti2025A 代理层级分析修复效果
import fetch from 'node-fetch';

const API_BASE_URL = 'http://localhost:3003/api/agent';

async function quickTest() {
    try {
        console.log('🔍 快速验证 ti2025A 代理层级分析修复...\n');
        
        // 1. 登录
        const loginResponse = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'ti2025A', password: 'ti2025A' })
        });
        
        const loginData = await loginResponse.json();
        console.log('📋 登录状态:', loginData.success ? '✅ 成功' : '❌ 失败');
        
        if (!loginData.success) return;
        
        // 2. 获取报表数据
        const reportResponse = await fetch(`${API_BASE_URL}/reports/agent-analysis`, {
            headers: {
                'Authorization': loginData.token,
                'x-session-token': loginData.sessionToken,
                'Content-Type': 'application/json'
            }
        });
        
        const reportData = await reportResponse.json();
        
        if (reportData.success) {
            console.log('📊 API 数据获取: ✅ 成功');
            console.log(`📈 总项目数: ${reportData.reportData.length}`);
            
            // 3. 模拟前端过滤逻辑（修复后）
            const activeBetters = reportData.reportData.filter(item => 
                item && (item.betCount > 0 || item.betAmount > 0)
            );
            
            console.log('\n🎯 修复后前端应该显示的项目:');
            console.log(`💰 有效下注项目数: ${activeBetters.length}`);
            
            if (activeBetters.length > 0) {
                console.log('\n📋 详细列表:');
                activeBetters.forEach((item, index) => {
                    const type = item.userType === 'agent' ? '🔷 代理' : '🔶 会员';
                    const clickable = item.userType === 'agent' ? ' (可点击)' : '';
                    console.log(`${index + 1}. ${type} ${item.username}${clickable}`);
                    console.log(`   📊 ${item.betCount}笔投注, ${item.betAmount}元, 盈亏: ${item.memberWinLoss}元`);
                });
                
                console.log('\n📊 总计数据:');
                console.log(`   📈 总笔数: ${reportData.totalSummary.betCount}`);
                console.log(`   💰 总投注: ${reportData.totalSummary.betAmount.toLocaleString()}元`);
                console.log(`   💸 总盈亏: ${reportData.totalSummary.memberWinLoss.toLocaleString()}元`);
                
                console.log('\n✅ 修复成功！现在应该能看到代理和会员列表了');
                console.log('💡 请刷新浏览器页面 (Ctrl+F5) 查看效果');
            } else {
                console.log('ℹ️  目前没有有效下注数据');
            }
        } else {
            console.log('❌ API 调用失败:', reportData.message);
        }
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
    }
}

quickTest();
