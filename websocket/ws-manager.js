import { WebSocketServer } from 'ws';

class WebSocketManager {
    constructor() {
        this.wss = null;
        this.clients = new Map(); // sessionToken -> ws connection
    }

    initialize(server) {
        this.wss = new WebSocketServer({ server });

        this.wss.on('connection', (ws, req) => {
            console.log('新的 WebSocket 连接');

            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    
                    if (message.type === 'auth') {
                        // 认证连接
                        const sessionToken = message.sessionToken;
                        if (sessionToken) {
                            // 如果该 session 已有连接，关闭旧连接
                            if (this.clients.has(sessionToken)) {
                                const oldWs = this.clients.get(sessionToken);
                                if (oldWs.readyState === 1) { // OPEN
                                    oldWs.close();
                                }
                            }
                            
                            // 保存新连接
                            this.clients.set(sessionToken, ws);
                            ws.sessionToken = sessionToken;
                            
                            // 发送认证成功消息
                            ws.send(JSON.stringify({
                                type: 'auth_success',
                                message: '认证成功'
                            }));
                        }
                    }
                } catch (error) {
                    console.error('处理 WebSocket 消息错误:', error);
                }
            });

            ws.on('close', () => {
                // 移除连接
                if (ws.sessionToken) {
                    this.clients.delete(ws.sessionToken);
                }
                console.log('WebSocket 连接关闭');
            });

            ws.on('error', (error) => {
                console.error('WebSocket 错误:', error);
            });

            // 心跳检测
            ws.isAlive = true;
            ws.on('pong', () => {
                ws.isAlive = true;
            });
        });

        // 心跳检测定时器
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

    // 通知会话失效
    notifySessionInvalidated(sessionToken) {
        const ws = this.clients.get(sessionToken);
        if (ws && ws.readyState === 1) { // OPEN
            ws.send(JSON.stringify({
                type: 'session_invalidated',
                message: '您的账号在另一个设备登入，您已被登出'
            }));
            
            // 给客户端一点时间接收消息后关闭连接
            setTimeout(() => {
                if (ws.readyState === 1) {
                    ws.close();
                }
                this.clients.delete(sessionToken);
            }, 1000);
        }
    }

    // 广播消息给所有连接的客户端
    broadcast(message) {
        const messageStr = JSON.stringify(message);
        this.wss.clients.forEach((ws) => {
            if (ws.readyState === 1) { // OPEN
                ws.send(messageStr);
            }
        });
    }

    // 发送消息给特定会话
    sendToSession(sessionToken, message) {
        const ws = this.clients.get(sessionToken);
        if (ws && ws.readyState === 1) {
            ws.send(JSON.stringify(message));
        }
    }
}

export default new WebSocketManager();