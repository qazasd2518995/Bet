#!/bin/bash
# 监控结算相关的日志

echo "📊 开始监控结算日志..."
echo "========================================="
echo "等待结算发生..."
echo ""

# 监控 backend.log 中的结算相关讯息
tail -f backend.log | grep --line-buffered -E "结算|settleBet|improvedSettleBets|legacySettleBets|中奖|win_amount|会员点数设置|adjustment|使用改进的结算系统|期号.*期|🎯|⚠️|❌|✅" | while IFS= read -r line; do
    echo "[$(date +'%H:%M:%S')] $line"
    
    # 特别标记重要讯息
    if [[ "$line" == *"使用改进的结算系统"* ]]; then
        echo ">>> ✅ 正确：使用 improvedSettleBets"
    elif [[ "$line" == *"legacySettleBets"* ]] && [[ "$line" == *"警告"* ]]; then
        echo ">>> ❌ 错误：旧的结算函数被调用！"
    elif [[ "$line" == *"会员点数设置"* ]]; then
        echo ">>> ⚠️ 警告：发现 adjustment 交易（可能是重复结算）"
    elif [[ "$line" == *"期结算完成"* ]]; then
        echo ">>> 📊 结算完成"
    fi
done