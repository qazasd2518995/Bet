#!/bin/bash

# 設置 Node.js 記憶體限制為 512MB
export NODE_OPTIONS="--max-old-space-size=512"

# 設置端口（Render 會提供 PORT 環境變數）
export PORT=${PORT:-10000}

# 檢查是否存在 standalone 伺服器
if [ -f ".next/standalone/server.js" ]; then
    echo "Starting with standalone server..."
    # 複製靜態文件到 standalone 目錄（如果需要）
    if [ -d ".next/static" ] && [ -d ".next/standalone/.next" ]; then
        cp -r .next/static .next/standalone/.next/
    fi
    # 複製 public 文件到 standalone 目錄（如果需要）
    if [ -d "public" ] && [ ! -d ".next/standalone/public" ]; then
        cp -r public .next/standalone/
    fi
    # 使用 standalone 模式啟動
    node .next/standalone/server.js
else
    echo "Standalone server not found, using regular next start..."
    # 使用常規方式啟動
    exec npm run start:regular
fi