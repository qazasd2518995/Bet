#!/bin/bash

echo "🧹 清除前端缓存和重新载入代理管理平台"

# 检查服务是否运行
if ! pgrep -f "node.*agentBackend.js" > /dev/null; then
    echo "⚠️  代理后端服务未运行，正在启动..."
    cd /Users/justin/Desktop/Bet
    nohup node agentBackend.js > agent.log 2>&1 &
    echo "✅ 代理后端服务已启动"
    sleep 3
else
    echo "✅ 代理后端服务正在运行"
fi

# 检查前端文件修改时间
echo "📁 检查前端文件最后修改时间："
ls -la agent/frontend/js/main.js | awk '{print "main.js: " $6 " " $7 " " $8}'
ls -la agent/frontend/index.html | awk '{print "index.html: " $6 " " $7 " " $8}'

# 检查后端文件修改时间
echo "📁 检查后端文件最后修改时间："
ls -la agentBackend.js | awk '{print "agentBackend.js: " $6 " " $7 " " $8}'

# 验证修复是否在文件中
echo "🔍 验证修复内容："
if grep -q "立即更新本地会员列表中的状态" agent/frontend/js/main.js; then
    echo "✅ 会员状态修复已在前端文件中"
else
    echo "❌ 会员状态修复不在前端文件中"
fi

if grep -q "0: '总代理'" agent/frontend/js/main.js; then
    echo "✅ 级别显示修复已在前端文件中"
else
    echo "❌ 级别显示修复不在前端文件中"
fi

if grep -q "0: '总代理'" agentBackend.js; then
    echo "✅ 级别显示修复已在后端文件中"
else
    echo "❌ 级别显示修复不在后端文件中"
fi

echo ""
echo "🌐 建议的测试步骤："
echo "1. 开启浏览器无痕模式"
echo "2. 访问: http://localhost:3003"
echo "3. 使用帐号: ti2025A / ti2025A 登入"
echo "4. 测试功能：会员状态更改、级别显示、新增代理"
echo ""
echo "如果问题仍然存在，可能是："
echo "- 浏览器缓存过于顽固"
echo "- 访问错误的URL（应该是 localhost:3003 而不是 render 网站）"
echo "- 需要重启代理服务"
