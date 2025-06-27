// 代理管理系统前端 JavaScript 档案
// 最后更新：2025-01-14

// API 基礎 URL - 根據環境调整
let API_BASE_URL;

if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // 本地開發環境 - 代理系统运行在3003端口
    API_BASE_URL = 'http://localhost:3003/api/agent';
} else {
    // Render 生產環境 - 不使用端口号，讓Render处理路由
    API_BASE_URL = 'https://bet-agent.onrender.com/api/agent';
}

// 添加調試信息
console.log('当前API基礎URL:', API_BASE_URL, '主機名:', window.location.hostname);

// Vue应用实例
const { createApp } = Vue;

const app = createApp({
    data() {
        return {
            // 身份驗證狀態
            isLoggedIn: false,
            loading: false,
            
            // 用戶信息
            currentAgent: {
                id: null,
                username: '',
                level: 0,
                balance: 0,
                status: 1  // 重要：存储代理状态
            },
            
            // 其他必要的数据...
            activeTab: 'dashboard',
            agents: [],
            members: [],
            agentFilters: {
                level: '-1',
                status: '-1',
                keyword: ''
            },
            memberFilters: {
                status: '-1',
                keyword: ''
            }
        };
    },
    
    methods: {
        // 检查代理权限
        checkAgentPermissions(actionName = '此操作') {
            if (!this.currentAgent || this.currentAgent.status === undefined) {
                this.showMessage('用戶信息無效，请重新登录', 'error');
                return false;
            }
            
            // 检查代理状态：0=停用, 1=启用, 2=凍結
            if (this.currentAgent.status === 0) {
                this.showMessage('您的帐号已被停用，请联系上级代理', 'error');
                return false;
            } else if (this.currentAgent.status === 2) {
                this.showMessage('您的帐号已被凍結，只能查看信息无法进行任何操作', 'warning');
                return false;
            }
            
            return true;
        },

        // 获取状态显示文本
        getStatusText(status) {
            switch (parseInt(status)) {
                case 1: return '启用';
                case 0: return '停用';
                case 2: return '凍結';
                default: return '未知';
            }
        },

        // 获取状态徽章CSS类
        getStatusBadgeClass(status) {
            switch (parseInt(status)) {
                case 1: return 'badge bg-success';
                case 0: return 'badge bg-danger';
                case 2: return 'badge bg-warning';
                default: return 'badge bg-secondary';
            }
        },

        // 获取状态图标CSS类
        getStatusIconClass(status) {
            switch (parseInt(status)) {
                case 1: return 'fa-check-circle';
                case 0: return 'fa-times-circle';
                case 2: return 'fa-lock';
                default: return 'fa-question-circle';
            }
        },

        // 修改的会员状态切换方法
        async toggleMemberStatus(memberId, currentStatus) {
            // 检查代理权限
            if (!this.checkAgentPermissions('切换会员状态')) {
                return;
            }
            
            // 循环切换状态：启用(1) -> 停用(0) -> 凍結(2) -> 启用(1)
            let newStatus;
            let actionText;
            
            if (currentStatus === 1) {
                newStatus = 0;
                actionText = '停用';
            } else if (currentStatus === 0) {
                newStatus = 2;
                actionText = '凍結';
            } else {
                newStatus = 1;
                actionText = '启用';
            }
            
            if (!confirm(`确定要${actionText}該会员嗎？${newStatus === 2 ? '\\n\\n凍結後会员將無法进行任何下注操作，只能观看游戏' : ''}`)) {
                return;
            }

            this.loading = true;
            try {
                const response = await axios.post(`${API_BASE_URL}/toggle-member-status`, { memberId, status: newStatus });
                if (response.data.success) {
                    this.showMessage(`会员已${actionText}`, 'success');
                    // 更新本地会员列表中的狀態
                    const member = this.members.find(m => m.id === memberId);
                    if (member) {
                        member.status = newStatus;
                    }
                } else {
                    this.showMessage(response.data.message || `${actionText}会员失败`, 'error');
                }
            } catch (error) {
                console.error(`${actionText}会员出錯:`, error);
                this.showMessage(error.response?.data?.message || `${actionText}会员失败，请稍後再試`, 'error');
            } finally {
                this.loading = false;
            }
        },

        // 修改的代理状态切换方法
        async toggleAgentStatus(agent) {
            // 检查代理权限
            if (!this.checkAgentPermissions('切换代理状态')) {
                return;
            }
            
            // 循环切换状态：启用(1) -> 停用(0) -> 凍結(2) -> 启用(1)
            let newStatus;
            let actionText;
            
            if (agent.status === 1) {
                newStatus = 0;
                actionText = '停用';
            } else if (agent.status === 0) {
                newStatus = 2;
                actionText = '凍結';
            } else {
                newStatus = 1;
                actionText = '启用';
            }
            
            if (!confirm(`确定要${actionText}該代理嗎？${newStatus === 2 ? '\\n\\n凍結後代理只能查看管理系统，无法进行任何操作' : ''}`)) {
                return;
            }

            this.loading = true;
            try {
                const response = await axios.post(`${API_BASE_URL}/toggle-agent-status`, { 
                    agentId: agent.id, 
                    status: newStatus 
                });
                
                if (response.data.success) {
                    this.showMessage(`代理已${actionText}`, 'success');
                    // 更新本地代理列表中的狀態
                    const agentInList = this.agents.find(a => a.id === agent.id);
                    if (agentInList) {
                        agentInList.status = newStatus;
                    }
                } else {
                    this.showMessage(response.data.message || `${actionText}代理失败`, 'error');
                }
            } catch (error) {
                console.error(`${actionText}代理出錯:`, error);
                this.showMessage(error.response?.data?.message || `${actionText}代理失败，请稍後再試`, 'error');
            } finally {
                this.loading = false;
            }
        },

        // 带权限检查的操作方法包装器
        createAgentWithPermissionCheck() {
            if (!this.checkAgentPermissions('新增代理')) return;
            // 调用实际的创建代理方法
        },

        createMemberWithPermissionCheck() {
            if (!this.checkAgentPermissions('新增会员')) return;
            // 调用实际的创建会员方法
        },

        adjustBalanceWithPermissionCheck(target) {
            if (!this.checkAgentPermissions('余额调整')) return;
            // 调用实际的余额调整方法
        },

        // 显示消息的简单实现
        showMessage(message, type = 'info') {
            // 简单的消息显示实现
            const alertClass = type === 'success' ? 'alert-success' : 
                             type === 'error' ? 'alert-danger' : 
                             type === 'warning' ? 'alert-warning' : 'alert-info';
            
            const alertDiv = document.createElement('div');
            alertDiv.className = `alert ${alertClass} alert-dismissible fade show position-fixed`;
            alertDiv.style.top = '20px';
            alertDiv.style.right = '20px';
            alertDiv.style.zIndex = '9999';
            alertDiv.innerHTML = `
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            `;
            
            document.body.appendChild(alertDiv);
            
            // 自动移除
            setTimeout(() => {
                if (alertDiv.parentNode) {
                    alertDiv.parentNode.removeChild(alertDiv);
                }
            }, 5000);
        },

        // 简单的登录检查方法
        async checkAuth() {
            try {
                const response = await axios.get(`${API_BASE_URL}/profile`);
                if (response.data.success) {
                    this.currentAgent = response.data.agent;
                    this.isLoggedIn = true;
                    return true;
                }
            } catch (error) {
                console.error('登录检查失败:', error);
            }
            return false;
        }
    },

    async mounted() {
        // 页面加载时检查登录状态
        await this.checkAuth();
    }
});

// 挂载Vue应用
try {
    app.mount('#app');
    console.log('Vue应用挂载成功');
} catch (error) {
    console.error('Vue应用挂载失败:', error);
} 