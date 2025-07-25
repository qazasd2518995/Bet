#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
繁體中文轉簡體中文腳本
將專案中所有檔案的繁體中文轉換為簡體中文
"""

import os
import sys
import json
import re
from pathlib import Path

# 嘗試導入 opencc，如果沒有則提示安裝
try:
    import opencc
except ImportError:
    print("請先安裝 OpenCC-Python:")
    print("pip3 install opencc-python-reimplemented")
    sys.exit(1)

# 初始化 OpenCC 轉換器（繁體轉簡體）
converter = opencc.OpenCC('t2s.json')

# 需要處理的文件擴展名
FILE_EXTENSIONS = [
    '.js', '.html', '.css', '.json', '.md', '.sql', '.txt', '.yml', '.yaml',
    '.vue', '.jsx', '.ts', '.tsx', '.env', '.sh', '.py'
]

# 需要跳過的目錄
SKIP_DIRS = [
    'node_modules', '.git', '.next', 'dist', 'build', '.cache',
    'coverage', '.pytest_cache', '__pycache__', '.vscode',
    'logs', 'tmp', 'temp', '.idea', 'vendor'
]

# 需要跳過的文件
SKIP_FILES = [
    'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
    '.gitignore', '.env.local', '.env.production'
]

# 統計信息
stats = {
    'files_processed': 0,
    'files_skipped': 0,
    'files_error': 0,
    'total_conversions': 0
}

def should_process_file(file_path):
    """判斷是否應該處理此文件"""
    # 檢查文件擴展名
    if not any(file_path.endswith(ext) for ext in FILE_EXTENSIONS):
        return False
    
    # 檢查是否在跳過列表中
    file_name = os.path.basename(file_path)
    if file_name in SKIP_FILES:
        return False
    
    # 檢查文件大小（跳過超過 10MB 的文件）
    if os.path.getsize(file_path) > 10 * 1024 * 1024:
        print(f"跳過大文件: {file_path}")
        return False
    
    return True

def convert_content(content):
    """轉換文本內容"""
    try:
        # 使用 OpenCC 進行轉換
        converted = converter.convert(content)
        
        # 特殊詞彙映射（根據項目需要調整）
        special_mappings = {
            '開獎': '开奖',
            '歷史': '历史',
            '記錄': '记录',
            '會員': '会员',
            '餘額': '余额',
            '盈虧': '盈亏',
            '龍虎': '龙虎',
            '單雙': '单双',
            '莊閒': '庄闲',
            '賠率': '赔率',
            '下註': '下注',
            '結算': '结算',
            '充值': '充值',
            '提現': '提现',
            '代理': '代理',
            '傭金': '佣金',
            '返水': '返水',
            '限紅': '限红',
            '維護': '维护',
            '公告': '公告',
            '客服': '客服',
            '註冊': '注册',
            '登錄': '登录',
            '密碼': '密码',
            '驗證': '验证',
            '確認': '确认',
            '取消': '取消',
            '查詢': '查询',
            '統計': '统计',
            '報表': '报表',
            '設置': '设置',
            '系統': '系统',
            '管理': '管理',
            '權限': '权限',
            '操作': '操作',
            '狀態': '状态',
            '時間': '时间',
            '日期': '日期',
            '金額': '金额',
            '類型': '类型',
            '備註': '备注',
            '詳情': '详情',
            '返回': '返回',
            '刷新': '刷新',
            '導出': '导出',
            '導入': '导入',
            '搜索': '搜索',
            '篩選': '筛选',
            '排序': '排序',
            '編輯': '编辑',
            '刪除': '删除',
            '添加': '添加',
            '保存': '保存',
            '提交': '提交',
            '審核': '审核',
            '通過': '通过',
            '拒絕': '拒绝',
            '凍結': '冻结',
            '解凍': '解冻',
            '啟用': '启用',
            '禁用': '禁用',
            '在線': '在线',
            '離線': '离线',
            '異常': '异常',
            '正常': '正常',
            '成功': '成功',
            '失敗': '失败',
            '錯誤': '错误',
            '警告': '警告',
            '提示': '提示',
            '確定': '确定',
            '關閉': '关闭',
            '載入': '加载',
            '處理': '处理',
            '完成': '完成',
            '進行中': '进行中',
            '待處理': '待处理',
            '已處理': '已处理',
            '未處理': '未处理',
        }
        
        # 應用特殊映射
        for trad, simp in special_mappings.items():
            converted = converted.replace(trad, simp)
        
        return converted
    except Exception as e:
        print(f"轉換錯誤: {e}")
        return content

def process_file(file_path):
    """處理單個文件"""
    try:
        # 讀取文件
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 轉換內容
        original_content = content
        converted_content = convert_content(content)
        
        # 如果內容有變化，寫回文件
        if original_content != converted_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(converted_content)
            
            stats['total_conversions'] += 1
            print(f"✓ 已轉換: {file_path}")
        else:
            print(f"- 無需轉換: {file_path}")
        
        stats['files_processed'] += 1
        
    except Exception as e:
        print(f"✗ 處理失敗: {file_path} - {e}")
        stats['files_error'] += 1

def process_directory(directory):
    """遞歸處理目錄"""
    for root, dirs, files in os.walk(directory):
        # 過濾掉不需要處理的目錄
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        
        for file in files:
            file_path = os.path.join(root, file)
            
            if should_process_file(file_path):
                process_file(file_path)
            else:
                stats['files_skipped'] += 1

def main():
    """主函數"""
    print("=== 繁體中文轉簡體中文工具 ===")
    print(f"當前目錄: {os.getcwd()}")
    print("")
    
    # 確認執行
    response = input("確定要將所有檔案的繁體中文轉換為簡體中文嗎？(y/N): ")
    if response.lower() != 'y':
        print("已取消操作")
        return
    
    print("\n開始處理...")
    
    # 處理主要目錄
    directories_to_process = [
        '.',  # 當前目錄（根目錄）
        'frontend',
        'agent',
        'lottery-website',
        'db',
        'scripts',
    ]
    
    for directory in directories_to_process:
        if os.path.exists(directory):
            print(f"\n處理目錄: {directory}")
            process_directory(directory)
    
    # 顯示統計信息
    print("\n=== 轉換完成 ===")
    print(f"處理文件數: {stats['files_processed']}")
    print(f"跳過文件數: {stats['files_skipped']}")
    print(f"錯誤文件數: {stats['files_error']}")
    print(f"實際轉換數: {stats['total_conversions']}")
    
    # 同步到 deploy 目錄
    print("\n同步到 deploy 目錄...")
    os.system("rsync -av --exclude=node_modules --exclude=.git --exclude=.next --exclude=logs . deploy/")
    print("同步完成！")
    
    # 提示提交到 Git
    print("\n準備提交到 GitHub...")
    print("請執行以下命令：")
    print("git add -A")
    print('git commit -m "將所有繁體中文轉換為簡體中文"')
    print("git push")

if __name__ == "__main__":
    main()