const axios = require('axios');

const AGENT_API_URL = 'https://bet-agent.onrender.com';

async function checkTi2025ATransactions() {
    console.log('🔍 檢查上級代理 ti2025A 的交易記錄...\n');
    
    try {
        // 登錄代理 ti2025A
        console.log('1️⃣ 登錄代理 ti2025A...');
        const loginResponse = await axios.post(`${AGENT_API_URL}/api/agent/login`, {
            username: 'ti2025A',
            password: 'ti2025A'
        }, { timeout: 10000 });
        
        if (!loginResponse.data.success) {
            console.log('❌ 無法登錄代理 ti2025A:', loginResponse.data.message);
            return;
        }
        
        const token = loginResponse.data.token;
        const agent = loginResponse.data.agent;
        
        console.log('✅ 代理 ti2025A 登錄成功!');
        console.log(`   代理ID: ${agent.id}`);
        console.log(`   當前餘額: ${agent.balance}`);
        
        // 查詢退水類型的交易記錄
        console.log('\n2️⃣ 查詢退水類型的交易記錄...');
        const rebateResponse = await axios.get(`${AGENT_API_URL}/api/agent/transactions`, {
            params: { 
                agentId: agent.id,
                type: 'rebate',  // 專門查詢退水記錄
                limit: 50
            },
            headers: {
                'Authorization': `Bearer ${token}`
            },
            timeout: 10000
        });
        
        console.log('退水記錄響應:', JSON.stringify(rebateResponse.data, null, 2));
        
        if (rebateResponse.data.success) {
            const rebateTransactions = rebateResponse.data.data?.list || [];
            console.log(`✅ 找到 ${rebateTransactions.length} 筆退水記錄 (總計: ${rebateResponse.data.data?.total || 0})`);
            
            if (rebateTransactions.length > 0) {
                console.log(`\n退水交易明細:`);
                let totalRebate = 0;
                rebateTransactions.forEach((tx, index) => {
                    totalRebate += parseFloat(tx.amount);
                    console.log(`   ${index + 1}. ${tx.created_at}: +${tx.amount}元`);
                    console.log(`      代理: ${tx.username} (ID: ${tx.user_id})`);
                    console.log(`      描述: ${tx.description}`);
                    if (tx.member_username) {
                        console.log(`      來源會員: ${tx.member_username}`);
                    }
                    if (tx.bet_amount) {
                        console.log(`      下注金額: ${tx.bet_amount}元`);
                    }
                    if (tx.period) {
                        console.log(`      期數: ${tx.period}`);
                    }
                    console.log('');
                });
                console.log(`   總退水: ${totalRebate.toFixed(2)}元`);
                
                // 查找來自 justin2025A 的退水
                const justinRebates = rebateTransactions.filter(tx => 
                    tx.member_username === 'justin2025A' ||
                    (tx.description && tx.description.includes('justin2025A'))
                );
                
                if (justinRebates.length > 0) {
                    console.log(`\n🎯 來自 justin2025A 的退水記錄 ${justinRebates.length} 筆:`);
                    let justinTotalRebate = 0;
                    justinRebates.forEach((tx, index) => {
                        justinTotalRebate += parseFloat(tx.amount);
                        console.log(`   ${index + 1}. ${tx.created_at}: +${tx.amount}元 (期數: ${tx.period || '未知'})`);
                        console.log(`      代理: ${tx.username} (ID: ${tx.user_id})`);
                    });
                    console.log(`   來自 justin2025A 的總退水: ${justinTotalRebate.toFixed(2)}元`);
                    
                    // 檢查期數20250702503的退水
                    const period503Rebates = justinRebates.filter(tx => tx.period === '20250702503');
                    if (period503Rebates.length > 0) {
                        console.log(`\n🎯 期數20250702503的退水記錄:`);
                        let period503Total = 0;
                        period503Rebates.forEach(tx => {
                            period503Total += parseFloat(tx.amount);
                            console.log(`   ${tx.created_at}: +${tx.amount}元 (代理: ${tx.username})`);
                        });
                        console.log(`   期數20250702503總退水: ${period503Total.toFixed(2)}元`);
                        
                        // 計算預期退水 (9000元 × 1.1% = 99元)
                        const expectedRebate = 9000 * 0.011;
                        console.log(`   預期退水: ${expectedRebate.toFixed(2)}元 (9000元 × 1.1%)`);
                        
                        const difference = Math.abs(period503Total - expectedRebate);
                        if (difference < 0.01) {
                            console.log('✅ 期數20250702503退水金額正確！');
                        } else {
                            console.log(`⚠️ 期數20250702503退水金額差異: 預期${expectedRebate.toFixed(2)}元，實際${period503Total.toFixed(2)}元，差異${difference.toFixed(2)}元`);
                        }
                    } else {
                        console.log(`\n❌ 沒有找到期數20250702503的退水記錄`);
                        console.log('   這確認了問題：期數20250702503的下注沒有觸發退水分配');
                    }
                } else {
                    console.log(`\n❌ 沒有找到來自 justin2025A 的退水記錄`);
                    console.log('   這確認了問題：justin2025A 的下注沒有產生任何退水給代理線');
                }
                
            } else {
                console.log(`\n❌ 沒有找到任何退水交易記錄`);
                console.log('   說明: 整個代理線目前都沒有收到任何退水');
            }
        } else {
            console.log('❌ 無法獲取退水記錄:', rebateResponse.data.message);
        }
        
    } catch (error) {
        console.error('❌ 檢查過程失敗:', error.message);
        if (error.response) {
            console.log('   HTTP狀態:', error.response.status);
            console.log('   響應數據:', error.response.data);
        }
    }
    
    console.log('\n🔍 檢查完成！');
    console.log('\n💡 總結:');
    console.log('   - justin2025A 下注總計9000元');
    console.log('   - 預期退水給ti2025A: 99元 (9000 × 1.1%)');
    console.log('   - 實際檢查交易記錄以確認是否收到退水');
}

checkTi2025ATransactions().catch(console.error); 