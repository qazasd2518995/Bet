#!/bin/bash
# 監控結算相關的日誌

echo "📊 開始監控結算日誌..."
echo "========================================="
echo "等待結算發生..."
echo ""

# 監控 backend.log 中的結算相關訊息
tail -f backend.log | grep --line-buffered -E "結算|settleBet|improvedSettleBets|legacySettleBets|中獎|win_amount|會員點數設置|adjustment|使用改進的結算系統|期號.*期|🎯|⚠️|❌|✅" | while IFS= read -r line; do
    echo "[$(date +'%H:%M:%S')] $line"
    
    # 特別標記重要訊息
    if [[ "$line" == *"使用改進的結算系統"* ]]; then
        echo ">>> ✅ 正確：使用 improvedSettleBets"
    elif [[ "$line" == *"legacySettleBets"* ]] && [[ "$line" == *"警告"* ]]; then
        echo ">>> ❌ 錯誤：舊的結算函數被調用！"
    elif [[ "$line" == *"會員點數設置"* ]]; then
        echo ">>> ⚠️ 警告：發現 adjustment 交易（可能是重複結算）"
    elif [[ "$line" == *"期結算完成"* ]]; then
        echo ">>> 📊 結算完成"
    fi
done