#!/bin/bash

echo "🧹 清除前端緩存和重新載入代理管理平台"

# 檢查服務是否運行
if ! pgrep -f "node.*agentBackend.js" > /dev/null; then
    echo "⚠️  代理後端服務未運行，正在啟動..."
    cd /Users/justin/Desktop/Bet
    nohup node agentBackend.js > agent.log 2>&1 &
    echo "✅ 代理後端服務已啟動"
    sleep 3
else
    echo "✅ 代理後端服務正在運行"
fi

# 檢查前端文件修改時間
echo "📁 檢查前端文件最後修改時間："
ls -la agent/frontend/js/main.js | awk '{print "main.js: " $6 " " $7 " " $8}'
ls -la agent/frontend/index.html | awk '{print "index.html: " $6 " " $7 " " $8}'

# 檢查後端文件修改時間
echo "📁 檢查後端文件最後修改時間："
ls -la agentBackend.js | awk '{print "agentBackend.js: " $6 " " $7 " " $8}'

# 驗證修復是否在文件中
echo "🔍 驗證修復內容："
if grep -q "立即更新本地會員列表中的狀態" agent/frontend/js/main.js; then
    echo "✅ 會員狀態修復已在前端文件中"
else
    echo "❌ 會員狀態修復不在前端文件中"
fi

if grep -q "0: '總代理'" agent/frontend/js/main.js; then
    echo "✅ 級別顯示修復已在前端文件中"
else
    echo "❌ 級別顯示修復不在前端文件中"
fi

if grep -q "0: '總代理'" agentBackend.js; then
    echo "✅ 級別顯示修復已在後端文件中"
else
    echo "❌ 級別顯示修復不在後端文件中"
fi

echo ""
echo "🌐 建議的測試步驟："
echo "1. 開啟瀏覽器無痕模式"
echo "2. 訪問: http://localhost:3003"
echo "3. 使用帳號: ti2025A / ti2025A 登入"
echo "4. 測試功能：會員狀態更改、級別顯示、新增代理"
echo ""
echo "如果問題仍然存在，可能是："
echo "- 瀏覽器緩存過於頑固"
echo "- 訪問錯誤的URL（應該是 localhost:3003 而不是 render 網站）"
echo "- 需要重啟代理服務"
