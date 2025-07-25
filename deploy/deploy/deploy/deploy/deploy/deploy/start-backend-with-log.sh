#!/bin/bash
# 啟動 backend.js 並監控結算相關的日誌

echo "🚀 啟動 backend.js 並監控結算日誌..."
echo "========================================="
echo ""

# 啟動 backend.js 並過濾結算相關的日誌
node backend.js 2>&1 | grep --line-buffered -E "結算|settleBet|improvedSettleBets|legacySettleBets|中獎|win_amount|會員點數設置|adjustment|🎯|⚠️|❌|✅" | while IFS= read -r line; do
    echo "[$(date +'%H:%M:%S')] $line"
    
    # 特別標記重要訊息
    if [[ "$line" == *"improvedSettleBets"* ]]; then
        echo ">>> ✅ 使用正確的結算系統"
    elif [[ "$line" == *"legacySettleBets"* ]] && [[ "$line" == *"警告"* ]]; then
        echo ">>> ❌ 警告：舊的結算函數被調用！"
    elif [[ "$line" == *"會員點數設置"* ]]; then
        echo ">>> ⚠️ 發現 adjustment 交易（可能是重複結算）"
    fi
done