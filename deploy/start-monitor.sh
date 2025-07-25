#!/bin/bash

# start-monitor.sh - 快速启动退水监控系统

echo "🚀 启动退水机制实时监控系统"
echo "=================================="
echo ""
echo "📋 监控功能:"
echo "✅ 自动检测新下注"
echo "✅ 即时监控游戏状态" 
echo "✅ 等待开奖并验证退水"
echo "✅ 自动报警和补偿机制"
echo ""
echo "💡 使用说明:"
echo "1. 监控启动后，去游戏中下注"
echo "2. 监控会即时显示每期的处理状态"
echo "3. 按 Ctrl+C 停止监控"
echo ""
echo "🔄 正在启动..."
echo ""

# 启动监控系统
node real-time-rebate-monitor.js