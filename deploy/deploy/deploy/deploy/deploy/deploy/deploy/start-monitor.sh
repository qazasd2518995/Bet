#!/bin/bash

# start-monitor.sh - 快速啟動退水監控系統

echo "🚀 啟動退水機制實時監控系統"
echo "=================================="
echo ""
echo "📋 監控功能:"
echo "✅ 自動檢測新下注"
echo "✅ 即時監控遊戲狀態" 
echo "✅ 等待開獎並驗證退水"
echo "✅ 自動報警和補償機制"
echo ""
echo "💡 使用說明:"
echo "1. 監控啟動後，去遊戲中下注"
echo "2. 監控會即時顯示每期的處理狀態"
echo "3. 按 Ctrl+C 停止監控"
echo ""
echo "🔄 正在啟動..."
echo ""

# 啟動監控系統
node real-time-rebate-monitor.js