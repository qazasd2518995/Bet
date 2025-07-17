const axios = require('axios');

const AGENT_API_URL = 'https://bet-agent.onrender.com';

async function checkTi2025ARebate() {
    console.log('🔍 檢查上級代理 ti2025A 的退水記錄...\n');
    
    try {
        // 登錄代理 ti2025A
        console.log('1️⃣ 登錄代理 ti2025A...');
        const loginResponse = await axios.post(`${AGENT_API_URL}/api/agent/login`, {
            username: 'ti2025A',
            password: 'ti2025A'
        }, { timeout: 10000 });
        
        console.log('代理登錄響應:', loginResponse.data);
        
        if (!loginResponse.data.success) {
            console.log('❌ 無法登錄代理 ti2025A:', loginResponse.data.message);
            return;
        }
        
        const token = loginResponse.data.token;
        const agent = loginResponse.data.agent;
        
        console.log('✅ 代理 ti2025A 登錄成功!');
        console.log(`   代理ID: ${agent.id}`);
        console.log(`   當前餘額: ${agent.balance}`);
        console.log(`   退水模式: ${agent.rebate_mode}`);
        console.log(`   退水比例: ${(agent.rebate_percentage * 100).toFixed(1)}%`);
        
        // 查詢退水記錄
        console.log('\n2️⃣ 查詢退水記錄...');
        const rebateResponse = await axios.get(`${AGENT_API_URL}/api/agent/rebate-records`, {
            params: { limit: 50 },
            headers: {
                'Authorization': `Bearer ${token}`
            },
            timeout: 10000
        });
        
        console.log('退水記錄響應:', rebateResponse.data);
        
        if (rebateResponse.data.success) {
            const records = rebateResponse.data.records || [];
            console.log(`✅ 找到 ${records.length} 筆退水記錄`);
            
            // 查找來自 justin2025A 的退水記錄
            const justinRebates = records.filter(r => r.member_username === 'justin2025A');
            
            if (justinRebates.length > 0) {
                console.log(`\n✅ 找到來自 justin2025A 的退水記錄 ${justinRebates.length} 筆:`);
                let totalRebate = 0;
                justinRebates.forEach(record => {
                    totalRebate += parseFloat(record.amount);
                    console.log(`   ${record.created_at}: +${record.amount}元 (下注: ${record.bet_amount}元, 期數: ${record.period || '未知'})`);
                });
                console.log(`   總退水: ${totalRebate.toFixed(2)}元`);
                
                // 計算預期退水 (9000元 × 1.1% = 99元)
                const expectedRebate = 9000 * 0.011;
                console.log(`   預期退水: ${expectedRebate.toFixed(2)}元 (9000元 × 1.1%)`);
                
                const difference = Math.abs(totalRebate - expectedRebate);
                if (difference < 0.01) {
                    console.log('✅ 退水金額正確！');
                } else {
                    console.log(`⚠️ 退水金額差異: 預期${expectedRebate.toFixed(2)}元，實際${totalRebate.toFixed(2)}元，差異${difference.toFixed(2)}元`);
                }
            } else {
                console.log(`\n❌ 沒有找到來自 justin2025A 的退水記錄`);
                console.log('   可能原因:');
                console.log('   1. 退水分配邏輯有問題');
                console.log('   2. 期數20250702503的注單還未觸發退水分配');
                console.log('   3. 退水記錄被分配到其他代理');
            }
            
            // 顯示最近的退水記錄
            if (records.length > 0) {
                console.log('\n📊 最近的退水記錄:');
                records.slice(0, 10).forEach((record, index) => {
                    console.log(`   ${index + 1}. ${record.created_at}: +${record.amount}元 (來自 ${record.member_username || '未知'}) [期數: ${record.period || '未知'}]`);
                });
            } else {
                console.log('\n   該代理目前沒有任何退水記錄');
            }
        } else {
            console.log('❌ 無法獲取退水記錄:', rebateResponse.data.message);
        }
        
        // 查詢交易記錄確認
        console.log('\n3️⃣ 查詢相關交易記錄...');
        try {
            const transactionResponse = await axios.get(`${AGENT_API_URL}/api/agent/transactions`, {
                params: { 
                    agentId: agent.id,
                    type: 'rebate',
                    limit: 20
                },
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                timeout: 10000
            });
            
            if (transactionResponse.data.success) {
                const transactions = transactionResponse.data.transactions || [];
                console.log(`✅ 找到 ${transactions.length} 筆退水交易記錄`);
                
                transactions.slice(0, 5).forEach(tx => {
                    console.log(`   ${tx.created_at}: +${tx.amount}元 (${tx.description})`);
                });
            }
        } catch (txError) {
            console.log('交易記錄查詢失敗:', txError.message);
        }
        
    } catch (error) {
        console.error('❌ 檢查過程失敗:', error.message);
        if (error.response && error.response.status === 401) {
            console.log('   可能是密碼錯誤或認證失敗');
        }
    }
    
    console.log('\n🔍 檢查完成！');
    console.log('\n💡 重要說明:');
    console.log('   根據代理鏈結構，justin2025A 的退水應該分配給上級代理 ti2025A');
    console.log('   因為 justin2025A 自己的退水模式是 "none" (不拿退水)');
    console.log('   預期退水: 9000元 × 1.1% = 99元 應該進入 ti2025A 的帳戶');
}

checkTi2025ARebate().catch(console.error); 