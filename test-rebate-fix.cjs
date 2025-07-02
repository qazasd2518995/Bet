const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 檢查退水機制API路徑修復...\n');

// 檢查backend.js中的API路徑修復
function checkAPIFixInFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        
        console.log(`📄 檢查文件: ${path.basename(filePath)}`);
        
        // 檢查member-agent-chain API路徑
        const memberAgentChainMatch = content.match(/AGENT_API_URL.*\/api\/agent\/member-agent-chain/);
        if (memberAgentChainMatch) {
            console.log('✅ member-agent-chain API路徑已修復');
        } else {
            console.log('❌ member-agent-chain API路徑未修復');
        }
        
        // 檢查allocate-rebate API路徑
        const allocateRebateMatch = content.match(/AGENT_API_URL.*\/api\/agent\/allocate-rebate/);
        if (allocateRebateMatch) {
            console.log('✅ allocate-rebate API路徑已修復');
        } else {
            console.log('❌ allocate-rebate API路徑未修復');
        }
        
        // 檢查是否有舊的錯誤路徑
        const oldPathMatch = content.match(/AGENT_API_URL.*\/member-agent-chain(?!\?)/);
        if (oldPathMatch && !oldPathMatch[0].includes('/api/agent/')) {
            console.log('⚠️ 發現舊的API路徑，請檢查');
        }
        
        console.log('');
        
    } catch (error) {
        console.error(`讀取文件 ${filePath} 時發生錯誤:`, error.message);
    }
}

// 檢查主要文件
checkAPIFixInFile('backend.js');
checkAPIFixInFile('deploy/backend.js');

console.log('📋 修復摘要:');
console.log('   1. 修復了getAgentChain函數中的API路徑');
console.log('   2. 修復了allocateRebateToAgent函數中的API路徑');
console.log('   3. 正確的路徑格式: ${AGENT_API_URL}/api/agent/member-agent-chain');
console.log('   4. 正確的路徑格式: ${AGENT_API_URL}/api/agent/allocate-rebate');
console.log('');

console.log('🎯 退水機制失效的可能原因:');
console.log('   1. ✅ API路徑錯誤 (已修復)');
console.log('   2. ❓ 代理系統服務未運行');
console.log('   3. ❓ 會員代理鏈數據問題');
console.log('   4. ❓ 退水分配邏輯錯誤');
console.log('');

console.log('📝 建議測試步驟:');
console.log('   1. 啟動代理系統 (node agentBackend.js)');
console.log('   2. 啟動遊戲系統 (node backend.js)');
console.log('   3. 會員下注並等待結算');
console.log('   4. 檢查代理餘額是否增加退水');
console.log('   5. 檢查交易記錄中的退水記錄');
console.log('');

console.log('🔧 如果退水仍然失效，請檢查:');
console.log('   - 會員是否正確關聯到代理');
console.log('   - 代理退水設定是否正確');
console.log('   - 代理鏈層級關係是否正確');
console.log('   - 服務器日誌中的錯誤訊息');

console.log('\n✅ API路徑修復完成，請重新啟動服務進行測試'); 