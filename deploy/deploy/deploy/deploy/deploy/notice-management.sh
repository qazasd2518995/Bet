#!/bin/bash

# 公告管理腳本
# 用法: ./notice-management.sh [命令]

API_URL="http://localhost:3003/api/agent"
DB_CMD="psql -h localhost -U justin -d bet_game"

case "$1" in
    "list")
        echo "=== 查看所有公告 ==="
        curl -s "$API_URL/notices" | jq '.notices[] | {id, title, category, created_at}'
        ;;
    
    "list-db")
        echo "=== 資料庫中的公告 ==="
        $DB_CMD -c "SELECT id, title, category, status, created_at FROM notices ORDER BY created_at DESC;"
        ;;
    
    "count")
        echo "=== 公告統計 ==="
        $DB_CMD -c "SELECT COUNT(*) as total_notices, COUNT(CASE WHEN status = 1 THEN 1 END) as active_notices FROM notices;"
        ;;
    
    "create")
        if [ -z "$2" ] || [ -z "$3" ]; then
            echo "用法: $0 create '標題' '內容' [分類]"
            echo "分類選項: 最新公告, 維修, 活動"
            exit 1
        fi
        CATEGORY=${4:-"最新公告"}
        echo "=== 新增公告 ==="
        curl -X POST -H "Content-Type: application/json" \
             -d "{\"operatorId\": 1, \"title\": \"$2\", \"content\": \"$3\", \"category\": \"$CATEGORY\"}" \
             "$API_URL/create-notice" | jq
        ;;
    
    "edit")
        if [ -z "$2" ] || [ -z "$3" ] || [ -z "$4" ]; then
            echo "用法: $0 edit [ID] '新標題' '新內容' [分類]"
            exit 1
        fi
        CATEGORY=${5:-"最新公告"}
        echo "=== 編輯公告 ID: $2 ==="
        curl -X PUT -H "Content-Type: application/json" \
             -d "{\"operatorId\": 1, \"title\": \"$3\", \"content\": \"$4\", \"category\": \"$CATEGORY\"}" \
             "$API_URL/notice/$2" | jq
        ;;
    
    "delete")
        if [ -z "$2" ]; then
            echo "用法: $0 delete [ID]"
            exit 1
        fi
        echo "=== 刪除公告 ID: $2 ==="
        curl -X DELETE -H "Content-Type: application/json" \
             -d "{\"operatorId\": 1}" \
             "$API_URL/notice/$2" | jq
        ;;
    
    "test-api")
        echo "=== 測試API連接 ==="
        echo "1. 測試公告列表API..."
        curl -s "$API_URL/notices" > /dev/null && echo "✅ 公告API正常" || echo "❌ 公告API異常"
        
        echo "2. 測試後端健康狀況..."
        curl -s "http://localhost:3003" > /dev/null && echo "✅ 後端服務運行中" || echo "❌ 後端服務異常"
        
        echo "3. 測試資料庫連接..."
        $DB_CMD -c "SELECT 1;" > /dev/null 2>&1 && echo "✅ 資料庫連接正常" || echo "❌ 資料庫連接異常"
        ;;
    
    "reset-test-data")
        echo "=== 重置測試數據 ==="
        echo "清除現有公告..."
        $DB_CMD -c "DELETE FROM notices;"
        
        echo "重新建立測試公告..."
        # 添加測試公告
        curl -X POST -H "Content-Type: application/json" \
             -d '{"operatorId": 1, "title": "歡迎使用代理管理系統", "content": "歡迎使用全新的代理管理系統！系統提供會員管理、點數轉移、投注記錄查詢等完整功能。如有任何問題，請隨時聯繫技術支援。", "category": "最新公告"}' \
             "$API_URL/create-notice" > /dev/null
        
        curl -X POST -H "Content-Type: application/json" \
             -d '{"operatorId": 1, "title": "系統維護通知", "content": "本系統將於今晚00:00-02:00進行例行維護，期間可能會暫停服務，請提前做好準備。維護期間如有緊急情況，請聯繫客服人員。", "category": "維修"}' \
             "$API_URL/create-notice" > /dev/null
             
        curl -X POST -H "Content-Type: application/json" \
             -d '{"operatorId": 1, "title": "新春優惠活動開始", "content": "🎉 新春特別優惠活動正式開始！活動期間新會員註冊即享首存100%優惠，最高可獲得5000元獎金。活動詳情請洽客服人員。", "category": "活動"}' \
             "$API_URL/create-notice" > /dev/null
        
        echo "✅ 測試數據重置完成"
        $0 count
        ;;
    
    "backup")
        echo "=== 備份公告數據 ==="
        BACKUP_FILE="notices_backup_$(date +%Y%m%d_%H%M%S).sql"
        $DB_CMD -c "\COPY notices TO '$BACKUP_FILE' WITH CSV HEADER;"
        echo "✅ 備份完成: $BACKUP_FILE"
        ;;
    
    *)
        echo "公告管理腳本"
        echo "用法: $0 [命令]"
        echo ""
        echo "命令列表:"
        echo "  list           - 查看所有活躍公告"
        echo "  list-db        - 查看資料庫中所有公告"
        echo "  count          - 顯示公告統計"
        echo "  create         - 新增公告"
        echo "  edit           - 編輯公告"
        echo "  delete         - 刪除公告"
        echo "  test-api       - 測試API和服務狀態"
        echo "  reset-test-data - 重置測試數據"
        echo "  backup         - 備份公告數據"
        echo ""
        echo "範例:"
        echo "  $0 list"
        echo "  $0 create '系統公告' '這是一個測試公告' '最新公告'"
        echo "  $0 edit 1 '修改後的標題' '修改後的內容' '維修'"
        echo "  $0 delete 1"
        ;;
esac 