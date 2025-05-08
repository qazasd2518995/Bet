// filepath: /Users/justin/Desktop/Bet/agent/frontend/js/main.js
// 代理管理系統前端 JavaScript 檔案
// 最後更新：2025-05-08

// API 基礎 URL - 使用相對路徑
const API_BASE_URL = '/api/agent'; // 在所有環境中使用相對路徑

// Vue 應用實例
const app = new Vue({
    el: '#app',
    data: {
        // 身份驗證狀態
        isLoggedIn: false,
        loading: false,
        
        // 登入表單
        loginForm: {
            username: '',
            password: ''
        },
        
        // 用戶資訊
        user: {
            id: '',
            username: '',
            level: 0,
            balance: 0
        },
        
        // 系統公告
        notices: [],
        
        // 當前活動分頁
        activeTab: 'dashboard',
        
        // 儀表板數據
        dashboardData: {
            totalAgents: 0,
            totalMembers: 0,
            todayTransactions: 0,
            monthlyCommission: 0
        },
        
        // 圖表實例
        transactionChart: null,
        
        // 代理管理相關
        agents: [],
        agentFilters: {
            level: '-1',
            status: '-1',
            keyword: ''
        },
        agentPagination: {
            currentPage: 1,
            totalPages: 1,
            limit: 20
        },
        
        // 新增代理相關
        showCreateAgentModal: false,
        newAgent: {
            username: '',
            password: '',
            level: '1',
            parent: '',
            commission: 0.2
        },
        parentAgents: [],
        
        // 編輯代理相關
        showEditAgentModal: false,
        editAgentData: {
            id: '',
            username: '',
            password: '',
            commission: 0.2,
            status: 1
        },
        editAgentModal: null,
        
        // 會員管理相關
        members: [],
        memberFilters: {
            status: '-1',
            keyword: ''
        },
        memberPagination: {
            currentPage: 1,
            totalPages: 1,
            limit: 20
        },
        
        // 新增會員相關
        showCreateMemberModal: false,
        newMember: {
            username: '',
            password: '',
            confirmPassword: ''
        }
    },
    
    // 頁面載入時自動執行
    mounted() {
        // 檢查是否已登入
        this.checkAuth();
        
        // 如果已登入，獲取初始數據
        if (this.isLoggedIn) {
            this.fetchDashboardData();
            this.fetchNotices();
        }
        
        // 初始化模態框
        this.$nextTick(() => {
            this.initModals();
        });
    },
    
    methods: {
        // 初始化 Bootstrap 5 模態框
        initModals() {
            // 不需要在此處初始化模態框，因為當它們通過v-if被渲染時才應該被初始化
        },
        
        // 顯示創建代理模態框
        showAgentModal() {
            this.showCreateAgentModal = true;
            this.$nextTick(() => {
                // 確保模態框元素已經被渲染到DOM後再初始化和顯示
                const modalEl = document.getElementById('createAgentModal');
                if (modalEl) {
                    this.agentModal = new bootstrap.Modal(modalEl);
                    this.agentModal.show();
                    this.fetchParentAgents();
                } else {
                    console.error('找不到代理模態框元素');
                    this.showMessage('系統錯誤，請稍後再試', 'error');
                }
            });
        },
        
        // 隱藏創建代理模態框
        hideCreateAgentModal() {
            if (this.agentModal) {
                this.agentModal.hide();
            }
            this.showCreateAgentModal = false;
        },
        
        // 顯示創建會員模態框
        showMemberModal() {
            this.showCreateMemberModal = true;
            this.$nextTick(() => {
                // 確保模態框元素已經被渲染到DOM後再初始化和顯示
                const modalEl = document.getElementById('createMemberModal');
                if (modalEl) {
                    this.memberModal = new bootstrap.Modal(modalEl);
                    this.memberModal.show();
                } else {
                    console.error('找不到會員模態框元素');
                    this.showMessage('系統錯誤，請稍後再試', 'error');
                }
            });
        },
        
        // 隱藏創建會員模態框
        hideCreateMemberModal() {
            if (this.memberModal) {
                this.memberModal.hide();
            }
            this.showCreateMemberModal = false;
        },
        
        // 檢查身份驗證狀態
        checkAuth() {
            const token = localStorage.getItem('agent_token');
            const user = JSON.parse(localStorage.getItem('agent_user') || '{}');
            
            if (token && user.id) {
                this.isLoggedIn = true;
                this.user = user;
                
                // 設置 axios 身份驗證頭
                axios.defaults.headers.common['Authorization'] = token;
            }
        },
        
        // 登入方法
        async login() {
            if (!this.loginForm.username || !this.loginForm.password) {
                return this.showMessage('請輸入用戶名和密碼', 'error');
            }
            
            this.loading = true;
            
            try {
                const response = await axios.post(`${API_BASE_URL}/login`, this.loginForm);
                
                if (response.data.success) {
                    // 保存用戶資訊和 token
                    const { agent, token } = response.data;
                    localStorage.setItem('agent_token', token);
                    localStorage.setItem('agent_user', JSON.stringify(agent));
                    
                    // 設置 axios 身份驗證頭
                    axios.defaults.headers.common['Authorization'] = token;
                    
                    // 更新用戶資訊
                    this.user = agent;
                    this.isLoggedIn = true;
                    
                    // 獲取初始數據
                    this.fetchDashboardData();
                    this.fetchNotices();
                    
                    this.showMessage('登入成功', 'success');
                } else {
                    this.showMessage(response.data.message || '登入失敗', 'error');
                }
            } catch (error) {
                this.showMessage(error.response?.data?.message || '登入失敗，請稍後再試', 'error');
                console.error('登入錯誤:', error);
            } finally {
                this.loading = false;
            }
        },
        
        // 登出方法
        logout() {
            // 清除本地存儲
            localStorage.removeItem('agent_token');
            localStorage.removeItem('agent_user');
            
            // 重置狀態
            this.isLoggedIn = false;
            this.user = {
                id: '',
                username: '',
                level: 0,
                balance: 0
            };
            
            // 重置 axios 身份驗證頭
            delete axios.defaults.headers.common['Authorization'];
            
            this.showMessage('已成功登出', 'success');
        },
        
        // 獲取儀表板數據
        async fetchDashboardData() {
            try {
                // 嘗試從原始API獲取數據
                const response = await axios.get(`${API_BASE_URL}/stats`, {
                    params: { agentId: this.user.id }
                });
                
                if (response.data.success) {
                    const { stats } = response.data;
                    
                    this.dashboardData = {
                        totalAgents: this.user.level === 0 ? 10 : 0,  // 非總代理無下級代理
                        totalMembers: stats.totalMembers,
                        todayTransactions: stats.totalAmount,
                        monthlyCommission: stats.commission
                    };
                    
                    // 初始化交易圖表
                    this.$nextTick(() => {
                        this.initTransactionChart();
                    });
                }
            } catch (error) {
                console.error('獲取儀表板數據錯誤:', error);
                this.showMessage('獲取數據失敗，請確認代理ID是否正確', 'error');
            }
        },
        
        // 初始化交易趨勢圖表
        initTransactionChart() {
            const ctx = document.getElementById('transactionChart');
            if (!ctx) return;
            
            // 模擬數據 - 過去7天的交易數據
            const labels = Array(7).fill(0).map((_, i) => {
                const date = new Date();
                date.setDate(date.getDate() - (6 - i));
                return `${date.getMonth() + 1}/${date.getDate()}`;
            });
            
            const transactionData = [15000, 22000, 19500, 24000, 28000, 21000, 26500];
            const commissionData = transactionData.map(val => val * 0.05);
            
            if (this.transactionChart) {
                this.transactionChart.destroy();
            }
            
            this.transactionChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: '交易金額',
                            data: transactionData,
                            borderColor: 'rgba(54, 162, 235, 1)',
                            backgroundColor: 'rgba(54, 162, 235, 0.2)',
                            borderWidth: 2,
                            fill: true
                        },
                        {
                            label: '佣金',
                            data: commissionData,
                            borderColor: 'rgba(255, 159, 64, 1)',
                            backgroundColor: 'rgba(255, 159, 64, 0.2)',
                            borderWidth: 2,
                            fill: true
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        },
        
        // 獲取系統公告
        async fetchNotices() {
            try {
                const response = await axios.get(`${API_BASE_URL}/notices`);
                
                if (response.data.success) {
                    this.notices = response.data.notices;
                }
            } catch (error) {
                console.error('獲取系統公告錯誤:', error);
            }
        },
        
        // 搜尋代理
        async searchAgents() {
            this.agentPagination.currentPage = 1;
            await this.fetchAgents();
        },
        
        // 獲取代理列表
        async fetchAgents() {
            this.loading = true;
            
            try {
                const response = await axios.get(`${API_BASE_URL}/sub-agents`, {
                    params: {
                        parentId: this.user.level === 0 ? '' : this.user.id,
                        level: this.agentFilters.level,
                        status: this.agentFilters.status,
                        keyword: this.agentFilters.keyword,
                        page: this.agentPagination.currentPage,
                        limit: this.agentPagination.limit
                    }
                });
                
                if (response.data.success) {
                    this.agents = response.data.agents;
                    
                    // 計算總頁數
                    const total = response.data.total;
                    this.agentPagination.totalPages = Math.ceil(total / this.agentPagination.limit);
                }
            } catch (error) {
                console.error('獲取代理列表錯誤:', error);
                this.showMessage('獲取代理列表失敗', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 獲取可作為上級的代理列表
        async fetchParentAgents() {
            try {
                const response = await axios.get(`${API_BASE_URL}/sub-agents`, {
                    params: {
                        parentId: '',
                        level: parseInt(this.newAgent.level) - 1, // 只獲取上一級的代理
                        status: 1, // 只獲取啟用狀態的代理
                        page: 1,
                        limit: 100
                    }
                });
                
                if (response.data.success) {
                    this.parentAgents = response.data.agents;
                }
            } catch (error) {
                console.error('獲取上級代理列表錯誤:', error);
            }
        },
        
        // 創建新代理
        async createAgent() {
            if (!this.newAgent.username || !this.newAgent.password) {
                return this.showMessage('請輸入用戶名和密碼', 'error');
            }
            
            this.loading = true;
            
            try {
                const response = await axios.post(`${API_BASE_URL}/create`, this.newAgent);
                
                if (response.data.success) {
                    this.showMessage('創建代理成功', 'success');
                    this.hideCreateAgentModal();
                    
                    // 重置表單
                    this.newAgent = {
                        username: '',
                        password: '',
                        level: '1',
                        parent: '',
                        commission: 0.2
                    };
                    
                    // 重新獲取代理列表
                    await this.fetchAgents();
                } else {
                    this.showMessage(response.data.message || '創建代理失敗', 'error');
                }
            } catch (error) {
                this.showMessage(error.response?.data?.message || '創建代理失敗', 'error');
                console.error('創建代理錯誤:', error);
            } finally {
                this.loading = false;
            }
        },
        
        // 查看代理詳細資訊
        async viewAgentDetails(agent) {
            // 實現代理詳細資訊查看邏輯
            console.log('查看代理詳細資訊:', agent);
        },
        
        // 編輯代理
        async editAgent(agent) {
            console.log('編輯代理:', agent);
            
            // 初始化編輯資料
            this.editAgentData = {
                id: agent.id,
                username: agent.username,
                password: '', // 留空表示不修改
                commission: agent.commission_rate || 0.2,
                status: agent.status
            };
            
            this.showEditAgentModal = true;
            this.$nextTick(() => {
                // 確保模態框已經存在才顯示
                if (document.getElementById('editAgentModal')) {
                    this.editAgentModal = new bootstrap.Modal(document.getElementById('editAgentModal'));
                    this.editAgentModal.show();
                } else {
                    console.error('找不到編輯代理模態框元素');
                }
            });
        },
        
        // 更新代理資訊
        async updateAgent() {
            if (!this.editAgentData.id) {
                return this.showMessage('缺少代理ID', 'error');
            }
            
            this.loading = true;
            
            try {
                // 使用update-status API更新代理資訊(暫時替代方案)
                // 待後端實現專門的更新API
                const url = `${API_BASE_URL}/update-status`;
                
                const response = await axios.put(url, {
                    id: this.editAgentData.id,
                    status: this.editAgentData.status
                });
                
                if (response.data.success) {
                    this.showMessage('更新代理狀態成功', 'success');
                    
                    // 關閉模態框
                    if (this.editAgentModal) {
                        this.editAgentModal.hide();
                    }
                    this.showEditAgentModal = false;
                    
                    // 重新獲取代理列表
                    await this.fetchAgents();
                } else {
                    this.showMessage(response.data.message || '更新代理資訊失敗', 'error');
                }
            } catch (error) {
                console.error('更新代理錯誤:', error);
                this.showMessage(error.response?.data?.message || '更新代理資訊失敗', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 隱藏編輯代理模態框
        hideEditAgentModal() {
            if (this.editAgentModal) {
                this.editAgentModal.hide();
            }
            this.showEditAgentModal = false;
        },
        
        // 切換代理狀態
        async toggleAgentStatus(agent) {
            const newStatus = agent.status === 1 ? 0 : 1;
            const statusText = newStatus === 1 ? '啟用' : '停用';
            
            if (!confirm(`確定要${statusText}代理 ${agent.username} 嗎？`)) {
                return;
            }
            
            try {
                const response = await axios.put(`${API_BASE_URL}/update-status`, {
                    id: agent.id,
                    status: newStatus
                });
                
                if (response.data.success) {
                    agent.status = newStatus;
                    this.showMessage(`已成功${statusText}代理`, 'success');
                } else {
                    this.showMessage(response.data.message || `${statusText}代理失敗`, 'error');
                }
            } catch (error) {
                this.showMessage(`${statusText}代理失敗`, 'error');
                console.error('切換代理狀態錯誤:', error);
            }
        },
        
        // 搜尋會員
        async searchMembers() {
            this.memberPagination.currentPage = 1;
            await this.fetchMembers();
        },
        
        // 獲取會員列表
        async fetchMembers() {
            this.loading = true;
            
            try {
                const response = await axios.get(`${API_BASE_URL}/members`, {
                    params: {
                        agentId: this.user.id,
                        status: this.memberFilters.status,
                        keyword: this.memberFilters.keyword,
                        page: this.memberPagination.currentPage,
                        limit: this.memberPagination.limit
                    }
                });
                
                if (response.data.success) {
                    this.members = response.data.members;
                    
                    // 計算總頁數
                    const total = response.data.total;
                    this.memberPagination.totalPages = Math.ceil(total / this.memberPagination.limit);
                }
            } catch (error) {
                console.error('獲取會員列表錯誤:', error);
                this.showMessage('獲取會員列表失敗', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 創建新會員
        async createMember() {
            if (!this.newMember.username || !this.newMember.password) {
                return this.showMessage('請輸入用戶名和密碼', 'error');
            }
            
            if (this.newMember.password !== this.newMember.confirmPassword) {
                return this.showMessage('兩次輸入的密碼不一致', 'error');
            }
            
            this.loading = true;
            
            try {
                const memberData = {
                    username: this.newMember.username,
                    password: this.newMember.password,
                    agentId: this.user.id
                };
                
                const response = await axios.post(`${API_BASE_URL}/create-member`, memberData);
                
                if (response.data.success) {
                    this.showMessage('創建會員成功', 'success');
                    this.hideCreateMemberModal();
                    
                    // 重置表單
                    this.newMember = {
                        username: '',
                        password: '',
                        confirmPassword: ''
                    };
                    
                    // 重新獲取會員列表
                    await this.fetchMembers();
                } else {
                    this.showMessage(response.data.message || '創建會員失敗', 'error');
                }
            } catch (error) {
                this.showMessage(error.response?.data?.message || '創建會員失敗', 'error');
                console.error('創建會員錯誤:', error);
            } finally {
                this.loading = false;
            }
        },
        
        // 查看會員詳細資訊
        async viewMemberDetails(member) {
            // 實現會員詳細資訊查看邏輯
            console.log('查看會員詳細資訊:', member);
            
            try {
                const response = await axios.get(`${API_BASE_URL}/member-info`, {
                    params: { id: member.id }
                });
                
                if (response.data.success) {
                    // 顯示會員詳細資訊的實現，可以使用模態框等方式
                    alert(`會員ID: ${member.id}\n用戶名: ${member.username}\n餘額: ${this.formatMoney(member.balance)}\n創建時間: ${this.formatDate(member.createdAt)}`);
                } else {
                    this.showMessage(response.data.message || '獲取會員資訊失敗', 'error');
                }
            } catch (error) {
                this.showMessage('獲取會員資訊失敗', 'error');
                console.error('獲取會員資訊錯誤:', error);
            }
        },
        
        // 編輯會員
        async editMember(member) {
            // 實現會員編輯邏輯
            console.log('編輯會員:', member);
            alert('會員編輯功能待實現');
        },
        
        // 切換會員狀態
        async toggleMemberStatus(member) {
            const newStatus = member.status === 1 ? 0 : 1;
            const statusText = newStatus === 1 ? '啟用' : '停用';
            
            if (!confirm(`確定要${statusText}會員 ${member.username} 嗎？`)) {
                return;
            }
            
            try {
                const response = await axios.put(`${API_BASE_URL}/update-member-status`, {
                    id: member.id,
                    status: newStatus
                });
                
                if (response.data.success) {
                    member.status = newStatus;
                    this.showMessage(`已成功${statusText}會員`, 'success');
                } else {
                    this.showMessage(response.data.message || `${statusText}會員失敗`, 'error');
                }
            } catch (error) {
                this.showMessage(`${statusText}會員失敗`, 'error');
                console.error('切換會員狀態錯誤:', error);
            }
        },
        
        // 分頁切換
        async changePage(page, type) {
            if (type === 'agents') {
                if (page < 1 || page > this.agentPagination.totalPages) {
                    return;
                }
                
                this.agentPagination.currentPage = page;
                await this.fetchAgents();
            } else if (type === 'members') {
                if (page < 1 || page > this.memberPagination.totalPages) {
                    return;
                }
                
                this.memberPagination.currentPage = page;
                await this.fetchMembers();
            }
        },
        
        // 格式化金額
        formatMoney(amount) {
            return new Intl.NumberFormat('zh-TW', {
                style: 'decimal',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(amount);
        },
        
        // 格式化日期
        formatDate(dateString) {
            const date = new Date(dateString);
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        },
        
        // 獲取代理級別名稱
        getLevelName(level) {
            const levelMap = {
                0: '總代理',
                1: '一級代理',
                2: '二級代理'
            };
            return levelMap[level] || '未知';
        },
        
        // 顯示訊息
        showMessage(message, type = 'info') {
            // 可根據項目需求使用 alert、toast 或自定義訊息組件
            if (type === 'error') {
                alert(`錯誤: ${message}`);
            } else if (type === 'success') {
                alert(`成功: ${message}`);
            } else {
                alert(message);
            }
        }
    },
    
    // 計算屬性
    computed: {
        // 可根據需求添加更多計算屬性
    },
    
    // 監聽屬性
    watch: {
        // 當活動分頁變更時，加載對應數據
        activeTab(newTab, oldTab) {
            if (newTab === 'agents' && (oldTab !== 'agents' || this.agents.length === 0)) {
                this.fetchAgents();
            } else if (newTab === 'dashboard' && oldTab !== 'dashboard') {
                this.fetchDashboardData();
            } else if (newTab === 'notices' && (oldTab !== 'notices' || this.notices.length === 0)) {
                this.fetchNotices();
            } else if (newTab === 'members' && (oldTab !== 'members' || this.members.length === 0)) {
                this.fetchMembers();
            }
        }
    }
});
