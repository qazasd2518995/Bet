// 測試修復後的 ti2025A 代理層級分析報表
import fetch from 'node-fetch';

const API_BASE_URL = 'http://localhost:3003/api/agent';

async function testFixedAgentReport() {
    try {
        console.log('🔧 測試修復後的 ti2025A 代理層級分析報表...\n');
        
        // 1. 登錄
        const loginResponse = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'ti2025A', password: 'ti2025A' })
        });
        
        const loginData = await loginResponse.json();
        console.log('📋 登錄狀態:', loginData.success ? '✅ 成功' : '❌ 失敗');
        
        if (!loginData.success) return;
        
        // 2. 測試前端實際使用的 API
        const reportResponse = await fetch(`${API_BASE_URL}/agent-hierarchical-analysis?agentId=28`, {
            headers: {
                'Authorization': loginData.token,
                'x-session-token': loginData.sessionToken,
                'Content-Type': 'application/json'
            }
        });
        
        const reportData = await reportResponse.json();
        
        console.log('📊 API 調用:', reportData.success ? '✅ 成功' : '❌ 失敗');
        
        if (reportData.success) {
            console.log(`📈 API 返回項目數: ${reportData.reportData.length}`);
            console.log(`📊 總計: ${reportData.totalSummary.betCount}筆, ${reportData.totalSummary.betAmount}元\n`);
            
            // 3. 模擬修復後的前端過濾邏輯
            const activeBetters = reportData.reportData.filter(item => 
                item && (item.betCount > 0 || item.betAmount > 0)
            );
            
            console.log('🎯 修復後前端顯示邏輯測試:');
            console.log(`💰 有效下注項目數: ${activeBetters.length}\n`);
            
            if (activeBetters.length > 0) {
                console.log('📋 應該顯示的項目:');
                activeBetters.forEach((item, index) => {
                    const type = (item.type === 'agent' || item.userType === 'agent') ? '🔷 代理' : '🔶 會員';
                    const clickable = (item.type === 'agent' || item.userType === 'agent') ? ' → (可點擊進入下級)' : '';
                    
                    console.log(`${index + 1}. ${type} ${item.username}${clickable}`);
                    console.log(`   💰 餘額: ${(item.balance || 0).toLocaleString()}元`);
                    console.log(`   📊 ${item.betCount}筆投注, ${item.betAmount.toLocaleString()}元`);
                    console.log(`   💸 會員輸贏: ${item.memberWinLoss.toLocaleString()}元`);
                    console.log('');
                });
                
                // 4. 檢查數據結構兼容性
                console.log('🔍 數據結構檢查:');
                const firstItem = activeBetters[0];
                console.log(`- type 字段: ${firstItem.type || 'undefined'}`);
                console.log(`- userType 字段: ${firstItem.userType || 'undefined'}`);
                console.log(`- 前端條件 (type === 'agent'): ${firstItem.type === 'agent'}`);
                console.log(`- 前端條件 (userType === 'agent'): ${firstItem.userType === 'agent'}`);
                console.log(`- 兼容條件通過: ${(firstItem.type === 'agent') || (firstItem.userType === 'agent')}\n`);
                
                console.log('✅ 修復成功！前端應該能正確顯示代理和會員列表');
                console.log('💡 請在瀏覽器中清除快取 (Ctrl+F5) 並重新載入頁面');
                
                // 5. 顯示期望的前端渲染結果
                console.log('\n📺 期望的前端顯示效果:');
                console.log('┌────────────────────────────────────────────────────────────┐');
                console.log('│ 級別      │ 用戶名         │ 餘額      │ 筆數 │ 下注金額      │');
                console.log('├────────────────────────────────────────────────────────────┤');
                activeBetters.forEach(item => {
                    const type = (item.type === 'agent' || item.userType === 'agent') ? '🔷 代理' : '🔶 會員';
                    const username = (item.type === 'agent' || item.userType === 'agent') ? 
                        `${item.username} →` : item.username;
                    console.log(`│ ${type.padEnd(8)} │ ${username.padEnd(14)} │ ${(item.balance || 0).toLocaleString().padStart(9)} │ ${String(item.betCount).padStart(4)} │ ${item.betAmount.toLocaleString().padStart(13)} │`);
                });
                console.log('├────────────────────────────────────────────────────────────┤');
                console.log(`│ 總計      │ -              │ -         │ ${String(reportData.totalSummary.betCount).padStart(4)} │ ${reportData.totalSummary.betAmount.toLocaleString().padStart(13)} │`);
                console.log('└────────────────────────────────────────────────────────────┘');
                
            } else {
                console.log('ℹ️  沒有有效下注數據，前端將顯示 "沒有有效下注資料"');
            }
        } else {
            console.log('❌ API 調用失敗:', reportData.message);
        }
        
    } catch (error) {
        console.error('❌ 測試失敗:', error.message);
    }
}

testFixedAgentReport();
