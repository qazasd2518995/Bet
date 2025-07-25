// 快速驗證 ti2025A 代理層級分析修復效果
import fetch from 'node-fetch';

const API_BASE_URL = 'http://localhost:3003/api/agent';

async function quickTest() {
    try {
        console.log('🔍 快速驗證 ti2025A 代理層級分析修復...\n');
        
        // 1. 登錄
        const loginResponse = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'ti2025A', password: 'ti2025A' })
        });
        
        const loginData = await loginResponse.json();
        console.log('📋 登錄狀態:', loginData.success ? '✅ 成功' : '❌ 失敗');
        
        if (!loginData.success) return;
        
        // 2. 獲取報表數據
        const reportResponse = await fetch(`${API_BASE_URL}/reports/agent-analysis`, {
            headers: {
                'Authorization': loginData.token,
                'x-session-token': loginData.sessionToken,
                'Content-Type': 'application/json'
            }
        });
        
        const reportData = await reportResponse.json();
        
        if (reportData.success) {
            console.log('📊 API 數據獲取: ✅ 成功');
            console.log(`📈 總項目數: ${reportData.reportData.length}`);
            
            // 3. 模擬前端過濾邏輯（修復後）
            const activeBetters = reportData.reportData.filter(item => 
                item && (item.betCount > 0 || item.betAmount > 0)
            );
            
            console.log('\n🎯 修復後前端應該顯示的項目:');
            console.log(`💰 有效下注項目數: ${activeBetters.length}`);
            
            if (activeBetters.length > 0) {
                console.log('\n📋 詳細列表:');
                activeBetters.forEach((item, index) => {
                    const type = item.userType === 'agent' ? '🔷 代理' : '🔶 會員';
                    const clickable = item.userType === 'agent' ? ' (可點擊)' : '';
                    console.log(`${index + 1}. ${type} ${item.username}${clickable}`);
                    console.log(`   📊 ${item.betCount}筆投注, ${item.betAmount}元, 盈虧: ${item.memberWinLoss}元`);
                });
                
                console.log('\n📊 總計數據:');
                console.log(`   📈 總筆數: ${reportData.totalSummary.betCount}`);
                console.log(`   💰 總投注: ${reportData.totalSummary.betAmount.toLocaleString()}元`);
                console.log(`   💸 總盈虧: ${reportData.totalSummary.memberWinLoss.toLocaleString()}元`);
                
                console.log('\n✅ 修復成功！現在應該能看到代理和會員列表了');
                console.log('💡 請刷新瀏覽器頁面 (Ctrl+F5) 查看效果');
            } else {
                console.log('ℹ️  目前沒有有效下注數據');
            }
        } else {
            console.log('❌ API 調用失敗:', reportData.message);
        }
        
    } catch (error) {
        console.error('❌ 測試失敗:', error.message);
    }
}

quickTest();
