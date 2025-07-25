#!/bin/bash
# 启动 backend.js 并监控结算相关的日志

echo "🚀 启动 backend.js 并监控结算日志..."
echo "========================================="
echo ""

# 启动 backend.js 并过滤结算相关的日志
node backend.js 2>&1 | grep --line-buffered -E "结算|settleBet|improvedSettleBets|legacySettleBets|中奖|win_amount|会员点数设置|adjustment|🎯|⚠️|❌|✅" | while IFS= read -r line; do
    echo "[$(date +'%H:%M:%S')] $line"
    
    # 特别标记重要讯息
    if [[ "$line" == *"improvedSettleBets"* ]]; then
        echo ">>> ✅ 使用正确的结算系统"
    elif [[ "$line" == *"legacySettleBets"* ]] && [[ "$line" == *"警告"* ]]; then
        echo ">>> ❌ 警告：旧的结算函数被调用！"
    elif [[ "$line" == *"会员点数设置"* ]]; then
        echo ">>> ⚠️ 发现 adjustment 交易（可能是重复结算）"
    fi
done