// Render環境A盤D盤賠率測試
console.log('🧪 開始測試Render環境A盤D盤動態賠率...\n');

// 模擬測試不同用戶的API請求
async function testRenderOdds() {
    // 您的Render URL（請替換為實際URL）
    const RENDER_URL = 'https://bet-game-vcje.onrender.com'; // 替換為您的實際Render URL
    
    console.log(`測試目標: ${RENDER_URL}\n`);
    
    try {
        // 1. 測試無用戶名的API請求（應該返回D盤默認賠率）
        console.log('1️⃣ 測試默認API（無用戶名）...');
        const defaultResponse = await fetch(`${RENDER_URL}/api/game-data`);
        
        if (defaultResponse.ok) {
            const defaultData = await defaultResponse.json();
            console.log(`   默認盤口: ${defaultData.marketType || 'D'}`);
            console.log(`   單號賠率: ${defaultData.odds.number.first}`);
            console.log(`   兩面賠率: ${defaultData.odds.champion.big}`);
            
            if (defaultData.odds.number.first === 9.59 && defaultData.odds.champion.big === 1.88) {
                console.log('   ✅ 默認D盤賠率正確');
            } else {
                console.log('   ❌ 默認D盤賠率異常');
            }
        } else {
            console.log(`   ❌ API請求失敗: ${defaultResponse.status}`);
        }
        
        console.log('');
        
        // 2. 測試A盤用戶
        console.log('2️⃣ 測試A盤用戶（titi）...');
        const titiResponse = await fetch(`${RENDER_URL}/api/game-data?username=titi`);
        
        if (titiResponse.ok) {
            const titiData = await titiResponse.json();
            console.log(`   titi盤口: ${titiData.marketType || 'D'}`);
            console.log(`   單號賠率: ${titiData.odds.number.first}`);
            console.log(`   兩面賠率: ${titiData.odds.champion.big}`);
            
            if (titiData.odds.number.first === 9.89 && titiData.odds.champion.big === 1.9) {
                console.log('   ✅ A盤賠率正確！');
            } else {
                console.log('   ❌ A盤賠率錯誤，應該是9.89/1.9');
            }
        } else {
            console.log(`   ❌ API請求失敗: ${titiResponse.status}`);
        }
        
        console.log('');
        
        // 3. 測試D盤用戶  
        console.log('3️⃣ 測試D盤用戶（memberD1）...');
        const memberResponse = await fetch(`${RENDER_URL}/api/game-data?username=memberD1`);
        
        if (memberResponse.ok) {
            const memberData = await memberResponse.json();
            console.log(`   memberD1盤口: ${memberData.marketType || 'D'}`);
            console.log(`   單號賠率: ${memberData.odds.number.first}`);
            console.log(`   兩面賠率: ${memberData.odds.champion.big}`);
            
            if (memberData.odds.number.first === 9.59 && memberData.odds.champion.big === 1.88) {
                console.log('   ✅ D盤賠率正確！');
            } else {
                console.log('   ❌ D盤賠率錯誤，應該是9.59/1.88');
            }
        } else {
            console.log(`   ❌ API請求失敗: ${memberResponse.status}`);
        }
        
        console.log('\n📋 測試總結:');
        console.log('如果看到賠率數字正確，表示Render環境A盤D盤動態賠率系統正常');
        console.log('如果API請求失敗，請檢查Render部署狀態和URL配置');
        
    } catch (error) {
        console.error('❌ 測試過程發生錯誤:', error.message);
        console.log('\n💡 請檢查:');
        console.log('1. Render URL是否正確');
        console.log('2. Render服務是否已啟動');
        console.log('3. 網路連接是否正常');
    }
}

// 在瀏覽器環境中運行
if (typeof window !== 'undefined') {
    testRenderOdds();
} else {
    console.log('請在瀏覽器控制台中運行此腳本，或更新RENDER_URL後執行');
} 