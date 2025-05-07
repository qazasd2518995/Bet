#!/bin/bash

# 確保腳本在錯誤時停止執行
set -e

echo "開始同步前端文件..."

# 檢查是否在正確的目錄
if [ ! -d "frontend" ] || [ ! -d "deploy" ]; then
    echo "錯誤：請在專案根目錄執行此腳本"
    exit 1
fi

# 清理 deploy/frontend 目錄
echo "清理 deploy/frontend 目錄..."
rm -rf deploy/frontend/*

# 複製前端文件到部署目錄
echo "複製前端文件到部署目錄..."
cp -r frontend/* deploy/frontend/

# 確保 src 目錄存在
mkdir -p deploy/frontend/src

echo "同步完成！" 