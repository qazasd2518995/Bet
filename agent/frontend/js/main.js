// 代理管理系统前端 JavaScript 档案
// 最后更新：2025-01-14 - 支持三状态管理系统

// API 基礎 URL
let API_BASE_URL;
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    API_BASE_URL = 'http://localhost:3003/api/agent';
} else {
    API_BASE_URL = 'https://bet-agent.onrender.com/api/agent';
}

console.log('当前API基礎URL:', API_BASE_URL);

const { createApp } = Vue;

const app = createApp({
    data() {
        return {
            API_BASE_URL: API_BASE_URL,
            isLoggedIn: false,
            loading: false,
            
            loginForm: { username: '', password: '' },
            
            user: {
                id: null,
                username: '',
                level: 0,
                balance: 0,
                status: 1
            },
            
            activeTab: 'dashboard',
            agents: [],
            members: [],
            
            agentFilters: { level: '-1', status: '-1', keyword: '' },
            memberFilters: { status: '-1', keyword: '' }
        };
    },
    
    async mounted() {
        await this.checkAuth();
    },
    
    methods: {
        // 权限检查 - 核心方法
        checkAgentPermissions(actionName = '此操作') {
            if (!this.user || this.user.status === undefined) {
                this.showMessage('用戶信息無效，请重新登录', 'error');
                return false;
            }
            
            if (this.user.status === 0) {
                this.showMessage('您的帐号已被停用，请联系上级代理', 'error');
                return false;
            } else if (this.user.status === 2) {
                this.showMessage('您的帐号已被凍結，只能查看信息无法进行任何操作', 'warning');
                return false;
            }
            
            return true;
        },

        // 状态文本显示
        getStatusText(status) {
            switch (parseInt(status)) {
                case 1: return '启用';
                case 0: return '停用';
                case 2: return '凍結';
                default: return '未知';
            }
        },

        // 状态样式
        getStatusBadgeClass(status) {
            switch (parseInt(status)) {
                case 1: return 'badge bg-success';
                case 0: return 'badge bg-danger';
                case 2: return 'badge bg-warning text-dark';
                default: return 'badge bg-secondary';
            }
        },

        // 状态图标
        getStatusIconClass(status) {
            switch (parseInt(status)) {
                case 1: return 'fa-check-circle';
                case 0: return 'fa-times-circle';
                case 2: return 'fa-lock';
                default: return 'fa-question-circle';
            }
        },
        
        // 会员状态切换 - 三状态循环
        async toggleMemberStatus(memberId, currentStatus) {
            if (!this.checkAgentPermissions('切换会员状态')) return;
            
            let newStatus, actionText;
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
            
            const msg = newStatus === 2 ? 
                `确定要${actionText}該会员嗎？\n\n凍結後会员將無法进行任何下注操作，只能观看游戏` :
                `确定要${actionText}該会员嗎？`;
                
            if (!confirm(msg)) return;

            try {
                const response = await axios.post(`${API_BASE_URL}/toggle-member-status`, { 
                    memberId, status: newStatus 
                });
                
                if (response.data.success) {
                    this.showMessage(`会员已${actionText}`, 'success');
                    const member = this.members.find(m => m.id === memberId);
                    if (member) member.status = newStatus;
                } else {
                    this.showMessage(response.data.message || `${actionText}会员失败`, 'error');
                }
            } catch (error) {
                this.showMessage(`${actionText}会员失败，请稍後再試`, 'error');
            }
        },
        
        // 代理状态切换 - 三状态循环
        async toggleAgentStatus(agent) {
            if (!this.checkAgentPermissions('切换代理状态')) return;
            
            let newStatus, actionText;
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
            
            const msg = newStatus === 2 ? 
                `确定要${actionText}該代理嗎？\n\n凍結後代理只能查看管理系统，无法进行任何操作` :
                `确定要${actionText}該代理嗎？`;
                
            if (!confirm(msg)) return;

            try {
                const response = await axios.post(`${API_BASE_URL}/toggle-agent-status`, { 
                    agentId: agent.id, status: newStatus 
                });
                
                if (response.data.success) {
                    this.showMessage(`代理已${actionText}`, 'success');
                    const agentInList = this.agents.find(a => a.id === agent.id);
                    if (agentInList) agentInList.status = newStatus;
                } else {
                    this.showMessage(response.data.message || `${actionText}代理失败`, 'error');
                }
            } catch (error) {
                this.showMessage(`${actionText}代理失败，请稍後再試`, 'error');
            }
        },
        
        // 登录
        async login() {
            if (!this.loginForm.username || !this.loginForm.password) {
                this.showMessage('请输入用戶名和密码', 'error');
                return;
            }
            
            this.loading = true;
            try {
                const response = await axios.post(`${API_BASE_URL}/login`, this.loginForm);
                if (response.data.success) {
                    this.user = response.data.agent;
                    this.isLoggedIn = true;
                    this.showMessage('登录成功', 'success');
                    
                    // 检查用户状态并给出相应提示
                    if (this.user.status === 2) {
                        this.showMessage('您的账号已被凍結，只能查看信息无法进行操作', 'warning');
                    } else if (this.user.status === 0) {
                        this.showMessage('您的账号已被停用', 'error');
                    }
                } else {
                    this.showMessage(response.data.message || '登录失败', 'error');
                }
            } catch (error) {
                this.showMessage('登录失败，请稍後再試', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 检查认证状态
        async checkAuth() {
            try {
                const response = await axios.get(`${API_BASE_URL}/profile`);
                if (response.data.success) {
                    this.user = response.data.agent;
                    this.isLoggedIn = true;
                    return true;
                }
            } catch (error) {
                this.isLoggedIn = false;
            }
            return false;
        },
        
        // 显示消息提示
        showMessage(message, type = 'info') {
            const alertClass = {
                success: 'alert-success',
                error: 'alert-danger', 
                warning: 'alert-warning',
                info: 'alert-info'
            }[type] || 'alert-info';
            
            // 移除现有提示
            document.querySelectorAll('.temp-alert').forEach(alert => alert.remove());
            
            const alertDiv = document.createElement('div');
            alertDiv.className = `alert ${alertClass} alert-dismissible fade show position-fixed temp-alert`;
            alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
            alertDiv.innerHTML = `${message}<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
            
            document.body.appendChild(alertDiv);
            setTimeout(() => alertDiv.remove(), 5000);
        },
        
        // 格式化金额
        formatMoney(amount) {
            if (amount == null) return '0.00';
            return Number(amount).toLocaleString('zh-TW', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        },
        
        // 格式化日期
        formatDate(dateString) {
            if (!dateString) return '';
            return new Date(dateString).toLocaleDateString('zh-TW');
        },
        
        // 设置活动标签页
        setActiveTab(tab) {
            this.activeTab = tab;
            // 根据标签页加载相应数据
            if (tab === 'agents') this.searchAgents();
            if (tab === 'members') this.searchMembers();
        },
        
        // 搜索代理
        async searchAgents() {
            try {
                const params = new URLSearchParams(this.agentFilters);
                const response = await axios.get(`${API_BASE_URL}/agents?${params}`);
                if (response.data.success) {
                    this.agents = response.data.agents || [];
                }
            } catch (error) {
                console.error('搜索代理失败:', error);
            }
        },
        
        // 搜索会员  
        async searchMembers() {
            try {
                const params = new URLSearchParams(this.memberFilters);
                const response = await axios.get(`${API_BASE_URL}/members?${params}`);
                if (response.data.success) {
                    this.members = response.data.members || [];
                }
            } catch (error) {
                console.error('搜索会员失败:', error);
            }
        },
        
        // 带权限检查的操作包装器
        adjustMemberBalance(member) {
            if (!this.checkAgentPermissions('会员余额调整')) return;
            // 实际的余额调整逻辑
            console.log('调整会员余额:', member);
        },
        
        createAgent() {
            if (!this.checkAgentPermissions('创建代理')) return;
            // 实际的创建代理逻辑
            console.log('创建代理');
        },
        
        createMember() {
            if (!this.checkAgentPermissions('创建会员')) return;
            // 实际的创建会员逻辑
            console.log('创建会员');
        },
        
        async deleteAgent(agentId, username) {
            if (!this.checkAgentPermissions('删除代理')) return;
            if (!confirm(`确定要删除代理 ${username} 吗？`)) return;
            // 实际的删除逻辑
            console.log('删除代理:', agentId);
        },
        
        async deleteMember(memberId, username) {
            if (!this.checkAgentPermissions('删除会员')) return;
            if (!confirm(`确定要删除会员 ${username} 吗？`)) return;
            // 实际的删除逻辑
            console.log('删除会员:', memberId);
        },
        
        resetAgentPassword(agent) {
            if (!this.checkAgentPermissions('重置代理密码')) return;
            console.log('重置代理密码:', agent);
        },
        
        resetMemberPassword(member) {
            if (!this.checkAgentPermissions('重置会员密码')) return;
            console.log('重置会员密码:', member);
        }
    }
});

// 挂载应用
try {
    app.mount('#app');
    console.log('Vue应用挂载成功');
} catch (error) {
    console.error('Vue应用挂载失败:', error);
    alert('应用初始化失败，请刷新页面重试');
}
