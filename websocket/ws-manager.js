import { WebSocketServer } from 'ws';

class WebSocketManager {
    constructor() {
        this.wss = null;
        this.clients = new Map(); // sessionToken -> ws connection
    }

    initialize(server) {
        this.wss = new WebSocketServer({ server });

        this.wss.on('connection', (ws, req) => {
            console.log('新的 WebSocket 連接');

            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    
                    if (message.type === 'auth') {
                        // 認證連接
                        const sessionToken = message.sessionToken;
                        if (sessionToken) {
                            // 如果該 session 已有連接，關閉舊連接
                            if (this.clients.has(sessionToken)) {
                                const oldWs = this.clients.get(sessionToken);
                                if (oldWs.readyState === 1) { // OPEN
                                    oldWs.close();
                                }
                            }
                            
                            // 保存新連接
                            this.clients.set(sessionToken, ws);
                            ws.sessionToken = sessionToken;
                            
                            // 發送認證成功消息
                            ws.send(JSON.stringify({
                                type: 'auth_success',
                                message: '認證成功'
                            }));
                        }
                    }
                } catch (error) {
                    console.error('處理 WebSocket 消息錯誤:', error);
                }
            });

            ws.on('close', () => {
                // 移除連接
                if (ws.sessionToken) {
                    this.clients.delete(ws.sessionToken);
                }
                console.log('WebSocket 連接關閉');
            });

            ws.on('error', (error) => {
                console.error('WebSocket 錯誤:', error);
            });

            // 心跳檢測
            ws.isAlive = true;
            ws.on('pong', () => {
                ws.isAlive = true;
            });
        });

        // 心跳檢測定時器
        const interval = setInterval(() => {
            this.wss.clients.forEach((ws) => {
                if (ws.isAlive === false) {
                    if (ws.sessionToken) {
                        this.clients.delete(ws.sessionToken);
                    }
                    return ws.terminate();
                }

                ws.isAlive = false;
                ws.ping();
            });
        }, 30000); // 30秒心跳

        this.wss.on('close', () => {
            clearInterval(interval);
        });
    }

    // 通知會話失效
    notifySessionInvalidated(sessionToken) {
        const ws = this.clients.get(sessionToken);
        if (ws && ws.readyState === 1) { // OPEN
            ws.send(JSON.stringify({
                type: 'session_invalidated',
                message: '您的账号在另一个设备登入，您已被登出'
            }));
            
            // 給客戶端一點時間接收消息後關閉連接
            setTimeout(() => {
                if (ws.readyState === 1) {
                    ws.close();
                }
                this.clients.delete(sessionToken);
            }, 1000);
        }
    }

    // 廣播消息給所有連接的客戶端
    broadcast(message) {
        const messageStr = JSON.stringify(message);
        this.wss.clients.forEach((ws) => {
            if (ws.readyState === 1) { // OPEN
                ws.send(messageStr);
            }
        });
    }

    // 發送消息給特定會話
    sendToSession(sessionToken, message) {
        const ws = this.clients.get(sessionToken);
        if (ws && ws.readyState === 1) {
            ws.send(JSON.stringify(message));
        }
    }
}

export default new WebSocketManager();