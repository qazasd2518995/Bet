# 開獎網部署指南

## Render 環境變數設置

請在 Render Dashboard 中設置以下環境變數：

### 必須設置的變數：

1. **GAME_API_URL**
   ```
   GAME_API_URL=https://bet-game-vcje.onrender.com
   ```

2. **DATABASE_URL**
   ```
   DATABASE_URL=postgresql://fsracing_user:gKr7pS8Kg48MknKwQirSPuNiRIpvLXhB@dpg-ct5t88lds78s73co2gdg-a.oregon-postgres.render.com/fsracing
   ```

## 設置步驟：

1. 登入 Render Dashboard
2. 找到您的開獎網服務 (racing10-lottery)
3. 點擊 "Environment" 標籤
4. 點擊 "Add Environment Variable"
5. 添加上述變數
6. 儲存後服務會自動重新部署

## 驗證部署：

部署完成後，訪問以下 URL 確認 API 正常運作：
- https://racing10-lottery.onrender.com/api/game-state

應該看到類似以下的響應：
```json
{
  "success": true,
  "data": {
    "current_period": "20250118XXX",
    "countdown_seconds": XX,
    "last_result": [1,2,3,4,5,6,7,8,9,10],
    "status": "betting",
    "server_time": "2025-01-18T...",
    "next_draw_time": "2025-01-18T..."
  }
}
```

## 故障排除：

如果仍然無法同步：
1. 檢查主遊戲是否正常運行：https://bet-game-vcje.onrender.com
2. 確認環境變數已正確設置
3. 查看 Render 日誌中的錯誤訊息