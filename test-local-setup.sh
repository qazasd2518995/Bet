#!/bin/bash

# 本地测试脚本
echo "🧪 开始本地环境测试..."

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 检查 Node.js 版本
echo -e "\n${BLUE}检查环境...${NC}"
NODE_VERSION=$(node -v)
echo -e "Node.js 版本: ${GREEN}$NODE_VERSION${NC}"

NPM_VERSION=$(npm -v)
echo -e "NPM 版本: ${GREEN}$NPM_VERSION${NC}"

# 检查必要的档案
echo -e "\n${BLUE}检查必要档案...${NC}"
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
        echo -e "${RED}✗${NC} $file - 档案不存在！"
        exit 1
    fi
done

# 安装依赖
echo -e "\n${BLUE}安装依赖...${NC}"
npm install

# 测试资料库连接
echo -e "\n${BLUE}测试资料库连接...${NC}"
node -e "
const db = require('./db/config.js').default;
db.one('SELECT 1 as test')
    .then(() => {
        console.log('\x1b[32m✓ 资料库连接成功\x1b[0m');
        process.exit(0);
    })
    .catch(err => {
        console.error('\x1b[31m✗ 资料库连接失败:\x1b[0m', err.message);
        process.exit(1);
    });
" || exit 1

# 启动测试选项
echo -e "\n${YELLOW}请选择测试模式：${NC}"
echo "1) 测试游戏端 (Port 3000)"
echo "2) 测试代理端 (Port 3003)"
echo "3) 同时测试两个系统"
echo "4) 退出"

read -p "请输入选项 (1-4): " choice

case $choice in
    1)
        echo -e "\n${GREEN}启动游戏端...${NC}"
        echo -e "${YELLOW}访问: http://localhost:3000${NC}"
        npm run dev
        ;;
    2)
        echo -e "\n${GREEN}启动代理端...${NC}"
        echo -e "${YELLOW}访问: http://localhost:3003${NC}"
        npm run dev:agent
        ;;
    3)
        echo -e "\n${GREEN}同时启动游戏端和代理端...${NC}"
        echo -e "${YELLOW}游戏端: http://localhost:3000${NC}"
        echo -e "${YELLOW}代理端: http://localhost:3003${NC}"
        npm run dev:all
        ;;
    4)
        echo -e "\n${BLUE}测试结束${NC}"
        exit 0
        ;;
    *)
        echo -e "\n${RED}无效选项${NC}"
        exit 1
        ;;
esac