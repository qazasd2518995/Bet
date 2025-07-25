// 測試控制輸贏系統
import db from './db/config.js';
import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000';
const AGENT_API_URL = 'http://localhost:3003';

console.log('🎮 開始測試控制輸贏系統\n');

// 測試帳號資訊
const testAgent = {
    username: 'ti2025A',
    password: 'ti2025A'
};

const testMember = {
    username: 'justin111',
    password: 'aaaa00'
};

async function testControlSystem() {
    try {
        // 1. 登入會員帳號
        console.log('📌 步驟1: 登入會員帳號...');
        const loginResponse = await fetch(`${API_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testMember)
        });
        
        const loginData = await loginResponse.json();
        if (!loginData.success) {
            throw new Error(`登入失敗: ${loginData.message}`);
        }
        
        const token = loginData.token;
        console.log('✅ 登入成功');
        console.log(`- 用戶: ${loginData.user.username}`);
        console.log(`- 餘額: ${loginData.user.balance}`);
        
        // 2. 檢查當前控制設定
        console.log('\n📌 步驟2: 檢查當前控制設定...');
        const controlStatus = await db.oneOrNone(`
            SELECT * FROM win_loss_control
            WHERE is_active = true
            ORDER BY created_at DESC
            LIMIT 1
        `);
        
        if (controlStatus) {
            console.log('當前控制設定:');
            console.log(`- 模式: ${controlStatus.control_mode}`);
            console.log(`- 目標: ${controlStatus.target_username}`);
            console.log(`- 控制百分比: ${controlStatus.control_percentage}%`);
        } else {
            console.log('❌ 沒有啟用的控制設定');
            
            // 設定控制
            console.log('\n設定新的控制...');
            await db.none(`
                INSERT INTO win_loss_control 
                (control_mode, target_username, control_percentage, start_period, is_active)
                VALUES ('single_member', $1, 90, 
                    (SELECT COALESCE(MAX(period::bigint), 20250717000) + 1 FROM result_history),
                    true)
            `, [testMember.username]);
            console.log('✅ 已設定 90% 輸率控制');
        }
        
        // 3. 獲取當前期號
        console.log('\n📌 步驟3: 獲取當前期號...');
        const currentPeriodResponse = await fetch(`${API_URL}/api/current-period`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const periodData = await currentPeriodResponse.json();
        const currentPeriod = periodData.period;
        console.log(`當前期號: ${currentPeriod}`);
        console.log(`狀態: ${periodData.status}`);
        
        // 4. 進行測試下注
        console.log('\n📌 步驟4: 進行測試下注...');
        const testBets = [
            { position: '1', number: '5', amount: 1 },
            { position: '3', number: '7', amount: 1 },
            { position: '5', number: '2', amount: 1 },
            { position: '7', number: '9', amount: 1 },
            { position: '10', number: '1', amount: 1 }
        ];
        
        console.log('下注內容:');
        for (const bet of testBets) {
            console.log(`- 第${bet.position}名 號碼${bet.number} 金額${bet.amount}`);
            
            const betResponse = await fetch(`${API_URL}/api/bet`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    betType: 'number',
                    betValue: bet.number,
                    position: bet.position,
                    amount: bet.amount,
                    odds: 9.89
                })
            });
            
            const betResult = await betResponse.json();
            if (!betResult.success) {
                console.log(`⚠️ 下注失敗: ${betResult.message}`);
            }
        }
        
        console.log('\n✅ 測試下注完成');
        
        // 5. 等待開獎
        console.log('\n📌 步驟5: 等待開獎...');
        console.log('請等待當期結束後查看開獎結果');
        
        // 顯示如何查看結果
        console.log('\n📊 查看結果指令:');
        console.log('1. 查看開獎結果:');
        console.log(`   node -e "import db from './db/config.js'; db.oneOrNone('SELECT * FROM result_history WHERE period = \'${currentPeriod}\'').then(r => console.log(r))"`);
        
        console.log('\n2. 查看中獎情況:');
        console.log(`   node -e "import db from './db/config.js'; db.manyOrNone('SELECT position, bet_value, win FROM bet_history WHERE period = \'${currentPeriod}\' AND username = \'justin111\' AND bet_type = \'number\'').then(r => console.log(r))"`);
        
    } catch (error) {
        console.error('\n❌ 測試失敗:', error.message);
    }
}

// 執行測試
testControlSystem().then(() => {
    console.log('\n🎯 測試程序完成');
    process.exit(0);
}).catch(error => {
    console.error('錯誤:', error);
    process.exit(1);
});