#!/bin/bash

# 公告管理脚本
# 用法: ./notice-management.sh [命令]

API_URL="http://localhost:3003/api/agent"
DB_CMD="psql -h localhost -U justin -d bet_game"

case "$1" in
    "list")
        echo "=== 查看所有公告 ==="
        curl -s "$API_URL/notices" | jq '.notices[] | {id, title, category, created_at}'
        ;;
    
    "list-db")
        echo "=== 资料库中的公告 ==="
        $DB_CMD -c "SELECT id, title, category, status, created_at FROM notices ORDER BY created_at DESC;"
        ;;
    
    "count")
        echo "=== 公告统计 ==="
        $DB_CMD -c "SELECT COUNT(*) as total_notices, COUNT(CASE WHEN status = 1 THEN 1 END) as active_notices FROM notices;"
        ;;
    
    "create")
        if [ -z "$2" ] || [ -z "$3" ]; then
            echo "用法: $0 create '标题' '内容' [分类]"
            echo "分类选项: 最新公告, 维修, 活动"
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
            echo "用法: $0 edit [ID] '新标题' '新内容' [分类]"
            exit 1
        fi
        CATEGORY=${5:-"最新公告"}
        echo "=== 编辑公告 ID: $2 ==="
        curl -X PUT -H "Content-Type: application/json" \
             -d "{\"operatorId\": 1, \"title\": \"$3\", \"content\": \"$4\", \"category\": \"$CATEGORY\"}" \
             "$API_URL/notice/$2" | jq
        ;;
    
    "delete")
        if [ -z "$2" ]; then
            echo "用法: $0 delete [ID]"
            exit 1
        fi
        echo "=== 删除公告 ID: $2 ==="
        curl -X DELETE -H "Content-Type: application/json" \
             -d "{\"operatorId\": 1}" \
             "$API_URL/notice/$2" | jq
        ;;
    
    "test-api")
        echo "=== 测试API连接 ==="
        echo "1. 测试公告列表API..."
        curl -s "$API_URL/notices" > /dev/null && echo "✅ 公告API正常" || echo "❌ 公告API异常"
        
        echo "2. 测试后端健康状况..."
        curl -s "http://localhost:3003" > /dev/null && echo "✅ 后端服务运行中" || echo "❌ 后端服务异常"
        
        echo "3. 测试资料库连接..."
        $DB_CMD -c "SELECT 1;" > /dev/null 2>&1 && echo "✅ 资料库连接正常" || echo "❌ 资料库连接异常"
        ;;
    
    "reset-test-data")
        echo "=== 重置测试数据 ==="
        echo "清除现有公告..."
        $DB_CMD -c "DELETE FROM notices;"
        
        echo "重新建立测试公告..."
        # 添加测试公告
        curl -X POST -H "Content-Type: application/json" \
             -d '{"operatorId": 1, "title": "欢迎使用代理管理系统", "content": "欢迎使用全新的代理管理系统！系统提供会员管理、点数转移、投注记录查询等完整功能。如有任何问题，请随时联系技术支援。", "category": "最新公告"}' \
             "$API_URL/create-notice" > /dev/null
        
        curl -X POST -H "Content-Type: application/json" \
             -d '{"operatorId": 1, "title": "系统维护通知", "content": "本系统将于今晚00:00-02:00进行例行维护，期间可能会暂停服务，请提前做好准备。维护期间如有紧急情况，请联系客服人员。", "category": "维修"}' \
             "$API_URL/create-notice" > /dev/null
             
        curl -X POST -H "Content-Type: application/json" \
             -d '{"operatorId": 1, "title": "新春优惠活动开始", "content": "🎉 新春特别优惠活动正式开始！活动期间新会员注册即享首存100%优惠，最高可获得5000元奖金。活动详情请洽客服人员。", "category": "活动"}' \
             "$API_URL/create-notice" > /dev/null
        
        echo "✅ 测试数据重置完成"
        $0 count
        ;;
    
    "backup")
        echo "=== 备份公告数据 ==="
        BACKUP_FILE="notices_backup_$(date +%Y%m%d_%H%M%S).sql"
        $DB_CMD -c "\COPY notices TO '$BACKUP_FILE' WITH CSV HEADER;"
        echo "✅ 备份完成: $BACKUP_FILE"
        ;;
    
    *)
        echo "公告管理脚本"
        echo "用法: $0 [命令]"
        echo ""
        echo "命令列表:"
        echo "  list           - 查看所有活跃公告"
        echo "  list-db        - 查看资料库中所有公告"
        echo "  count          - 显示公告统计"
        echo "  create         - 新增公告"
        echo "  edit           - 编辑公告"
        echo "  delete         - 删除公告"
        echo "  test-api       - 测试API和服务状态"
        echo "  reset-test-data - 重置测试数据"
        echo "  backup         - 备份公告数据"
        echo ""
        echo "范例:"
        echo "  $0 list"
        echo "  $0 create '系统公告' '这是一个测试公告' '最新公告'"
        echo "  $0 edit 1 '修改后的标题' '修改后的内容' '维修'"
        echo "  $0 delete 1"
        ;;
esac 