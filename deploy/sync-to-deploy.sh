#!/bin/bash

# 同步关键档案到 deploy 资料夹
# 这确保 deploy 资料夹包含最新的生产环境档案

echo "🔄 开始同步档案到 deploy 资料夹..."

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 同步后端档案
echo -e "${YELLOW}同步后端档案...${NC}"
cp backend.js deploy/backend.js && echo -e "${GREEN}✓ backend.js${NC}"
cp agentBackend.js deploy/agentBackend.js && echo -e "${GREEN}✓ agentBackend.js${NC}"
cp package.json deploy/package.json && echo -e "${GREEN}✓ package.json${NC}"
cp package-lock.json deploy/package-lock.json 2>/dev/null && echo -e "${GREEN}✓ package-lock.json${NC}"

# 同步游戏前端档案
echo -e "\n${YELLOW}同步游戏前端档案...${NC}"
mkdir -p deploy/frontend/src/scripts
mkdir -p deploy/frontend/src/components
mkdir -p deploy/frontend/css
mkdir -p deploy/frontend/js

cp -r frontend/index.html deploy/frontend/ && echo -e "${GREEN}✓ frontend/index.html${NC}"
cp -r frontend/login.html deploy/frontend/ && echo -e "${GREEN}✓ frontend/login.html${NC}"
cp -r frontend/css/* deploy/frontend/css/ 2>/dev/null && echo -e "${GREEN}✓ frontend/css/${NC}"
cp -r frontend/js/* deploy/frontend/js/ 2>/dev/null && echo -e "${GREEN}✓ frontend/js/${NC}"
cp -r frontend/src/scripts/* deploy/frontend/src/scripts/ 2>/dev/null && echo -e "${GREEN}✓ frontend/src/scripts/${NC}"
cp -r frontend/src/components/* deploy/frontend/src/components/ 2>/dev/null && echo -e "${GREEN}✓ frontend/src/components/${NC}"
cp -r frontend/sounds deploy/frontend/ 2>/dev/null && echo -e "${GREEN}✓ frontend/sounds/${NC}"
cp frontend/favicon.svg deploy/frontend/ 2>/dev/null && echo -e "${GREEN}✓ frontend/favicon.svg${NC}"
cp frontend/cyberpunk-car.jpg deploy/frontend/ 2>/dev/null && echo -e "${GREEN}✓ frontend/cyberpunk-car.jpg${NC}"

# 同步代理前端档案
echo -e "\n${YELLOW}同步代理前端档案...${NC}"
mkdir -p deploy/agent/frontend/css
mkdir -p deploy/agent/frontend/js

cp -r agent/frontend/index.html deploy/agent/frontend/ && echo -e "${GREEN}✓ agent/frontend/index.html${NC}"
cp -r agent/frontend/login.html deploy/agent/frontend/ 2>/dev/null && echo -e "${GREEN}✓ agent/frontend/login.html${NC}"
cp -r agent/frontend/css/* deploy/agent/frontend/css/ 2>/dev/null && echo -e "${GREEN}✓ agent/frontend/css/${NC}"
cp -r agent/frontend/js/* deploy/agent/frontend/js/ 2>/dev/null && echo -e "${GREEN}✓ agent/frontend/js/${NC}"
cp agent/frontend/favicon.svg deploy/agent/frontend/ 2>/dev/null && echo -e "${GREEN}✓ agent/frontend/favicon.svg${NC}"
cp agent/frontend/f1-racing.jpg deploy/agent/frontend/ 2>/dev/null && echo -e "${GREEN}✓ agent/frontend/f1-racing.jpg${NC}"
cp agent/frontend/.htaccess deploy/agent/frontend/ 2>/dev/null && echo -e "${GREEN}✓ agent/frontend/.htaccess${NC}"

# 同步资料库相关档案
echo -e "\n${YELLOW}同步资料库档案...${NC}"
mkdir -p deploy/db/models
cp -r db/config.js deploy/db/ && echo -e "${GREEN}✓ db/config.js${NC}"
cp -r db/init.js deploy/db/ && echo -e "${GREEN}✓ db/init.js${NC}"
cp -r db/models/* deploy/db/models/ 2>/dev/null && echo -e "${GREEN}✓ db/models/${NC}"

# 同步安全相关档案
echo -e "\n${YELLOW}同步安全档案...${NC}"
mkdir -p deploy/security
cp -r security/* deploy/security/ 2>/dev/null && echo -e "${GREEN}✓ security/${NC}"

# 同步工具档案
echo -e "\n${YELLOW}同步工具档案...${NC}"
mkdir -p deploy/utils
cp -r utils/* deploy/utils/ 2>/dev/null && echo -e "${GREEN}✓ utils/${NC}"

# 同步重要的设定档案
echo -e "\n${YELLOW}同步设定档案...${NC}"
cp .env deploy/.env 2>/dev/null && echo -e "${GREEN}✓ .env${NC}"
cp render.yaml deploy/render.yaml 2>/dev/null && echo -e "${GREEN}✓ render.yaml${NC}"
cp CLAUDE.md deploy/CLAUDE.md 2>/dev/null && echo -e "${GREEN}✓ CLAUDE.md${NC}"

# 同步重要的修复档案
echo -e "\n${YELLOW}同步重要修复档案...${NC}"
cp comprehensive-settlement-system.js deploy/ 2>/dev/null && echo -e "${GREEN}✓ comprehensive-settlement-system.js${NC}"
cp enhanced-settlement-system.js deploy/ 2>/dev/null && echo -e "${GREEN}✓ enhanced-settlement-system.js${NC}"
cp improved-settlement-system.js deploy/ 2>/dev/null && echo -e "${GREEN}✓ improved-settlement-system.js${NC}"
cp optimized-betting-system.js deploy/ 2>/dev/null && echo -e "${GREEN}✓ optimized-betting-system.js${NC}"
cp fixed-draw-system.js deploy/ 2>/dev/null && echo -e "${GREEN}✓ fixed-draw-system.js${NC}"
cp ensure-database-constraints.js deploy/ 2>/dev/null && echo -e "${GREEN}✓ ensure-database-constraints.js${NC}"

echo -e "\n${GREEN}✅ 同步完成！${NC}"
echo -e "${YELLOW}提示：${NC}"
echo "1. 如果要部署到 Render，请 cd 到 deploy 资料夹"
echo "2. 执行 git add -A && git commit -m '同步最新版本'"
echo "3. 执行 git push 来触发 Render 自动部署"