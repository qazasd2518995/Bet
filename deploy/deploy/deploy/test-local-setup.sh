#!/bin/bash

# 本地測試腳本
echo "🧪 開始本地環境測試..."

# 顏色定義
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 檢查 Node.js 版本
echo -e "\n${BLUE}檢查環境...${NC}"
NODE_VERSION=$(node -v)
echo -e "Node.js 版本: ${GREEN}$NODE_VERSION${NC}"

NPM_VERSION=$(npm -v)
echo -e "NPM 版本: ${GREEN}$NPM_VERSION${NC}"

# 檢查必要的檔案
echo -e "\n${BLUE}檢查必要檔案...${NC}"
FILES_TO_CHECK=(
    "backend.js"
    "agentBackend.js"
    "package.json"
    "db/config.js"
    "frontend/index.html"
    "agent/frontend/index.html"
)

for file in "${FILES_TO_CHECK[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file"
    else
        echo -e "${RED}✗${NC} $file - 檔案不存在！"
        exit 1
    fi
done

# 安裝依賴
echo -e "\n${BLUE}安裝依賴...${NC}"
npm install

# 測試資料庫連接
echo -e "\n${BLUE}測試資料庫連接...${NC}"
node -e "
const db = require('./db/config.js').default;
db.one('SELECT 1 as test')
    .then(() => {
        console.log('\x1b[32m✓ 資料庫連接成功\x1b[0m');
        process.exit(0);
    })
    .catch(err => {
        console.error('\x1b[31m✗ 資料庫連接失敗:\x1b[0m', err.message);
        process.exit(1);
    });
" || exit 1

# 啟動測試選項
echo -e "\n${YELLOW}請選擇測試模式：${NC}"
echo "1) 測試遊戲端 (Port 3000)"
echo "2) 測試代理端 (Port 3003)"
echo "3) 同時測試兩個系統"
echo "4) 退出"

read -p "請輸入選項 (1-4): " choice

case $choice in
    1)
        echo -e "\n${GREEN}啟動遊戲端...${NC}"
        echo -e "${YELLOW}訪問: http://localhost:3000${NC}"
        npm run dev
        ;;
    2)
        echo -e "\n${GREEN}啟動代理端...${NC}"
        echo -e "${YELLOW}訪問: http://localhost:3003${NC}"
        npm run dev:agent
        ;;
    3)
        echo -e "\n${GREEN}同時啟動遊戲端和代理端...${NC}"
        echo -e "${YELLOW}遊戲端: http://localhost:3000${NC}"
        echo -e "${YELLOW}代理端: http://localhost:3003${NC}"
        npm run dev:all
        ;;
    4)
        echo -e "\n${BLUE}測試結束${NC}"
        exit 0
        ;;
    *)
        echo -e "\n${RED}無效選項${NC}"
        exit 1
        ;;
esac