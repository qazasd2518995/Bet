# 子帳號功能實現說明

## 功能概述

為代理管理系統新增了子帳號功能，每個代理可以創建最多 2 個子帳號。子帳號只能查看報表，無法進行其他操作。

## 實現內容

### 1. 前端修改

#### 導航欄更新
- 將「帳號管理」改為下拉選單，包含：
  - 代理＆會員
  - 子帳號

#### 新增子帳號管理頁面
- 顯示子帳號列表
- 新增子帳號按鈕（最多 2 個）
- 子帳號操作：啟用/停用、刪除

#### 子帳號權限限制
- 子帳號登入後只顯示「報表查詢」選項
- 隱藏所有其他功能選單
- 自動切換到報表查詢頁面

### 2. 後端實現

#### 數據庫表結構
```sql
CREATE TABLE sub_accounts (
    id SERIAL PRIMARY KEY,
    parent_agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    status INTEGER DEFAULT 1, -- 1: 啟用, 0: 停用
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### API 端點
- `GET /api/agent/subaccounts` - 獲取子帳號列表
- `POST /api/agent/subaccounts` - 創建子帳號
- `PUT /api/agent/subaccounts/:id/status` - 更新子帳號狀態
- `DELETE /api/agent/subaccounts/:id` - 刪除子帳號

#### 登入修改
- 支持子帳號登入
- 返回 `is_sub_account: true` 標記
- 記錄子帳號登入日誌

### 3. 使用說明

1. **創建子帳號**
   - 登入代理帳號
   - 進入「帳號管理」→「子帳號」
   - 點擊「新增子帳號」
   - 輸入子帳號名稱和密碼

2. **子帳號登入**
   - 使用子帳號名稱和密碼登入
   - 登入後只能看到「報表查詢」功能
   - 無法進行其他操作

3. **管理子帳號**
   - 可以啟用/停用子帳號
   - 可以刪除子帳號
   - 每個代理最多 2 個子帳號

## 文件修改清單

### 前端
- `/agent/frontend/index.html` - 添加子帳號頁面和模態框
- `/agent/frontend/js/main.js` - 添加子帳號相關邏輯

### 後端
- `/agentBackend.js` - 添加子帳號 API 和修改登入邏輯

### 數據庫
- `/create-subaccounts-table.sql` - 創建表的 SQL
- `/init-subaccounts.js` - 初始化腳本
- `/check-subaccounts-table.js` - 檢查和重建表腳本

## 注意事項

1. 子帳號使用父代理的 ID 進行報表查詢
2. 子帳號無法修改任何數據
3. 子帳號的密碼使用 bcrypt 加密
4. 刪除代理時會自動刪除其所有子帳號（CASCADE）