#!/bin/bash

# 确保脚本在错误时停止执行
set -e

echo "开始同步前端文件..."

# 检查是否在正确的目录
if [ ! -d "frontend" ] || [ ! -d "deploy" ]; then
    echo "错误：请在专案根目录执行此脚本"
    exit 1
fi

# 清理 deploy/frontend 目录
echo "清理 deploy/frontend 目录..."
rm -rf deploy/frontend/*

# 复制前端文件到部署目录
echo "复制前端文件到部署目录..."
cp -r frontend/* deploy/frontend/

# 确保 src 目录存在
mkdir -p deploy/frontend/src

echo "同步完成！" 