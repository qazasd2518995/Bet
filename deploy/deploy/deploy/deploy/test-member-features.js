// test-member-features.js - 測試會員密碼修改和即時登出功能

const readline = require('readline');

// 創建命令行界面
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// API配置
const AGENT_API_URL = 'http://localhost:3003';
const GAME_API_URL = 'http://localhost:3000';

// 測試會員密碼修改功能
async function testPasswordChange() {
    console.log('\n🔑 測試會員密碼修改功能');
    console.log('='.repeat(50));
    
    try {
        // 測試數據
        const testData = {
            username: 'testmember1',
            currentPassword: '123456',
            newPassword: 'newpass123'
        };
        
        console.log(`測試會員: ${testData.username}`);
        console.log(`當前密碼: ${testData.currentPassword}`);
        console.log(`新密碼: ${testData.newPassword}`);
        
        // 1. 測試遊戲端API
        console.log('\n1️⃣ 測試遊戲端密碼修改API...');
        const gameResponse = await fetch(`${GAME_API_URL}/api/member/change-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testData)
        });
        
        const gameResult = await gameResponse.json();
        console.log('遊戲端API回應:', gameResult);
        
        if (gameResult.success) {
            console.log('✅ 遊戲端密碼修改API測試成功');
            
            // 2. 測試新密碼登入
            console.log('\n2️⃣ 測試新密碼登入...');
            const loginResponse = await fetch(`${GAME_API_URL}/api/member/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: testData.username,
                    password: testData.newPassword
                })
            });
            
            const loginResult = await loginResponse.json();
            console.log('新密碼登入結果:', loginResult);
            
            if (loginResult.success) {
                console.log('✅ 新密碼登入成功');
            } else {
                console.log('❌ 新密碼登入失敗');
            }
            
            // 3. 恢復原密碼
            console.log('\n3️⃣ 恢復原密碼...');
            const restoreResponse = await fetch(`${GAME_API_URL}/api/member/change-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: testData.username,
                    currentPassword: testData.newPassword,
                    newPassword: testData.currentPassword
                })
            });
            
            const restoreResult = await restoreResponse.json();
            console.log('恢復原密碼結果:', restoreResult);
            
            if (restoreResult.success) {
                console.log('✅ 原密碼已恢復');
            } else {
                console.log('❌ 原密碼恢復失敗');
            }
            
        } else {
            console.log('❌ 遊戲端密碼修改API測試失敗');
        }
        
    } catch (error) {
        console.error('密碼修改測試錯誤:', error);
    }
}

// 測試會話檢查功能
async function testSessionCheck() {
    console.log('\n🔍 測試會話檢查功能');
    console.log('='.repeat(50));
    
    try {
        const testUsername = 'testmember1';
        
        console.log(`測試會員: ${testUsername}`);
        
        // 1. 測試遊戲端會話檢查API
        console.log('\n1️⃣ 測試遊戲端會話檢查API...');
        const gameResponse = await fetch(`${GAME_API_URL}/api/check-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: testUsername
            })
        });
        
        const gameResult = await gameResponse.json();
        console.log('遊戲端會話檢查結果:', gameResult);
        
        // 2. 測試代理端會話檢查API
        console.log('\n2️⃣ 測試代理端會話檢查API...');
        const agentResponse = await fetch(`${AGENT_API_URL}/api/agent/member/check-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: testUsername
            })
        });
        
        const agentResult = await agentResponse.json();
        console.log('代理端會話檢查結果:', agentResult);
        
        if (gameResult.success && agentResult.success) {
            console.log('✅ 會話檢查功能正常');
        } else {
            console.log('❌ 會話檢查功能異常');
        }
        
    } catch (error) {
        console.error('會話檢查測試錯誤:', error);
    }
}

// 測試密碼驗證
async function testPasswordValidation() {
    console.log('\n🔐 測試密碼驗證邏輯');
    console.log('='.repeat(50));
    
    const testCases = [
        {
            name: '空密碼',
            data: {
                username: 'testmember1',
                currentPassword: '',
                newPassword: 'newpass123'
            },
            expectSuccess: false
        },
        {
            name: '密碼過短',
            data: {
                username: 'testmember1',
                currentPassword: '123456',
                newPassword: '123'
            },
            expectSuccess: false
        },
        {
            name: '相同密碼',
            data: {
                username: 'testmember1',
                currentPassword: '123456',
                newPassword: '123456'
            },
            expectSuccess: false
        },
        {
            name: '錯誤的當前密碼',
            data: {
                username: 'testmember1',
                currentPassword: 'wrongpass',
                newPassword: 'newpass123'
            },
            expectSuccess: false
        }
    ];
    
    for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        console.log(`\n${i + 1}️⃣ 測試案例: ${testCase.name}`);
        
        try {
            const response = await fetch(`${GAME_API_URL}/api/member/change-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(testCase.data)
            });
            
            const result = await response.json();
            
            if (result.success === testCase.expectSuccess) {
                console.log(`✅ ${testCase.name} - 驗證通過`);
            } else {
                console.log(`❌ ${testCase.name} - 驗證失敗`);
                console.log('預期:', testCase.expectSuccess ? '成功' : '失敗');
                console.log('實際:', result.success ? '成功' : '失敗');
                console.log('錯誤信息:', result.message);
            }
            
        } catch (error) {
            console.error(`測試案例 ${testCase.name} 錯誤:`, error);
        }
    }
}

// 顯示使用說明
function showUsage() {
    console.log('\n📋 會員功能測試腳本');
    console.log('='.repeat(50));
    console.log('此腳本測試以下功能：');
    console.log('1. 會員密碼修改功能');
    console.log('2. 會話檢查和即時登出功能');
    console.log('3. 密碼驗證邏輯');
    console.log('\n請選擇要執行的測試:');
    console.log('1 - 測試密碼修改功能');
    console.log('2 - 測試會話檢查功能');
    console.log('3 - 測試密碼驗證邏輯');
    console.log('4 - 執行全部測試');
    console.log('0 - 退出');
}

// 主函數
async function main() {
    console.log('🎮 會員功能測試開始');
    console.log('請確保遊戲後端 (localhost:3000) 和代理後端 (localhost:3003) 都在運行');
    
    while (true) {
        showUsage();
        
        const choice = await new Promise((resolve) => {
            rl.question('\n請輸入選項 (0-4): ', resolve);
        });
        
        switch (choice) {
            case '1':
                await testPasswordChange();
                break;
            case '2':
                await testSessionCheck();
                break;
            case '3':
                await testPasswordValidation();
                break;
            case '4':
                await testPasswordChange();
                await testSessionCheck();
                await testPasswordValidation();
                break;
            case '0':
                console.log('\n👋 測試結束');
                rl.close();
                return;
            default:
                console.log('❌ 無效選項，請重新選擇');
        }
        
        await new Promise((resolve) => {
            rl.question('\n按 Enter 繼續...', resolve);
        });
    }
}

// 執行主函數
if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    testPasswordChange,
    testSessionCheck,
    testPasswordValidation
}; 