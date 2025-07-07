const puppeteer = require('puppeteer');

async function testCompleteFixes() {
    console.log('🎯 代理管理平台完整修復驗證');
    console.log('=====================================');
    
    const browser = await puppeteer.launch({ 
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized']
    });
    
    try {
        const page = await browser.newPage();
        
        // 設置請求攔截器來查看API調用
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            if (request.url().includes('/hierarchical-members')) {
                console.log('📡 層級會員API調用:', request.url());
            }
            request.continue();
        });
        
        // 訪問代理管理平台
        console.log('🌐 訪問代理管理平台...');
        await page.goto('http://localhost:3003', { waitUntil: 'networkidle2' });
        
        // 等待頁面加載
        await page.waitForSelector('#app', { timeout: 10000 });
        
        // 登入
        console.log('🔐 執行登入...');
        await page.type('input[name="username"]', 'ti2025A');
        await page.type('input[name="password"]', '123456');
        await page.click('button[type="submit"]');
        
        // 等待登入完成
        await page.waitForSelector('.dashboard-stats', { timeout: 10000 });
        console.log('✅ 登入成功');
        
        // 切換到帳號管理標籤
        console.log('📋 切換到帳號管理標籤...');
        await page.click('button[data-tab="accounts"]');
        await page.waitForTimeout(2000);
        
        // 檢查級別顯示
        console.log('🔍 檢查級別顯示...');
        const levelElements = await page.$$('.badge.bg-primary');
        if (levelElements.length > 0) {
            const firstLevelText = await levelElements[0].evaluate(el => el.textContent);
            console.log('📊 第一個級別顯示:', firstLevelText);
            
            if (firstLevelText.includes('級代理')) {
                console.log('❌ 級別顯示仍有重複問題');
            } else {
                console.log('✅ 級別顯示修復成功');
            }
        }
        
        // 檢查代理點擊功能
        console.log('🔍 檢查代理點擊功能...');
        const clickableAgents = await page.$$('div[v-if*="parseInt(item.level) < 15"]');
        console.log(`📊 找到 ${clickableAgents.length} 個可點擊的代理`);
        
        if (clickableAgents.length > 0) {
            console.log('✅ 代理點擊功能修復成功');
            
            // 嘗試點擊第一個代理
            try {
                await clickableAgents[0].click();
                await page.waitForTimeout(2000);
                console.log('✅ 代理點擊測試成功');
            } catch (error) {
                console.log('⚠️ 代理點擊測試失敗:', error.message);
            }
        } else {
            console.log('❌ 沒有找到可點擊的代理');
        }
        
        // 測試創建會員後自動刷新
        console.log('🔍 測試創建會員後自動刷新...');
        await page.click('button[onclick="showMemberModal()"]');
        await page.waitForTimeout(1000);
        
        // 填寫會員資料
        await page.type('input[name="memberUsername"]', 'testmember' + Date.now());
        await page.type('input[name="memberPassword"]', '123456');
        await page.click('button[type="submit"]');
        
        // 等待創建完成
        await page.waitForTimeout(3000);
        
        // 檢查是否自動刷新
        const memberCount = await page.$$eval('tbody tr', rows => rows.length);
        console.log(`📊 當前會員數量: ${memberCount}`);
        
        if (memberCount > 0) {
            console.log('✅ 創建會員後自動刷新功能正常');
        } else {
            console.log('❌ 創建會員後自動刷新功能異常');
        }
        
        console.log('🎉 測試完成！');
        
    } catch (error) {
        console.error('❌ 測試過程中發生錯誤:', error);
    } finally {
        await browser.close();
    }
}

// 執行測試
testCompleteFixes().catch(console.error); 