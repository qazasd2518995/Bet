// filepath: /Users/justin/Desktop/Bet/agent/frontend/js/main.js
// 代理管理系统前端 JavaScript 档案
// 最后更新：2025-05-10

// API 基礎 URL - 根据环境调整
let API_BASE_URL;

if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // 本地开发环境 - 代理系统运行在3003端口
    API_BASE_URL = 'http://localhost:3003/api/agent';
} else {
    // Render 生产环境 - 不使用端口号，让Render处理路由
    API_BASE_URL = 'https://bet-agent.onrender.com/api/agent';
}

// 添加调试信息
console.log('当前API基礎URL:', API_BASE_URL, '主機名:', window.location.hostname);

// API请求通用配置
const API_CONFIG = {
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
};

console.log('开始初始化Vue应用');
console.log('Vue是否可用:', typeof Vue);

if (typeof Vue === 'undefined') {
    console.error('Vue未定义！请检查Vue腳本是否正确加载。');
    alert('Vue未定义！请检查Vue腳本是否正确加载。');
    throw new Error('Vue未定义');
}

const { createApp } = Vue;
console.log('createApp是否可用:', typeof createApp);

const app = createApp({
    data() {
        return {
            // 將API_BASE_URL添加到Vue實例的data中，使模板可以访问
            API_BASE_URL: API_BASE_URL,
            
            // 身份验证状态
            isLoggedIn: false,
            loading: false,
            
            // 登录表單
            loginForm: {
                username: '',
                password: ''
            },
            
            // 用戶资讯
            user: {
                id: null,
                username: '',
                level: 0,
                balance: 0
            },
            
            // 系统公告
            notices: [],
            noticeCategories: [],
            selectedNoticeCategory: 'all',
            
            // 公告表單相关
            showNoticeForm: false,
            editingNoticeId: null,
            noticeForm: {
                title: '',
                content: '',
                category: '最新公告'
            },
            
            // 当前活動分页
            activeTab: 'dashboard',
            transactionTab: 'transfers',
            customerServiceTab: 'transactions', // 客服功能標籤页：'transactions' 或 'win-loss-control'
            
            // 儀表板数据
            dashboardData: {
                totalDeposit: 0,
                totalWithdraw: 0,
                totalRevenue: 0,
                totalTransactions: 0,
                memberCount: 0,
                activeMembers: 0,
                subAgentsCount: 0
            },
            
            // 图表實例
            transactionChart: null,
            
            // 代理管理相关
            agents: [],
            agentFilters: {
                level: '-1',
                status: '-1', // 显示所有状态（物理删除後不会有已删除项目）
                keyword: ''
            },
            agentPagination: {
                currentPage: 1,
                totalPages: 1,
                limit: 20
            },
            
            // 新增代理相关
            showCreateAgentModal: false,
            newAgent: {
                username: '',
                password: '',
                level: '1',
                parent: '',
                market_type: 'D', // 默认D盤
                rebate_mode: 'percentage',
                rebate_percentage: 2.0, // 將在showAgentModal中根据盤口動態设定
                notes: ''
            },
            parentAgents: [],
            
            // 代理层级導航相关
            agentBreadcrumbs: [],
            currentManagingAgent: {
                id: null,
                username: '',
                level: 0,
                max_rebate_percentage: 0.041
            },
            
            // 退水设定相关
            showRebateModal: false,
            rebateAgent: {
                id: null,
                username: '',
                rebate_mode: '',
                rebate_percentage: 0,
                max_rebate_percentage: 0
            },
            rebateSettings: {
                rebate_mode: '',
                rebate_percentage: 0
            },
            
            // 编辑代理相关
            showEditAgentModal: false,
            editAgentData: {
                id: '',
                username: '',
                password: '',
                status: 1
            },
            editAgentModal: null,
            editAgentNotesModal: null,
            
            // 编辑备注相关
            showEditAgentNotesModal: false,
            showEditMemberNotesModal: false,
            
            // 显示限红调整模態框
            showBettingLimitModal: false,
            editNotesData: {
                id: null,
                username: '',
                notes: '',
                type: '' // 'agent' 或 'member'
            },
            
            // 会员管理相关
            members: [],
            memberFilters: {
                status: '-1', // 显示所有状态（物理删除後不会有已删除项目）
                keyword: ''
            },
            memberPagination: {
                currentPage: 1,
                totalPages: 1,
                limit: 20
            },
            memberViewMode: 'direct', // 'direct' 或 'downline'
            
            // 层级会员管理相关
            hierarchicalMembers: [], // 統一的代理+会员列表
            memberBreadcrumb: [], // 会员管理導航面包屑
            memberHierarchyStats: {
                agentCount: 0,
                memberCount: 0
            },
            currentMemberManagingAgent: {
                id: null,
                username: '',
                level: 0
            },
            
            // 新增会员相关
            showCreateMemberModal: false,
            modalSystemReady: false, // 模態框系统是否准备就緒
            newMember: {
                username: '',
                password: '',
                confirmPassword: '',
                balance: 0,
                status: 1,
                notes: '',
                market_type: 'D' // 默认繼承代理盤口
            },
            

            
            // 会员余额调整相关
            showAdjustBalanceModal: false,
            balanceAdjustData: {
                memberId: null,
                memberUsername: '',
                agentId: null,
                currentBalance: 0,
                amount: 0,
                description: ''
            },

            // 报表查询相关
            reportFilters: {
                startDate: new Date().toISOString().split('T')[0], // 今日
                endDate: new Date().toISOString().split('T')[0],   // 今日
                gameTypes: {
                    pk10: true  // 只支援FS金彩赛车
                },
                settlementStatus: '', // 'settled', 'unsettled', ''(全部)
                username: ''
            },
            reportData: {
                success: true,
                reportData: [],
                totalSummary: {
                    betCount: 0,
                    betAmount: 0.0,
                    validAmount: 0.0,
                    memberWinLoss: 0.0,
                    ninthAgentWinLoss: 0.0,
                    upperDelivery: 0.0,
                    upperSettlement: 0.0,
                    rebate: 0.0,
                    profitLoss: 0.0,
                    downlineReceivable: 0.0,
                    commission: 0.0,
                    commissionAmount: 0.0,
                    commissionResult: 0.0,
                    actualRebate: 0.0,
                    rebateProfit: 0.0,
                    finalProfitLoss: 0.0
                },
                hasData: false,
                message: ''
            },
            
            // 报表层级追蹤
            reportBreadcrumb: [],

            // 登录日誌相关
            loginLogs: [],
            loginLogFilters: {
                startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7天前
                endDate: new Date().toISOString().split('T')[0] // 今日
            },
            loginLogPagination: {
                currentPage: 1,
                totalPages: 1,
                limit: 20
            },
            transferType: 'deposit',
            transferAmount: 0,
            agentCurrentBalance: 0,
            adjustBalanceModal: null,
            
            // 点数转移记录
            pointTransfers: [],
            
            // 退水记录相关
            rebateRecords: [],
            rebateFilters: {
                member: '',
                date: ''
            },
            totalRebateAmount: 0,
            
            // 开奖记录相关
            drawRecords: [],
            drawFilters: {
                period: '',
                date: ''
            },
            drawPagination: {
                currentPage: 1,
                totalPages: 1,
                limit: 20
            },
            
            // 添加下注记录相关
            bets: [],
            betFilters: {
                member: '',
                date: '',
                startDate: '',
                endDate: '',
                period: '',
                viewScope: 'own', // 'own', 'downline', 'specific'
                specificAgent: ''
            },
            betPagination: {
                currentPage: 1,
                totalPages: 1,
                limit: 20
            },
            betStats: {
                totalBets: 0,
                totalAmount: 0,
                totalProfit: 0
            },
            
            // 代理線管理相关
            allDownlineAgents: [], // 所有下級代理
            availableMembers: [], // 当前可用的会员列表
            
            // 会员余额修改相关
            modifyBalanceData: {
                memberId: null,
                memberUsername: '',
                currentBalance: 0,
                reason: ''
            },
            modifyBalanceType: 'absolute', // 'absolute' 或 'relative'
            modifyBalanceAmount: 0,
            balanceChangeDirection: 'increase', // 'increase' 或 'decrease'
            modifyMemberBalanceModal: null,
            
            // 代理余额修改相关
            agentBalanceData: {
                agentId: null,
                agentUsername: '',
                currentBalance: 0,
                reason: '',
                description: '' // 新增: 点数转移备注
            },
            agentModifyType: 'absolute', // 'absolute' 或 'relative'
            agentModifyAmount: 0,
            agentChangeDirection: 'increase', // 'increase' 或 'decrease'
            adjustAgentBalanceModal: null,
            
            // 新增: 代理点数转移相关變量
            agentTransferType: 'deposit', // 'deposit' 或 'withdraw'
            agentTransferAmount: 0,

            // 客服專用数据
            isCustomerService: false, // 是否为客服 - 根据用戶权限動態设定
            showCSOperationModal: false, // 客服操作模態框
            csOperation: {
                targetAgentId: '',
                operationTarget: '', // 'agent' 或 'member'
                targetMemberId: '',
                transferType: '', // 'deposit' 或 'withdraw'
                amount: '',
                description: ''
            },
            csTransactions: [], // 客服交易记录
            csTransactionFilters: {
                userType: 'all',
                transactionType: 'all'
            },
            csTransactionsPagination: {
                page: 1,
                limit: 20,
                total: 0
            },
            allAgents: [], // 所有代理列表（供客服选择）
            
            // 输赢控制相关
            winLossControls: [],
            activeWinLossControl: {
                control_mode: 'normal',
                is_active: false
            },
            newWinLossControl: {
                control_mode: 'normal',
                target_type: '',
                target_username: '',
                control_percentage: 50,
                win_control: false,
                loss_control: false,
                start_period: null
            },
            agentMembers: [], // 选中代理的会员列表
            csOperationModal: null, // 客服操作模態框
            
            // 存款记录
            depositRecords: [],
            depositPagination: {
                page: 1,
                limit: 20,
                total: 0
            },
            
            // 提款记录
            withdrawRecords: [],
            withdrawPagination: {
                page: 1,
                limit: 20,
                total: 0
            },
            
            // 重设密码数据
            resetPasswordData: {
                userType: '', // 'agent' 或 'member'
                userId: null,
                username: '',
                newPassword: '',
                confirmPassword: ''
            },
            
            // 调整限红数据
            bettingLimitData: {
                loading: false,
                submitting: false,
                member: {
                    id: null,
                    username: '',
                    bettingLimitLevel: '',
                    levelDisplayName: '',
                    description: ''
                },
                configs: [],
                newLimitLevel: '',
                reason: ''
            },
            
            // 个人资料数据
            profileData: {
                realName: '',
                phone: '',
                email: '',
                lineId: '',
                telegram: '',
                address: '',
                remark: ''
            },
            
            // 显示用的用戶信息
            displayUsername: '载入中...',
            displayUserLevel: '载入中...',
            // 个人资料储存專用载入状态
            profileLoading: false,
            // 控制个人资料 modal 显示
            isProfileModalVisible: false,

            // 会员余额调整相关
            memberBalanceData: {
                memberId: null,
                memberUsername: '',
                currentBalance: 0,
                description: ''
            },
            memberTransferType: 'deposit',
            memberTransferAmount: 0,
            adjustMemberBalanceModal: null,
            
            // 输赢控制用戶清单
            availableAgents: [],
            availableMembers: [],
            currentPeriodInfo: {
                current_period: 0,
                next_period: 0,
                suggested_start: 0
            },
        };
    },
    
    // 页面载入时自動执行
    async mounted() {
        console.log('Vue应用已掛载');
        
        // 强制确保所有模態框初始状态为关闭，防止登录前意外显示
        this.showCreateMemberModal = false;
        this.showCreateAgentModal = false;
        this.isProfileModalVisible = false;
        this.showCSOperationModal = false;
        this.showAdjustBalanceModal = false;
        console.log('🔒 所有模態框状态已重置为关闭');
        
        // 添加全域保护机制：監聽所有模態框状态變化
        this.$watch('showCreateMemberModal', (newVal) => {
            if (newVal && (!this.isLoggedIn || !this.user || !this.user.id)) {
                console.warn('🚫 阻止未登录状态显示新增会员模態框');
                this.$nextTick(() => {
                    this.showCreateMemberModal = false;
                });
            }
        });
        
        this.$watch('isProfileModalVisible', (newVal) => {
            if (newVal && (!this.isLoggedIn || !this.user || !this.user.id)) {
                console.warn('🚫 阻止未登录状态显示个人资料模態框');
                this.$nextTick(() => {
                    this.isProfileModalVisible = false;
                });
            }
        });
        
        console.log('初始数据检查:', {
            noticeForm: this.noticeForm,
            showNoticeForm: this.showNoticeForm,
            isCustomerService: this.isCustomerService
        });
        
        // 测试模板插值功能
        this.$nextTick(() => {
            console.log('nextTick 检查模板数据:', {
                'noticeForm.title': this.noticeForm.title,
                'noticeForm.title.length': this.noticeForm.title.length,
                'noticeForm.content.length': this.noticeForm.content.length
            });
        });
        
        // 先检查会话有效性，如果会话无效則清除本地存儲
        const sessionValid = await this.checkSession();
        
        if (!sessionValid) {
            // 会话无效，清除本地存儲
            localStorage.removeItem('agent_token');
            localStorage.removeItem('agent_user');
            localStorage.removeItem('agent_session_token');
            console.log('会话无效，已清除本地存儲');
        }
        
        // 检查是否已登录
        const isAuthenticated = await this.checkAuth();
        
        if (isAuthenticated && sessionValid) {
            console.log('用戶已认证，开始加载初始数据');
            // 检查是否为客服
            this.isCustomerService = this.user.level === 0;
            console.log('是否为客服:', this.isCustomerService);
            
            // 如果是客服，加载所有代理列表
            if (this.isCustomerService) {
                await this.loadAllAgents();
            }
            
            // 获取初始数据
            await Promise.all([
                this.fetchDashboardData(),
                this.fetchNotices()
            ]);
            
            // 获取代理現有的点数余额
            console.log('嘗試获取代理余额，代理ID:', this.user.id);
            try {
                // 修改API路徑格式，使其与後端一致
                const response = await axios.get(`${API_BASE_URL}/agent-balance?agentId=${this.user.id}`);
                if (response.data.success) {
                    console.log('代理当前额度:', response.data.balance);
                    this.user.balance = response.data.balance;
                }
            } catch (error) {
                console.error('获取代理额度错误:', error);
                // 遇到错误时嘗試備用API格式
                try {
                    console.log('嘗試備用API路徑获取代理余额');
                    const fallbackResponse = await axios.get(`${API_BASE_URL}/agent/${this.user.id}`);
                    if (fallbackResponse.data.success) {
                        console.log('備用API路徑获取代理额度成功:', fallbackResponse.data.agent?.balance);
                        this.user.balance = fallbackResponse.data.agent?.balance || 0;
                    }
                } catch (fallbackError) {
                    console.error('備用API路徑获取代理额度也失败:', fallbackError);
                }
            }
        } else {
            console.log('用戶未认证，显示登录表單');
        }
        
        // 初始化模態框
        this.$nextTick(() => {
            this.initModals();
            
            // 延迟启用模態框系统，确保所有組件都已初始化
            setTimeout(() => {
                this.modalSystemReady = true;
                console.log('🔓 模態框系统已启用');
            }, 1000); // 延迟1秒确保一切就緒
        });
    },
    
    methods: {
        // 初始化 Bootstrap 5 模態框
        initModals() {
            console.log('初始化所有模態框');
            
            // 初始化创建代理模態框
            const createAgentModalEl = document.getElementById('createAgentModal');
            if (createAgentModalEl) {
                console.log('初始化创建代理模態框');
                this.agentModal = new bootstrap.Modal(createAgentModalEl);
            }
            
            // 初始化创建会员模態框
            const createMemberModalEl = document.getElementById('createMemberModal');
            if (createMemberModalEl) {
                console.log('初始化创建会员模態框');
                this.memberModal = new bootstrap.Modal(createMemberModalEl);
            }
            
            // 初始化会员余额调整模態框
            const adjustBalanceModalEl = document.getElementById('adjustBalanceModal');
            if (adjustBalanceModalEl) {
                console.log('初始化会员余额调整模態框');
                this.adjustBalanceModal = new bootstrap.Modal(adjustBalanceModalEl);
            }
            
            // 初始化代理余额调整模態框
            const adjustAgentBalanceModalEl = document.getElementById('adjustAgentBalanceModal');
            if (adjustAgentBalanceModalEl) {
                console.log('初始化代理余额调整模態框');
                this.adjustAgentBalanceModal = new bootstrap.Modal(adjustAgentBalanceModalEl);
            }
            
            // 初始化修改会员余额模態框
            const modifyMemberBalanceModalEl = document.getElementById('modifyMemberBalanceModal');
            if (modifyMemberBalanceModalEl) {
                console.log('初始化修改会员余额模態框');
                this.modifyMemberBalanceModal = new bootstrap.Modal(modifyMemberBalanceModalEl);
            }
            
            // 初始化会员点數转移模態框
            const adjustMemberBalanceModalEl = document.getElementById('adjustMemberBalanceModal');
            if (adjustMemberBalanceModalEl) {
                console.log('初始化会员点數转移模態框');
                this.adjustMemberBalanceModal = new bootstrap.Modal(adjustMemberBalanceModalEl);
            }
            
            // 初始化客服操作模態框
            const csOperationModalEl = document.getElementById('csOperationModal');
            if (csOperationModalEl) {
                console.log('初始化客服操作模態框');
                this.csOperationModal = new bootstrap.Modal(csOperationModalEl);
                
                // 監聽模態框隐藏事件，重置表單
                csOperationModalEl.addEventListener('hidden.bs.modal', () => {
                    this.hideCSOperationModal();
                });
            }
            
            // 初始化代理备注编辑模態框
            const editAgentNotesModalEl = document.getElementById('editAgentNotesModal');
            if (editAgentNotesModalEl) {
                console.log('初始化代理备注编辑模態框');
                this.editAgentNotesModal = new bootstrap.Modal(editAgentNotesModalEl);
            }
        },
        
        // 显示创建代理模態框
        showAgentModal() {
            this.showCreateAgentModal = true;
            
            // 确定盤口类型和选择权限：
            // 1. 如果是总代理且为自己创建代理(level 0 -> level 1)，可自由选择
            // 2. 如果是总代理但在代理管理界面为下級代理创建代理，要遵守下級代理的盤口类型
            // 3. 其他情况都固定繼承
            let marketType = 'D'; // 默认D盤
            let canChooseMarket = false;
            
            if (this.user.level === 0 && this.currentManagingAgent.id === this.user.id) {
                // 总代理为自己创建一級代理，可自由选择
                canChooseMarket = true;
                marketType = 'D'; // 预設D盤
            } else {
                // 其他情况：固定繼承当前管理代理的盤口类型
                canChooseMarket = false;
                marketType = this.currentManagingAgent.market_type || 'D';
            }
            
            // 根据当前管理代理级别，设置默认的下級代理级别
            // 根据盤口类型设定合适的默认退水比例
            const defaultRebatePercentage = marketType === 'A' ? 0.5 : 2.0; // A盤用0.5%，D盤用2.0%
            
            this.newAgent = {
                username: '',
                password: '',
                level: (this.currentManagingAgent.level + 1).toString(),
                parent: this.currentManagingAgent.id,
                market_type: marketType,  // 设置盤口繼承
                rebate_mode: 'percentage',
                rebate_percentage: defaultRebatePercentage,
                notes: ''
            };
            
            console.log('🔧 创建代理模態框设定:', {
                currentUserLevel: this.user.level,
                currentManagingAgentLevel: this.currentManagingAgent.level,
                currentManagingAgentMarketType: this.currentManagingAgent.market_type,
                isCreatingForSelf: this.currentManagingAgent.id === this.user.id,
                marketType: marketType,
                canChooseMarket: canChooseMarket
            });
            
            this.$nextTick(() => {
                // 确保模態框元素已经被渲染到DOM後再初始化和显示
                const modalEl = document.getElementById('createAgentModal');
                if (modalEl) {
                    this.agentModal = new bootstrap.Modal(modalEl);
                    this.agentModal.show();
                } else {
                    console.error('找不到代理模態框元素');
                    this.showMessage('系统错误，请稍後再試', 'error');
                }
            });
        },
        
        // 隐藏创建代理模態框
        hideCreateAgentModal() {
            if (this.agentModal) {
                this.agentModal.hide();
            }
            this.showCreateAgentModal = false;
        },
        
        // 显示新增会员模態框 - 重定向到统一函數
        showMemberModal() {
            console.log('showMemberModal 已棄用，重定向到 quickCreateMember');
            this.quickCreateMember();
        },
        
        // 快速新增会员 - 專为会员管理页面和下級代理管理设计
        quickCreateMember() {
            // 安全检查：确保已登录且有用戶资讯
            if (!this.isLoggedIn || !this.user || !this.user.id) {
                console.warn('⚠️ 未登录或用戶资讯不完整，無法新增会员');
                return;
            }
            
            console.log('🚀 快速新增会员啟動');
            console.log('当前状态:');
            console.log('- activeTab:', this.activeTab);
            console.log('- currentManagingAgent:', this.currentManagingAgent);
            console.log('- agentBreadcrumbs:', this.agentBreadcrumbs);
            console.log('- user:', this.user);
            
            // 重置表單
            this.newMember = { 
                username: '', 
                password: '', 
                confirmPassword: '',
                balance: 0,
                status: 1,
                notes: ''
            };
            
            // 根据当前页面和状态确定管理代理
            let targetAgent = null;
            
            if (this.activeTab === 'agents' && this.agentBreadcrumbs.length > 0) {
                // 在下級代理管理页面，为当前查看的代理新增会员
                targetAgent = this.currentManagingAgent;
                console.log('📋 下級代理管理模式：为代理', targetAgent?.username, '新增会员');
            } else if (this.activeTab === 'members') {
                // 在会员管理页面，为自己新增会员
                const defaultMaxRebate = this.user.market_type === 'A' ? 0.011 : 0.041;
                targetAgent = {
                    id: this.user.id,
                    username: this.user.username,
                    level: this.user.level,
                    max_rebate_percentage: this.user.max_rebate_percentage || defaultMaxRebate
                };
                console.log('👤 会员管理模式：为自己新增会员');
            } else {
                // 预設情况：为自己新增会员
                const defaultMaxRebate = this.user.market_type === 'A' ? 0.011 : 0.041;
                targetAgent = {
                    id: this.user.id,
                    username: this.user.username,
                    level: this.user.level,
                    max_rebate_percentage: this.user.max_rebate_percentage || defaultMaxRebate
                };
                console.log('🔄 预設模式：为自己新增会员');
            }
            
            if (!targetAgent || !targetAgent.id) {
                console.error('❌ 無法确定目标代理');
                this.showMessage('無法确定代理信息，请重新整理页面', 'error');
                return;
            }
            
            // 设置当前管理代理
            this.currentManagingAgent = targetAgent;
            console.log('✅ 设置目标代理:', this.currentManagingAgent);
            
            // 簡化模態框显示逻辑，只设置Vue状态
            this.showCreateMemberModal = true;
            console.log('✅ 新增会员模態框已设置为显示');
        },
        
        // 隐藏创建会员模態框 - 簡化版本
        hideCreateMemberModal() {
            console.log('🚫 关闭新增会员模態框');
            
            // 设置Vue响应式状态
            this.showCreateMemberModal = false;
            
            // 重置表單数据
            this.newMember = { 
                username: '', 
                password: '', 
                confirmPassword: '',
                balance: 0,
                status: 1,
                notes: ''
            };
            
            console.log('✅ 模態框已关闭，数据已重置');
        },
        

        
        // 设置活動標籤並关闭漢堡选單
        setActiveTab(tab) {
            console.log('🔄 切換页籤到:', tab);
            
            // 如果不是在代理管理页面，重置当前管理代理为自己
            if (tab !== 'agents') {
                if (this.currentManagingAgent.id !== this.user.id) {
                    console.log('📍 重置管理視角：從', this.currentManagingAgent.username, '回到', this.user.username);
                    const defaultMaxRebate = this.user.market_type === 'A' ? 0.011 : 0.041;
                    this.currentManagingAgent = {
                        id: this.user.id,
                        username: this.user.username,
                        level: this.user.level,
                        market_type: this.user.market_type,
                        rebate_percentage: this.user.rebate_percentage || this.user.max_rebate_percentage || defaultMaxRebate,
                        max_rebate_percentage: this.user.max_rebate_percentage || defaultMaxRebate
                    };
                    
                    // 清空代理導航面包屑
                    this.agentBreadcrumbs = [];
                    
                    // 如果切換到会员管理或下注记录，重新载入相关数据
                    if (tab === 'members') {
                        // 初始化层级会员管理
                        this.currentMemberManagingAgent = {
                            id: this.currentManagingAgent.id,
                            username: this.currentManagingAgent.username,
                            level: this.currentManagingAgent.level
                        };
                        this.memberBreadcrumb = [];
                        this.loadHierarchicalMembers();
                    } else if (tab === 'bets') {
                        this.searchBets();
                    }
                }
            }
            
            this.activeTab = tab;
            
            // 关闭Bootstrap漢堡选單
            const navbarCollapse = document.getElementById('navbarNav');
            if (navbarCollapse && navbarCollapse.classList.contains('show')) {
                const bsCollapse = new bootstrap.Collapse(navbarCollapse, {
                    toggle: false
                });
                bsCollapse.hide();
            }
        },
        
        // 检查会话状态
        async checkSession() {
            try {
                const sessionToken = localStorage.getItem('agent_session_token');
                const legacyToken = localStorage.getItem('agent_token');
                
                if (!sessionToken && !legacyToken) {
                    console.log('沒有会话凭证');
                    return false;
                }
                
                const headers = {};
                if (sessionToken) {
                    headers['X-Session-Token'] = sessionToken;
                }
                if (legacyToken) {
                    headers['Authorization'] = legacyToken;
                }
                
                const response = await axios.get(`${API_BASE_URL}/check-session`, { headers });
                
                if (response.data.success && response.data.isAuthenticated) {
                    return true;
                } else if (response.data.reason === 'session_invalid') {
                    console.warn('⚠️ 检测到代理会话已失效，可能在其他装置登录');
                    if (confirm('您的账号已在其他装置登录，请重新登录。')) {
                        this.logout();
                        return false;
                    }
                }
                
                return false;
            } catch (error) {
                console.error('会话检查失败:', error);
                return false;
            }
        },
        
        // 检查身份验证状态
        async checkAuth() {
            const token = localStorage.getItem('agent_token');
            const userStr = localStorage.getItem('agent_user');
            console.log('检查认证，localStorage中的user字符串:', userStr);
            
            if (!userStr || !token) {
                console.log('认证失败，缺少token或user数据');
                return false;
            }
            
            try {
                const user = JSON.parse(userStr);
                console.log('解析後的user对象:', user);
                
                if (user && user.id) {
                    this.isLoggedIn = true;
                    this.user = user;
                    console.log('设置user对象成功:', this.user);
                    
                    // 初始化当前管理代理为自己
                    this.currentManagingAgent = {
                        id: this.user.id,
                        username: this.user.username,
                        level: this.user.level,
                        market_type: this.user.market_type,
                        rebate_percentage: this.user.rebate_percentage || this.user.max_rebate_percentage || (this.user.market_type === 'A' ? 0.011 : 0.041),
                        max_rebate_percentage: this.user.max_rebate_percentage || (this.user.market_type === 'A' ? 0.011 : 0.041)
                    };
                    
                    // 检查是否为客服（总代理）
                    this.isCustomerService = this.user.level === 0;
                    console.log('checkAuth设定客服权限:', this.isCustomerService, '用戶级别:', this.user.level);
                    
                    // 设置 axios 身份验证头
                    axios.defaults.headers.common['Authorization'] = token;
                    
                    // 设置session token header（優先使用）
                    const sessionToken = localStorage.getItem('agent_session_token');
                    if (sessionToken) {
                        axios.defaults.headers.common['x-session-token'] = sessionToken;
                    }
                    
                    // 强制Vue更新
                    this.$forceUpdate();
                    return true;
                }
            } catch (error) {
                console.error('解析用戶数据失败:', error);
                // 清除損壞的数据
                localStorage.removeItem('agent_token');
                localStorage.removeItem('agent_user');
            }
            
            console.log('认证失败');
            return false;
        },
        
        // 登录方法
        async login() {
            if (!this.loginForm.username || !this.loginForm.password) {
                return this.showMessage('请输入用戶名和密码', 'error');
            }
            
            this.loading = true;
            
            try {
                const response = await axios.post(`${API_BASE_URL}/login`, this.loginForm);
                
                if (response.data.success) {
                    // 保存用戶资讯和 token
                    const { agent, token, sessionToken } = response.data;
                    localStorage.setItem('agent_token', token);
                    localStorage.setItem('agent_user', JSON.stringify(agent));
                    
                    // 保存新的会话token
                    if (sessionToken) {
                        localStorage.setItem('agent_session_token', sessionToken);
                        console.log('✅ 代理会话token已保存');
                    }
                    
                    // 设置 axios 身份验证头
                    axios.defaults.headers.common['Authorization'] = token;
                    
                    // 设置session token header（優先使用）
                    if (sessionToken) {
                        axios.defaults.headers.common['x-session-token'] = sessionToken;
                    }
                    
                    // 更新用戶资讯
                    this.user = agent;
                    this.isLoggedIn = true;
                    
                    // 设置当前管理代理为自己 - 修復儀表板数据获取问题
                    this.currentManagingAgent = {
                        id: agent.id,
                        username: agent.username,
                        level: agent.level,
                        market_type: agent.market_type,
                        rebate_percentage: agent.rebate_percentage || agent.max_rebate_percentage || (agent.market_type === 'A' ? 0.011 : 0.041),
                        max_rebate_percentage: agent.max_rebate_percentage || (agent.market_type === 'A' ? 0.011 : 0.041)
                    };
                    
                    console.log('✅ 登录成功，设置当前管理代理:', this.currentManagingAgent);
                    
                    // 检查是否为客服
                    this.isCustomerService = this.user.level === 0;
                    console.log('登录後是否为客服:', this.isCustomerService, '用戶级别:', this.user.level);
                    
                    // 如果是客服，加载所有代理列表
                    if (this.isCustomerService) {
                        await this.loadAllAgents();
                    }
                    
                    // 获取初始数据
                    await this.fetchDashboardData();
                    await this.fetchNotices();
                    
                                    // 载入当前代理的下級代理和会员列表
                await this.searchAgents();
                await this.searchMembers();
                
                // 初始化可用会员列表
                this.availableMembers = this.members;
                    
                    this.showMessage('登录成功', 'success');
                } else {
                    this.showMessage(response.data.message || '登录失败', 'error');
                }
            } catch (error) {
                console.error('登录错误:', error);
                this.showMessage(error.response?.data?.message || '登录失败，请稍後再試', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 登出方法
        async logout() {
            console.log('执行登出操作');
            
            // 如果有会话token，通知伺服器登出
            const sessionToken = localStorage.getItem('agent_session_token');
            if (sessionToken) {
                try {
                    await axios.post(`${API_BASE_URL}/logout`, { sessionToken });
                    console.log('✅ 会话已在伺服器端登出');
                } catch (error) {
                    console.error('伺服器端登出失败:', error);
                }
            }
            
            // 清除本地存儲
            localStorage.removeItem('agent_token');
            localStorage.removeItem('agent_user');
            localStorage.removeItem('agent_session_token');
            
            // 重置状态
            this.isLoggedIn = false;
            this.user = {
                id: '',
                username: '',
                level: 0,
                balance: 0
            };
            
            // 重置 axios 身份验证头
            delete axios.defaults.headers.common['Authorization'];
            delete axios.defaults.headers.common['x-session-token'];
            
            this.showMessage('已成功登出', 'success');
            
            // 重定向到登录页面
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        },
        
        // 获取儀表板数据
        async fetchDashboardData() {
            this.loading = true;
            
            try {
                console.log('嘗試获取儀表板数据，代理ID:', this.currentManagingAgent.id);
                const response = await axios.get(`${API_BASE_URL}/stats`, {
                    params: { agentId: this.currentManagingAgent.id }
                });
                
                if (response.data.success) {
                    // 使用data属性而非stats属性
                    const data = response.data.data;
                    
                    if (!data) {
                        console.error('获取儀表板数据错误: 返回数据格式异常', response.data);
                        this.showMessage('获取数据失败，数据格式异常', 'error');
                        return;
                    }
                    
                    this.dashboardData = {
                        totalDeposit: data.totalDeposit || 0,
                        totalWithdraw: data.totalWithdraw || 0,
                        totalRevenue: data.totalRevenue || 0,
                        totalTransactions: data.totalTransactions || 0,
                        memberCount: data.memberCount || 0,
                        activeMembers: data.activeMembers || 0,
                        subAgentsCount: data.subAgentsCount || 0
                    };
                    
                    // 初始化交易图表
                    this.$nextTick(() => {
                        this.initTransactionChart();
                    });
                } else {
                    // 处理成功但返回失败的情况
                    console.error('获取儀表板数据错误: API返回失败', response.data);
                    this.showMessage(response.data.message || '获取数据失败，请稍後再試', 'error');
                }
            } catch (error) {
                console.error('获取儀表板数据错误:', error);
                this.showMessage('获取数据失败，请检查网络连接', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 初始化交易趋势图表
        initTransactionChart() {
            const ctx = document.getElementById('transactionChart');
            if (!ctx) return;
            
            // 检查 Chart.js 是否已加载
            if (typeof Chart === 'undefined') {
                console.warn('Chart.js 尚未加载，延迟初始化图表');
                setTimeout(() => this.initTransactionChart(), 500);
                return;
            }
            
            // 模擬数据 - 过去7天的交易数据
            const labels = Array(7).fill(0).map((_, i) => {
                const date = new Date();
                date.setDate(date.getDate() - (6 - i));
                return `${date.getMonth() + 1}/${date.getDate()}`;
            });
            
            const transactionData = [15000, 22000, 19500, 24000, 28000, 21000, 26500];

            
            if (this.transactionChart) {
                this.transactionChart.destroy();
            }
            
            this.transactionChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: '交易金额',
                            data: transactionData,
                            borderColor: 'rgba(54, 162, 235, 1)',
                            backgroundColor: 'rgba(54, 162, 235, 0.2)',
                            borderWidth: 2,
                            fill: true
                        },

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
        

        
        // 显示讯息
        showMessage(message, type = 'info') {
            console.log(`[${type}] ${message}`);
            // 可根据项目需求使用 alert、toast 或自定义讯息組件
            if (type === 'error') {
                alert(`错误: ${message}`);
            } else if (type === 'success') {
                alert(`成功: ${message}`);
            } else {
                alert(message);
            }
        },
        
        // 格式化金额显示
        formatMoney(amount) {
            if (amount === undefined || amount === null) return '0.00';
            return Number(amount).toLocaleString('zh-CN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        },
        
        // 格式化日期显示
        formatDate(dateString) {
            if (!dateString) return '';
            const date = new Date(dateString);
            return date.toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        },
        
        // 格式化日期时间（与 formatDate 相同，为了模板兼容性）
        formatDateTime(dateString) {
            if (!dateString) return '';
            const date = new Date(dateString);
            return date.toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        },
        
        // 客服交易记录分页 - 上一页
        loadCSTransactionsPrevPage() {
            const prevPage = Math.max(1, this.csTransactionsPagination.page - 1);
            this.loadCSTransactions(prevPage);
        },
        
        // 客服交易记录分页 - 下一页
        loadCSTransactionsNextPage() {
            const maxPage = Math.ceil(this.csTransactionsPagination.total / this.csTransactionsPagination.limit);
            const nextPage = Math.min(maxPage, this.csTransactionsPagination.page + 1);
            this.loadCSTransactions(nextPage);
        },
        
        // 获取系统公告
        async fetchNotices(category = null) {
            try {
                console.log('获取系统公告...');
                let url = `${API_BASE_URL}/notices`;
                if (category && category !== 'all') {
                    url += `?category=${encodeURIComponent(category)}`;
                }
                
                const response = await fetch(url);
                
                if (!response.ok) {
                    console.error('获取系统公告失败:', response.status);
                    this.notices = [];
                    return;
                }
                
                const data = await response.json();
                if (data.success) {
                    if (Array.isArray(data.notices)) {
                        this.notices = data.notices;
                    } else {
                        this.notices = [];
                    }
                    
                    if (Array.isArray(data.categories)) {
                        this.noticeCategories = ['all', ...data.categories];
                    }
                } else {
                    console.error('系统公告数据格式错误:', data);
                    this.notices = [];
                }
            } catch (error) {
                console.error('获取系统公告错误:', error);
                this.notices = [];
            }
        },
        
        // 根据分類过滤公告
        async filterNoticesByCategory(category) {
            this.selectedNoticeCategory = category;
            await this.fetchNotices(category === 'all' ? null : category);
        },
        
        // 显示新增公告模態框
        // 开始编辑公告
        startEditNotice(notice) {
            if (this.user.level !== 0) {
                this.showMessage('权限不足，只有总代理可以编辑系统公告', 'error');
                return;
            }
            
            // 设置编辑数据
            this.editingNoticeId = notice.id;
            this.noticeForm = {
                title: notice.title,
                content: notice.content,
                category: notice.category
            };
            this.showNoticeForm = true;
            
            // 滾動到表單
            this.$nextTick(() => {
                const formElement = document.querySelector('.card .card-header h5');
                if (formElement) {
                    formElement.scrollIntoView({ behavior: 'smooth' });
                }
            });
        },
        
        // 取消编辑公告
        cancelNoticeEdit() {
            this.showNoticeForm = false;
            this.editingNoticeId = null;
            this.noticeForm = {
                title: '',
                content: '',
                category: '最新公告'
            };
        },
        
        // 提交公告（新增或编辑）
        async submitNotice() {
            try {
                // 验证输入
                if (!this.noticeForm.title.trim()) {
                    this.showMessage('请输入公告标题', 'error');
                    return;
                }
                
                if (!this.noticeForm.content.trim()) {
                    this.showMessage('请输入公告内容', 'error');
                    return;
                }
                
                // 标题长度限制
                if (this.noticeForm.title.length > 100) {
                    this.showMessage('公告标题不能超过100个字符', 'error');
                    return;
                }
                
                this.loading = true;
                
                let response;
                if (this.editingNoticeId) {
                    // 编辑現有公告
                    response = await axios.put(`${API_BASE_URL}/notice/${this.editingNoticeId}`, {
                        operatorId: this.user.id,
                        title: this.noticeForm.title.trim(),
                        content: this.noticeForm.content.trim(),
                        category: this.noticeForm.category
                    });
                } else {
                    // 新增公告
                    response = await axios.post(`${API_BASE_URL}/create-notice`, {
                        operatorId: this.user.id,
                        title: this.noticeForm.title.trim(),
                        content: this.noticeForm.content.trim(),
                        category: this.noticeForm.category
                    });
                }
                
                if (response.data.success) {
                    this.showMessage(this.editingNoticeId ? '系统公告更新成功' : '系统公告创建成功', 'success');
                    this.cancelNoticeEdit();
                    
                    // 刷新公告列表
                    await this.fetchNotices();
                } else {
                    this.showMessage(response.data.message || '操作失败', 'error');
                }
                
            } catch (error) {
                console.error('公告操作出錯:', error);
                this.showMessage('操作出錯，请稍後再試', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 获取当前日期时间
        getCurrentDateTime() {
            return new Date().toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        },
        
        // 删除公告
        async deleteNotice(notice) {
            if (this.user.level !== 0) {
                this.showMessage('权限不足，只有总代理可以删除系统公告', 'error');
                return;
            }
            
            // 确认删除
            if (!confirm(`确定要删除公告「${notice.title}」嗎？此操作無法恢復。`)) {
                return;
            }
            
            try {
                this.loading = true;
                
                const response = await axios.delete(`${API_BASE_URL}/notice/${notice.id}`, {
                    data: {
                        operatorId: this.user.id
                    }
                });
                
                if (response.data.success) {
                    this.showMessage('系统公告删除成功', 'success');
                    
                    // 刷新公告列表
                    await this.fetchNotices();
                } else {
                    this.showMessage(response.data.message || '删除公告失败', 'error');
                }
                
            } catch (error) {
                console.error('删除公告出錯:', error);
                this.showMessage('删除公告出錯，请稍後再試', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 搜索代理
        async searchAgents() {
            this.loading = true;
            try {
                console.log('搜索代理...');
                const params = new URLSearchParams();
                if (this.agentFilters.status !== '-1') params.append('status', this.agentFilters.status);
                if (this.agentFilters.keyword) params.append('keyword', this.agentFilters.keyword);
                // 使用当前管理代理的ID作为parentId
                params.append('parentId', this.currentManagingAgent.id);
                
                const url = `${API_BASE_URL}/sub-agents?${params.toString()}`;
                const response = await fetch(url);
                
                if (!response.ok) {
                    console.error('搜索代理失败:', response.status);
                    this.agents = [];
                    return;
                }
                
                const data = await response.json();
                if (data.success && data.data) {
                    this.agents = data.data.list || [];
                    this.agentPagination.totalPages = Math.ceil(data.data.total / this.agentPagination.limit);
                    this.agentPagination.currentPage = data.data.page || 1;
                } else {
                    console.error('代理数据格式错误:', data);
                    this.agents = [];
                }
            } catch (error) {
                console.error('搜索代理错误:', error);
                this.agents = [];
            } finally {
                this.loading = false;
            }
        },
        
        // 搜索会员
        async searchMembers() {
            this.loading = true;
            try {
                console.log('搜索会员...当前管理代理ID:', this.currentManagingAgent.id, '查看模式:', this.memberViewMode);
                
                if (this.memberViewMode === 'downline') {
                    // 下級代理会员模式：获取整條代理線的会员
                    await this.loadDownlineMembers();
                } else {
                    // 直屬会员模式：只获取当前代理的会员
                    await this.loadDirectMembers();
                }
            } catch (error) {
                console.error('搜索会员错误:', error);
                this.members = [];
            } finally {
                this.loading = false;
            }
        },

        // 层级会员管理相关函數
        async loadHierarchicalMembers() {
            this.loading = true;
            try {
                const agentId = this.currentMemberManagingAgent.id || this.currentManagingAgent.id;
                console.log('🔄 载入层级会员管理数据...', { agentId });
                
                const response = await axios.get(`${API_BASE_URL}/hierarchical-members`, {
                    params: {
                        agentId: agentId,
                        status: this.memberFilters.status !== '-1' ? this.memberFilters.status : undefined,
                        keyword: this.memberFilters.keyword || undefined
                    }
                });
                
                if (response.data.success) {
                    this.hierarchicalMembers = response.data.data || [];
                    this.memberHierarchyStats = response.data.stats || { agentCount: 0, memberCount: 0 };
                    console.log('✅ 层级会员管理数据载入成功:', this.hierarchicalMembers.length, '项');
                } else {
                    console.error('❌ 载入层级会员管理数据失败:', response.data.message);
                    this.hierarchicalMembers = [];
                    this.memberHierarchyStats = { agentCount: 0, memberCount: 0 };
                }
            } catch (error) {
                console.error('❌ 载入层级会员管理数据错误:', error);
                this.hierarchicalMembers = [];
                this.memberHierarchyStats = { agentCount: 0, memberCount: 0 };
            } finally {
                this.loading = false;
            }
        },

        async refreshHierarchicalMembers() {
            await this.loadHierarchicalMembers();
        },

        async enterAgentMemberManagement(agent) {
            console.log('🔽 进入代理的会员管理:', agent);
            
            // 添加到面包屑
            this.memberBreadcrumb.push({
                id: this.currentMemberManagingAgent.id || this.currentManagingAgent.id,
                username: this.currentMemberManagingAgent.username || this.currentManagingAgent.username,
                level: this.getLevelName(this.currentMemberManagingAgent.level || this.currentManagingAgent.level)
            });
            
            // 设定新的管理代理
            this.currentMemberManagingAgent = {
                id: agent.id,
                username: agent.username,
                level: agent.level
            };
            
            // 载入新代理的会员
            await this.loadHierarchicalMembers();
        },

        async goBackToParentMember() {
            if (this.memberBreadcrumb.length > 0) {
                const parent = this.memberBreadcrumb.pop();
                this.currentMemberManagingAgent = {
                    id: parent.id,
                    username: parent.username,
                    level: this.getLevelFromName(parent.level)
                };
                await this.loadHierarchicalMembers();
            }
        },

        async goBackToMemberLevel(targetItem) {
            this.currentMemberManagingAgent = {
                id: targetItem.id,
                username: targetItem.username,
                level: this.getLevelFromName(targetItem.level)
            };
            await this.loadHierarchicalMembers();
        },

        getLevelFromName(levelName) {
            // 將级别名称转換回级别數字
            const levelMap = {
                '总代理': 0,
                '一級代理': 1,
                '二級代理': 2,
                '三級代理': 3,
                '四級代理': 4,
                '五級代理': 5,
                '六級代理': 6,
                '七級代理': 7,
                '八級代理': 8,
                '九級代理': 9,
                '十級代理': 10,
                '十一級代理': 11,
                '十二級代理': 12,
                '十三級代理': 13,
                '十四級代理': 14,
                '十五級代理': 15
            };
            return levelMap[levelName] || 0;
        },
        
        // 载入直屬会员
        async loadDirectMembers() {
            const params = new URLSearchParams();
            if (this.memberFilters.status !== '-1') params.append('status', this.memberFilters.status);
            if (this.memberFilters.keyword) params.append('keyword', this.memberFilters.keyword);
            params.append('agentId', this.currentManagingAgent.id);
            params.append('page', this.memberPagination.currentPage);
            params.append('limit', this.memberPagination.limit);
            
            const url = `${API_BASE_URL}/members?${params.toString()}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                console.error('搜索直屬会员失败:', response.status);
                this.members = [];
                return;
            }
            
            const data = await response.json();
            if (data.success && data.data) {
                this.members = data.data.list || [];
                this.memberPagination.totalPages = Math.ceil(data.data.total / this.memberPagination.limit);
                this.memberPagination.currentPage = data.data.page || 1;
            } else {
                console.error('直屬会员数据格式错误:', data);
                this.members = [];
            }
        },
        
        // 载入下級代理会员
        async loadDownlineMembers() {
            try {
                console.log('📡 载入下級代理会员...');
                const response = await axios.get(`${API_BASE_URL}/downline-members`, {
                    params: { 
                        rootAgentId: this.currentManagingAgent.id,
                        status: this.memberFilters.status !== '-1' ? this.memberFilters.status : undefined,
                        keyword: this.memberFilters.keyword || undefined
                    }
                });
                
                if (response.data.success) {
                    this.members = response.data.members || [];
                    // 为下級代理会员模式设定分页（簡化版）
                    this.memberPagination.totalPages = 1;
                    this.memberPagination.currentPage = 1;
                    console.log('✅ 载入下級代理会员成功:', this.members.length, '个');
                } else {
                    console.error('❌ 载入下級代理会员失败:', response.data.message);
                    this.members = [];
                }
            } catch (error) {
                console.error('❌ 载入下級代理会员错误:', error);
                this.members = [];
            }
        },
        
        // 处理会员查看模式变更
        async handleMemberViewModeChange() {
            console.log('🔄 会员查看模式变更:', this.memberViewMode);
            // 重置分页
            this.memberPagination.currentPage = 1;
            // 重新载入会员列表
            await this.searchMembers();
        },
        
        // 隐藏余额调整模態框
        hideAdjustBalanceModal() {
            if (this.adjustBalanceModal) {
                this.adjustBalanceModal.hide();
            }
            this.showAdjustBalanceModal = false;
        },
        
        // 计算最终会员余额
        calculateFinalMemberBalance() {
            const currentBalance = parseFloat(this.balanceAdjustData.currentBalance) || 0;
            const amount = parseFloat(this.transferAmount) || 0;
            if (this.transferType === 'deposit') {
                return currentBalance + amount;
            } else {
                return currentBalance - amount;
            }
        },
        
        // 计算最终代理余额（会员点数转移用）
        calculateFinalAgentBalance() {
            const currentBalance = parseFloat(this.agentCurrentBalance) || 0;
            const amount = parseFloat(this.transferAmount) || 0;
            
            if (this.transferType === 'deposit') {
                // 代理存入点数給会员，代理余额减少
                return currentBalance - amount;
            } else {
                // 代理從会员提领点数，代理余额增加
                return currentBalance + amount;
            }
        },

        // 设置最大转移金额（会员点数转移）
        setMaxAmount() {
            if (this.transferType === 'deposit') {
                // 存入：使用代理的全部余额
                this.transferAmount = parseFloat(this.agentCurrentBalance) || 0;
            } else if (this.transferType === 'withdraw') {
                // 提领：使用会员的全部余额
                this.transferAmount = parseFloat(this.balanceAdjustData.currentBalance) || 0;
            }
        },
        
        // 格式化时间
        formatTime(dateString) {
            if (!dateString) return '';
            const date = new Date(dateString);
            return date.toLocaleTimeString('zh-CN', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false
            });
        },
        
        // 获取盤口最大退水比例
        getMaxRebateForMarket(marketType) {
            if (marketType === 'A') {
                return 1.1; // A盤最大1.1%
            } else if (marketType === 'D') {
                return 4.1; // D盤最大4.1%
            }
            return 4.1; // 默认D盤
        },
        
        // 获取盤口信息
        getMarketInfo(marketType) {
            if (marketType === 'A') {
                return {
                    name: 'A盤',
                    rebate: '1.1%',
                    description: '高赔率盤口',
                    numberOdds: '9.89',
                    twoSideOdds: '1.9'
                };
            } else if (marketType === 'D') {
                return {
                    name: 'D盤',
                    rebate: '4.1%',
                    description: '标准盤口',
                    numberOdds: '9.59',
                    twoSideOdds: '1.88'
                };
            }
            return this.getMarketInfo('D'); // 默认D盤
        },
        
        // 处理查看范围变更
        async handleViewScopeChange() {
            console.log('🔄 查看范围变更:', this.betFilters.viewScope);
            
            // 重置相关筛选
            this.betFilters.member = '';
            this.betFilters.specificAgent = '';
            
            if (this.betFilters.viewScope === 'own') {
                // 僅本代理下級会员 - 總是载入直屬会员
                await this.loadDirectMembersForBets();
            } else if (this.betFilters.viewScope === 'downline') {
                // 整條代理線
                await this.loadDownlineAgentsAndMembers();
            } else if (this.betFilters.viewScope === 'specific') {
                // 指定代理/会员
                await this.loadAllDownlineAgents();
                this.availableMembers = [];
            }
        },
        
        // 载入直屬会员用於下注记录
        async loadDirectMembersForBets() {
            try {
                console.log('📡 载入直屬会员用於下注记录...');
                const response = await axios.get(`${API_BASE_URL}/members`, {
                    params: { 
                        agentId: this.currentManagingAgent.id,
                        page: 1,
                        limit: 1000  // 载入所有直屬会员
                    }
                });
                
                if (response.data.success && response.data.data) {
                    this.availableMembers = response.data.data.list || [];
                    console.log('✅ 载入直屬会员成功:', this.availableMembers.length, '个');
                } else {
                    console.error('❌ 载入直屬会员失败:', response.data.message);
                    this.availableMembers = [];
                }
            } catch (error) {
                console.error('❌ 载入直屬会员错误:', error);
                this.availableMembers = [];
            }
        },
        
        // 载入所有下級代理
        async loadAllDownlineAgents() {
            try {
                console.log('📡 载入所有下級代理...');
                const response = await axios.get(`${API_BASE_URL}/downline-agents`, {
                    params: { 
                        rootAgentId: this.currentManagingAgent.id 
                    }
                });
                
                if (response.data.success) {
                    this.allDownlineAgents = response.data.agents || [];
                    console.log('✅ 载入下級代理成功:', this.allDownlineAgents.length, '个');
                } else {
                    console.error('❌ 载入下級代理失败:', response.data.message);
                }
            } catch (error) {
                console.error('❌ 载入下級代理错误:', error);
                this.showMessage('载入代理列表失败', 'error');
            }
        },
        
        // 载入整條代理線的代理和会员
        async loadDownlineAgentsAndMembers() {
            try {
                console.log('📡 载入整條代理線的会员...');
                const response = await axios.get(`${API_BASE_URL}/downline-members`, {
                    params: { 
                        rootAgentId: this.currentManagingAgent.id 
                    }
                });
                
                if (response.data.success) {
                    this.availableMembers = response.data.members || [];
                    console.log('✅ 载入整條代理線会员成功:', this.availableMembers.length, '个');
                } else {
                    console.error('❌ 载入整條代理線会员失败:', response.data.message);
                }
            } catch (error) {
                console.error('❌ 载入整條代理線会员错误:', error);
                this.showMessage('载入会员列表失败', 'error');
            }
        },
        
        // 载入指定代理的会员
        async loadSpecificAgentMembers() {
            if (!this.betFilters.specificAgent) {
                this.availableMembers = [];
                return;
            }
            
            try {
                console.log('📡 载入指定代理的会员...', this.betFilters.specificAgent);
                const response = await axios.get(`${API_BASE_URL}/agent-members`, {
                    params: { 
                        agentId: this.betFilters.specificAgent 
                    }
                });
                
                if (response.data.success) {
                    this.availableMembers = response.data.members || [];
                    console.log('✅ 载入指定代理会员成功:', this.availableMembers.length, '个');
                } else {
                    console.error('❌ 载入指定代理会员失败:', response.data.message);
                }
            } catch (error) {
                console.error('❌ 载入指定代理会员错误:', error);
                this.showMessage('载入会员列表失败', 'error');
            }
        },
        
        // 重置下注筛选條件
        resetBetFilters() {
            console.log('🔄 重置下注筛选條件');
            this.betFilters = {
                member: '',
                date: '',
                startDate: '',
                endDate: '',
                period: '',
                viewScope: 'own',
                specificAgent: ''
            };
            // 重新载入直屬会员列表
            this.loadDirectMembersForBets();
            this.searchBets();
        },
        
        // 搜索下注记录
        async searchBets() {
            this.loading = true;
            try {
                console.log('🔍 搜索下注记录...当前管理代理ID:', this.currentManagingAgent.id);
                console.log('📊 查看范围:', this.betFilters.viewScope);
                
                const params = new URLSearchParams();
                if (this.betFilters.member) params.append('username', this.betFilters.member);
                if (this.betFilters.date) params.append('date', this.betFilters.date);
                if (this.betFilters.startDate) params.append('startDate', this.betFilters.startDate);
                if (this.betFilters.endDate) params.append('endDate', this.betFilters.endDate);
                if (this.betFilters.period) params.append('period', this.betFilters.period);
                
                // 根据查看范围设置不同的查询参数
                if (this.betFilters.viewScope === 'own') {
                    // 僅本代理下級会员
                    params.append('agentId', this.currentManagingAgent.id);
                } else if (this.betFilters.viewScope === 'downline') {
                    // 整條代理線
                    params.append('rootAgentId', this.currentManagingAgent.id);
                    params.append('includeDownline', 'true');
                } else if (this.betFilters.viewScope === 'specific' && this.betFilters.specificAgent) {
                    // 指定代理
                    params.append('agentId', this.betFilters.specificAgent);
                }
                
                // 添加分页参数
                params.append('page', this.betPagination.currentPage);
                params.append('limit', this.betPagination.limit);
                
                const url = `${API_BASE_URL}/bets?${params.toString()}`;
                console.log('📡 请求URL:', url);
                
                const response = await axios.get(url);
                
                if (!response.data.success) {
                    console.error('❌ 搜索下注记录失败:', response.data.message);
                    this.bets = [];
                    return;
                }
                
                const data = response.data;
                if (data.success) {
                    this.bets = data.bets || [];
                    console.log('✅ 获取下注记录成功:', this.bets.length, '筆');
                    
                    this.betPagination.totalPages = Math.ceil(data.total / this.betPagination.limit);

                    // 更新统计数据
                    this.betStats = data.stats || {
                        totalBets: 0,
                        totalAmount: 0,
                        totalProfit: 0
                    };
                } else {
                    console.error('❌ 获取下注记录失败:', data.message || '未知错误');
                    this.bets = [];
                    this.betPagination.totalPages = 1;
                    this.betStats = { totalBets: 0, totalAmount: 0, totalProfit: 0 };
                }
            } catch (error) {
                console.error('❌ 搜索下注记录错误:', error);
                this.bets = [];
            } finally {
                this.loading = false;
            }
        },
        
        // 加载开奖历史
        async loadDrawHistory() {
            this.loading = true;
            try {
                console.log('加载开奖历史...');
                const url = `${API_BASE_URL}/draw-history`;
                const response = await fetch(url);
                
                if (!response.ok) {
                    console.error('加载开奖历史失败:', response.status);
                    this.drawRecords = [];
                    return;
                }
                
                const data = await response.json();
                if (data.success && data.records) {
                    this.drawRecords = data.records || [];
                    this.drawPagination.totalPages = Math.ceil(data.total / this.drawPagination.limit);
                    this.drawPagination.currentPage = data.page || 1;
                } else {
                    console.error('开奖历史数据格式错误:', data);
                    this.drawRecords = [];
                }
            } catch (error) {
                console.error('加载开奖历史错误:', error);
                this.drawRecords = [];
            } finally {
                this.loading = false;
            }
        },
        
        // 搜索开奖历史
        async searchDrawHistory() {
            this.loading = true;
            try {
                console.log('搜索开奖历史...');
                const params = new URLSearchParams();
                if (this.drawFilters.period) params.append('period', this.drawFilters.period);
                if (this.drawFilters.date) params.append('date', this.drawFilters.date);
                params.append('page', this.drawPagination.currentPage);
                params.append('limit', this.drawPagination.limit);
                
                const url = `${API_BASE_URL}/draw-history?${params.toString()}`;
                const response = await fetch(url);
                
                if (!response.ok) {
                    console.error('搜索开奖历史失败:', response.status);
                    this.drawRecords = [];
                    return;
                }
                
                const data = await response.json();
                if (data.success && data.records) {
                    this.drawRecords = data.records || [];
                    this.drawPagination.totalPages = Math.ceil(data.total / this.drawPagination.limit);
                    this.drawPagination.currentPage = data.page || 1;
                } else {
                    console.error('开奖历史数据格式错误:', data);
                    this.drawRecords = [];
                }
            } catch (error) {
                console.error('搜索开奖历史错误:', error);
                this.drawRecords = [];
            } finally {
                this.loading = false;
            }
        },
        
        // 搜索今日开奖记录
        async searchTodayDrawHistory() {
            this.drawFilters.date = new Date().toISOString().split('T')[0]; // 设置为今天日期 YYYY-MM-DD
            this.drawFilters.period = '';
            await this.searchDrawHistory();
        },
        
        // 获取分页范围
        getPageRange(currentPage, totalPages) {
            const range = [];
            const maxVisible = 5;
            
            if (totalPages <= maxVisible) {
                // 如果總页數小於要显示的页數，显示所有页
                for (let i = 1; i <= totalPages; i++) {
                    range.push(i);
                }
            } else {
                // 计算显示哪些页面
                let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                let end = start + maxVisible - 1;
                
                if (end > totalPages) {
                    end = totalPages;
                    start = Math.max(1, end - maxVisible + 1);
                }
                
                for (let i = start; i <= end; i++) {
                    range.push(i);
                }
            }
            
            return range;
        },
        
        // 格式化投注类型
        formatBetType(type) {
            // 根据後端逻辑，重新分類投注类型
            if (['champion', 'runnerup', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'].includes(type)) {
                return '双面';
            } else if (type === 'number') {
                return '号码';
            } else if (type === 'sumValue') {
                return '冠亞和值';
            } else if (type === 'dragonTiger' || type === 'dragon_tiger') {
                return '龙虎';
            }
            
            // 備用映射（向下相容）
            const types = {
                'sum': '冠亞和值',
                'second': '双面'
            };
            return types[type] || type;
        },
        
        // 格式化位置
        formatPosition(position, betType) {
            // 对於号码投注，position是數字（1-10），代表第幾位
            if (betType === 'number' && position) {
                const positionMap = {
                    '1': '冠军',
                    '2': '亚军', 
                    '3': '第三名',
                    '4': '第四名',
                    '5': '第五名',
                    '6': '第六名',
                    '7': '第七名',
                    '8': '第八名',
                    '9': '第九名',
                    '10': '第十名'
                };
                return positionMap[position.toString()] || `第${position}名`;
            }
            
            // 对於位置投注，bet_type本身就是位置
            if (['champion', 'runnerup', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'].includes(betType)) {
                const positionMap = {
                    'champion': '冠军',
                    'runnerup': '亚军',
                    'third': '第三名',
                    'fourth': '第四名',
                    'fifth': '第五名',
                    'sixth': '第六名',
                    'seventh': '第七名',
                    'eighth': '第八名',
                    'ninth': '第九名',
                    'tenth': '第十名'
                };
                return positionMap[betType] || betType;
            }
            
            // 其他情况（冠亞和值、龙虎等）不需要位置
            return '-';
        },
        
        // 获取龙虎结果
        getDragonTigerResult(record) {
            if (!record || !record.result || record.result.length < 10) {
                return { value: '-', class: '' };
            }
            
            const first = record.result[0];
            const tenth = record.result[9];
            
            if (first > tenth) {
                return { value: '龙', class: 'text-danger' };
            } else if (first < tenth) {
                return { value: '虎', class: 'text-primary' };
            } else {
                return { value: '和', class: 'text-warning' };
            }
        },
        
        // 格式化转移类型
        formatTransferType(transfer) {
            // 以当前登录代理身份为第一人稱，只显示存款或提领
            const currentAgentId = this.user.id;
            
            // 如果当前代理是转出方，显示为「提领」（我转出給其他人）
            if (transfer.from_id === currentAgentId && transfer.from_type === 'agent') {
                return '提领';
            }
            // 如果当前代理是转入方，显示为「存款」（其他人转入給我）
            else if (transfer.to_id === currentAgentId && transfer.to_type === 'agent') {
                return '存款';
            }
            // 備用逻辑（适用於查看其他代理记录的情况）
            else if (transfer.from_type === 'agent' && transfer.to_type === 'member') {
                return '存入';
            } else if (transfer.from_type === 'member' && transfer.to_type === 'agent') {
                return '提领';
            } else if (transfer.from_type === 'agent' && transfer.to_type === 'agent') {
                return '存入';  // 代理间转移统一显示为存入
            } else {
                return '点数转移';
            }
        },
        
        // 格式化转移方向
        formatTransferDirection(transfer) {
            // 以当前登录代理身份为第一人稱，從其观点描述转移方向
            const currentAgentId = this.user.id;
            
            // 如果当前代理是转出方
            if (transfer.from_id === currentAgentId && transfer.from_type === 'agent') {
                if (transfer.to_type === 'member') {
                    return `我 → ${transfer.to_username || '未知会员'}`;
                } else if (transfer.to_type === 'agent') {
                    return `我 → ${transfer.to_username || '未知代理'}`;
                }
            }
            // 如果当前代理是转入方
            else if (transfer.to_id === currentAgentId && transfer.to_type === 'agent') {
                if (transfer.from_type === 'member') {
                    return `${transfer.from_username || '未知会员'} → 我`;
                } else if (transfer.from_type === 'agent') {
                    return `${transfer.from_username || '未知代理'} → 我`;
                }
            }
            // 其他情况（查看他人记录）
            else {
                const fromName = transfer.from_username || (transfer.from_type === 'agent' ? '代理' : '会员');
                const toName = transfer.to_username || (transfer.to_type === 'agent' ? '代理' : '会员');
                return `${fromName} → ${toName}`;
            }
            
            return '未知方向';
        },
        
        // 格式化交易类型
        formatTransactionType(transaction) {
            const type = transaction.transaction_type || transaction.type;
            switch (type) {
                case 'cs_deposit':
                    return '客服存款';
                case 'cs_withdraw':
                    return '客服提款';
                case 'deposit':
                    return '存款';
                case 'withdraw':
                    return '提款';
                case 'transfer_in':
                    return '转入';
                case 'transfer_out':
                    return '转出';
                case 'adjustment':
                    return '余额调整';
                case 'password_reset':
                    return '密码重设';
                case 'game_bet':
                    return '游戏下注';
                case 'game_win':
                    return '游戏中奖';
                case 'rebate':
                    return '退水';
                default:
                    return type || '未知';
            }
        },
        
        // 格式化用戶类型
        formatUserType(userType) {
            switch (userType) {
                case 'agent':
                    return '代理';
                case 'member':
                    return '会员';
                default:
                    return userType || '未知';
            }
        },
        
        // 获取级别名称
        getLevelName(level) {
            const levels = {
                0: '客服',
                1: '一級代理', 
                2: '二級代理',
                3: '三級代理',
                4: '四級代理',
                5: '五級代理',
                6: '六級代理',
                7: '七級代理',
                8: '八級代理',
                9: '九級代理',
                10: '十級代理',
                11: '十一級代理',
                12: '十二級代理',
                13: '十三級代理',
                14: '十四級代理',
                15: '十五級代理'
            };
            return levels[level] || `${level}級代理`;
        },
        
        // 提交余额调整
        async submitBalanceAdjustment() {
            if (!this.balanceAdjustData.memberId || !this.balanceAdjustData.currentBalance || !this.transferAmount || !this.transferType) {
                return this.showMessage('请填写完整余额调整资料', 'error');
            }
            
            this.loading = true;
            
            try {
                // 准备要傳送的数据，确保包含所有後端需要的欄位
                const payload = {
                    agentId: this.balanceAdjustData.agentId,
                    username: this.balanceAdjustData.memberUsername, // 後端需要 username
                    amount: this.transferType === 'deposit' ? this.transferAmount : -this.transferAmount, // 根据类型调整金额正負
                    type: this.transferType, // 转移类型 'deposit' 或 'withdraw'
                    description: this.balanceAdjustData.description
                };

                const response = await axios.post(`${API_BASE_URL}/update-member-balance`, payload);
                
                if (response.data.success) {
                    this.showMessage('余额调整成功', 'success');
                    // 更新前端显示的代理和会员余额
                    this.user.balance = response.data.agentBalance;
                    // 同时更新localStorage中的用戶资讯
                    localStorage.setItem('agent_user', JSON.stringify(this.user));
                    this.agentCurrentBalance = parseFloat(response.data.agentBalance) || 0; // 同步更新代理当前余额
                    // 需要重新获取会员列表或更新特定会员的余额，以反映变更
                    this.searchMembers(); // 重新载入会员列表，会包含更新後的余额
                    this.hideAdjustBalanceModal(); // 关闭模態框
                    await this.fetchDashboardData(); // 更新儀表板数据
                } else {
                    this.showMessage(response.data.message || '余额调整失败', 'error');
                }
            } catch (error) {
                console.error('提交余额调整错误:', error);
                this.showMessage(error.response?.data?.message || '余额调整失败，请稍後再試', 'error');
            } finally {
                this.loading = false;
            }
        },
        // 新增的方法，确保在Vue實例中定义
        async createMember() {
            // 實际的创建会员逻辑需要您来實現
            console.log('createMember 方法被調用', this.newMember);
            if (!this.newMember.username || !this.newMember.password || !this.newMember.confirmPassword) {
                this.showMessage('请填写所有必填欄位', 'error');
                return;
            }
            
            // 验证用戶名格式（只允许英文、數字）
            const usernameRegex = /^[a-zA-Z0-9]+$/;
            if (!usernameRegex.test(this.newMember.username)) {
                this.showMessage('用戶名只能包含英文字母和數字', 'error');
                return;
            }
            
            // 验证密码长度（至少6碼）
            if (this.newMember.password.length < 6) {
                this.showMessage('密码至少需要6个字符', 'error');
                return;
            }
            
            if (this.newMember.password !== this.newMember.confirmPassword) {
                this.showMessage('两次输入的密码不一致', 'error');
                return;
            }
            this.loading = true;
            try {
                const response = await axios.post(`${API_BASE_URL}/create-member`, {
                    username: this.newMember.username,
                    password: this.newMember.password,
                    agentId: this.currentManagingAgent.id, // 使用当前管理代理的ID而非登录代理
                    notes: this.newMember.notes || ''
                });
                if (response.data.success) {
                    const agentName = this.currentManagingAgent.username;
                    const isCurrentUser = this.currentManagingAgent.id === this.user.id;
                    const message = isCurrentUser ? 
                        `会员 ${this.newMember.username} 创建成功!` : 
                        `已为代理 ${agentName} 创建会员 ${this.newMember.username}`;
                    this.showMessage(message, 'success');
                    this.hideCreateMemberModal();
                    // 重置新增会员表單
                    this.newMember = {
                        username: '',
                        password: '',
                        confirmPassword: '',
                        balance: 0,
                        status: 1,
                        notes: ''
                    };
                    await this.searchMembers(); // 刷新会员列表
                } else {
                    this.showMessage(response.data.message || '会员创建失败', 'error');
                }
            } catch (error) {
                console.error('创建会员出錯:', error);
                this.showMessage(error.response?.data?.message || '创建会员出錯，请稍後再試', 'error');
            } finally {
                this.loading = false;
            }
        },
        

        async fetchParentAgents() {
            // 實际获取上級代理列表的逻辑需要您来實現
            console.log('fetchParentAgents 方法被調用');
             if (this.user.level === 0) { // 总代理不能有上級
                this.parentAgents = [];
                return;
            }
            this.loading = true;
            try {
                // 通常是获取可作为当前操作代理的上級代理列表
                // 这里假設API会返回合适的代理列表
                const response = await axios.get(`${API_BASE_URL}/available-parents`);
                if (response.data.success) {
                    this.parentAgents = response.data.agents || [];
                } else {
                    this.showMessage(response.data.message || '获取上級代理失败', 'error');
                    this.parentAgents = [];
                }
            } catch (error) {
                console.error('获取上級代理列表出錯:', error);
                this.showMessage('获取上級代理列表出錯，请稍後再試', 'error');
                this.parentAgents = [];
            } finally {
                this.loading = false;
            }
        },
        async createAgent() {
            console.log('createAgent 方法被調用', this.newAgent);
            if (!this.newAgent.username || !this.newAgent.password) {
                this.showMessage('请填写所有必填欄位', 'error');
                return;
            }
            
            // 验证用戶名格式（只允许英文、數字）
            const usernameRegex = /^[a-zA-Z0-9]+$/;
            if (!usernameRegex.test(this.newAgent.username)) {
                this.showMessage('用戶名只能包含英文字母和數字', 'error');
                return;
            }
            
            // 验证密码长度（至少6碼）
            if (this.newAgent.password.length < 6) {
                this.showMessage('密码至少需要6个字符', 'error');
                return;
            }
            
                            // 验证退水设定
            if (this.newAgent.rebate_mode === 'percentage') {
                const rebatePercentage = parseFloat(this.newAgent.rebate_percentage);
                // 修復：使用当前管理代理的實际退水比例作为最大限制，根据盤口类型设定默认值
                const defaultMaxRebate = this.currentManagingAgent.market_type === 'A' ? 0.011 : 0.041;
                const maxRebate = (this.currentManagingAgent.rebate_percentage || this.currentManagingAgent.max_rebate_percentage || defaultMaxRebate) * 100;
                
                if (isNaN(rebatePercentage) || rebatePercentage < 0 || rebatePercentage > maxRebate) {
                    this.showMessage(`退水比例必须在 0% - ${maxRebate.toFixed(1)}% 之间`, 'error');
                    return;
                }
            }
            
            this.loading = true;
            try {
                const payload = {
                    username: this.newAgent.username,
                    password: this.newAgent.password,
                    level: parseInt(this.newAgent.level),
                    parent: this.newAgent.parent,
                    market_type: this.newAgent.market_type,
                    rebate_mode: this.newAgent.rebate_mode,
                    notes: this.newAgent.notes || ''
                };
                
                // 只有在选择具体比例时才傳送退水比例
                if (this.newAgent.rebate_mode === 'percentage') {
                    payload.rebate_percentage = parseFloat(this.newAgent.rebate_percentage) / 100;
                }
                
                console.log('创建代理请求数据:', payload);
                
                const response = await axios.post(`${API_BASE_URL}/create-agent`, payload);
                if (response.data.success) {
                    this.showMessage('代理创建成功!', 'success');
                    this.hideCreateAgentModal();
                    
                    // 重置表單
                    this.newAgent = {
                        username: '',
                        password: '',
                        level: '1',
                        parent: '',
                        market_type: 'D',
                        rebate_mode: 'percentage',
                        rebate_percentage: 2.0, // 重置时使用D盤默认值
                        notes: ''
                    };
                    
                    this.searchAgents(); // 刷新代理列表
                } else {
                    this.showMessage(response.data.message || '代理创建失败', 'error');
                }
            } catch (error) {
                console.error('创建代理出錯:', error);
                this.showMessage(error.response?.data?.message || '创建代理出錯，请稍後再試', 'error');
            } finally {
                this.loading = false;
            }
        },
        // 加载点数转移记录
        async loadPointTransfers() {
            this.loading = true;
            try {
                console.log('加载点数转移记录...');
                const url = `${API_BASE_URL}/point-transfers?agentId=${this.user.id}`;
                const response = await fetch(url);
                
                if (!response.ok) {
                    console.error('加载点数转移记录失败:', response.status);
                    this.pointTransfers = [];
                    return;
                }
                
                const data = await response.json();
                if (data.success) {
                    this.pointTransfers = data.transfers || [];
                    console.log('点数转移记录载入成功，共有 ' + this.pointTransfers.length + ' 筆记录');
                } else {
                    console.error('点数转移记录数据格式错误:', data);
                    this.pointTransfers = [];
                }
            } catch (error) {
                console.error('加载点数转移记录错误:', error);
                this.pointTransfers = [];
            } finally {
                this.loading = false;
            }
        },
        
        // 清空所有转移记录（僅用於测试）
        async clearAllTransfers() {
            if (!confirm('确定要清空所有点数转移记录嗎？此操作無法撤销！')) {
                return;
            }
            
            this.loading = true;
            try {
                const response = await fetch(`${API_BASE_URL}/agent/clear-transfers`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                const data = await response.json();
                
                if (data.success) {
                    this.showMessage('所有转移记录已清空', 'success');
                    this.pointTransfers = [];
                } else {
                    this.showMessage(data.message || '清空记录失败', 'error');
                }
            } catch (error) {
                console.error('清空记录出錯:', error);
                this.showMessage('清空记录失败，请稍後再試', 'error');
            } finally {
                this.loading = false;
            }
        },
        // 新增：处理会员余额调整模態框的显示
        adjustMemberBalance(member) {
            // 设置要修改的会员资料
            this.memberBalanceData = {
                memberId: member.id,
                memberUsername: member.username,
                currentBalance: member.balance,
                description: ''
            };
            
            // 设置默认值
            this.memberTransferType = 'deposit';
            this.memberTransferAmount = 0;
            
            console.log('会员点數转移数据准备完成:', {
                member: member,
                user: this.user,
                memberBalanceData: this.memberBalanceData
            });
            
            // 使用Bootstrap 5标准方式显示模態框
            const modalElement = document.getElementById('adjustMemberBalanceModal');
            if (!modalElement) {
                console.error('找不到会员点數转移模態框元素');
                return this.showMessage('系统错误：找不到模態框元素', 'error');
            }
            
            // 直接使用Bootstrap 5的Modal方法
            const modal = new bootstrap.Modal(modalElement);
            this.adjustMemberBalanceModal = modal;
            modal.show();
        },

        // 计算最終会员余额（会员点數转移）
        calculateFinalMemberBalanceTransfer() {
            // 確保使用有效數值
            const currentBalance = parseFloat(this.memberBalanceData?.currentBalance) || 0;
            const transferAmount = parseFloat(this.memberTransferAmount) || 0;
            
            if (this.memberTransferType === 'deposit') {
                return currentBalance + transferAmount;
            } else {
                return currentBalance - transferAmount;
            }
        },
        
        // 计算最終代理余额（会员点數转移）
        calculateFinalAgentBalanceFromMember() {
            // 確保使用有效數值
            const currentBalance = parseFloat(this.user.balance) || 0;
            const transferAmount = parseFloat(this.memberTransferAmount) || 0;
            
            if (this.memberTransferType === 'deposit') {
                return currentBalance - transferAmount;
            } else {
                return currentBalance + transferAmount;
            }
        },

        // 设置最大转移金额（会员点數转移）
        setMaxMemberAmount() {
            if (this.memberTransferType === 'deposit') {
                // 存入：使用代理（自己）的全部余额
                this.memberTransferAmount = parseFloat(this.user.balance) || 0;
            } else if (this.memberTransferType === 'withdraw') {
                // 提领：使用会员的全部余额
                this.memberTransferAmount = parseFloat(this.memberBalanceData.currentBalance) || 0;
            }
        },

        // 隐藏会员点數转移模態框
        hideAdjustMemberBalanceModal() {
            if (this.adjustMemberBalanceModal) {
                this.adjustMemberBalanceModal.hide();
            }
        },

        // 提交会员点數转移
        async submitMemberBalanceTransfer() {
            console.log('嘗試提交会员点數转移');
            if (!this.memberBalanceData.memberId || !this.memberTransferAmount) {
                console.log('资料不完整:', {
                    memberId: this.memberBalanceData.memberId,
                    transferAmount: this.memberTransferAmount,
                    description: this.memberBalanceData.description
                });
                return this.showMessage('请填写转移金额', 'error');
            }
            
            this.loading = true;
            console.log('开始提交会员点數转移数据');
            
            try {
                // 准备要傳送的数据
                const payload = {
                    agentId: this.user.id,  // 当前代理ID（来源或目标）
                    memberId: this.memberBalanceData.memberId,  // 会员ID
                    amount: this.memberTransferType === 'deposit' ? this.memberTransferAmount : -this.memberTransferAmount, // 根据类型调整金额正負
                    type: this.memberTransferType, // 转移类型 'deposit' 或 'withdraw'
                    description: this.memberBalanceData.description
                };

                console.log('准备发送的数据:', payload);
                const response = await axios.post(`${API_BASE_URL}/transfer-member-balance`, payload);
                console.log('伺服器返回结果:', response.data);
                
                if (response.data.success) {
                    this.showMessage('会员点數转移成功', 'success');
                    // 更新前端显示的代理余额
                    this.user.balance = response.data.parentBalance;
                    // 同时更新localStorage中的用戶资讯
                    localStorage.setItem('agent_user', JSON.stringify(this.user));
                    // 需要重新获取会员列表或更新特定会员的余额
                    if (this.activeTab === 'members') {
                        // 在层级会员管理介面时刷新层级会员数据
                        await this.refreshHierarchicalMembers();
                    } else {
                        // 在其他介面时刷新会员列表
                        this.searchMembers();
                    }
                    this.hideAdjustMemberBalanceModal(); // 关闭模態框
                    await this.fetchDashboardData(); // 更新儀表板数据
                } else {
                    this.showMessage(response.data.message || '会员点數转移失败', 'error');
                }
            } catch (error) {
                console.error('提交会员点數转移错误:', error);
                this.showMessage(error.response?.data?.message || '会员点數转移失败，请稍後再試', 'error');
            } finally {
                this.loading = false;
            }
        },

        // 进入代理管理（導航到下級代理）
        async enterAgentManagement(agent) {
            // 添加到面包屑導航
            this.agentBreadcrumbs.push({
                id: this.currentManagingAgent.id,
                username: this.currentManagingAgent.username,
                level: this.currentManagingAgent.level,
                market_type: this.currentManagingAgent.market_type,
                rebate_percentage: this.currentManagingAgent.rebate_percentage,
                max_rebate_percentage: this.currentManagingAgent.max_rebate_percentage
            });
            
            // 更新当前管理代理 - 包含完整的退水比例和盤口类型资讯
            const defaultMaxRebate = agent.market_type === 'A' ? 0.011 : 0.041;
            this.currentManagingAgent = {
                id: agent.id,
                username: agent.username,
                level: agent.level,
                market_type: agent.market_type,
                rebate_percentage: agent.rebate_percentage || agent.max_rebate_percentage || defaultMaxRebate,
                max_rebate_percentage: agent.max_rebate_percentage || defaultMaxRebate
            };
            
            console.log('🔄 进入代理管理，更新currentManagingAgent:', this.currentManagingAgent);
            
            // 重新载入代理列表和会员列表（該代理的下級）
            await this.searchAgents();
            await this.searchMembers();
        },
        
        // 導航到指定代理层级
        async navigateToAgentLevel(agentId, username) {
            // 查找面包屑中的位置
            const targetIndex = this.agentBreadcrumbs.findIndex(b => b.id === agentId);
            
            if (agentId === this.user.id) {
                // 返回到自己
                this.agentBreadcrumbs = [];
                const defaultMaxRebate = this.user.market_type === 'A' ? 0.011 : 0.041;
                this.currentManagingAgent = {
                    id: this.user.id,
                    username: this.user.username,
                    level: this.user.level,
                    market_type: this.user.market_type,
                    rebate_percentage: this.user.rebate_percentage || this.user.max_rebate_percentage || defaultMaxRebate,
                    max_rebate_percentage: this.user.max_rebate_percentage || defaultMaxRebate
                };
            } else if (targetIndex >= 0) {
                // 移除該位置之后的所有面包屑
                const targetBreadcrumb = this.agentBreadcrumbs[targetIndex];
                this.agentBreadcrumbs = this.agentBreadcrumbs.slice(0, targetIndex);
                const defaultMaxRebate = targetBreadcrumb.market_type === 'A' ? 0.011 : 0.041;
                this.currentManagingAgent = {
                    id: targetBreadcrumb.id,
                    username: targetBreadcrumb.username,
                    level: targetBreadcrumb.level,
                    market_type: targetBreadcrumb.market_type,
                    rebate_percentage: targetBreadcrumb.rebate_percentage || targetBreadcrumb.max_rebate_percentage || defaultMaxRebate,
                    max_rebate_percentage: targetBreadcrumb.max_rebate_percentage || defaultMaxRebate
                };
            }
            
            console.log('🧭 導航到代理层级，更新currentManagingAgent:', this.currentManagingAgent);
            
            // 重新载入代理列表和会员列表
            await this.searchAgents();
            await this.searchMembers();
        },
        
        // 返回上級代理
        async goBackToParentLevel() {
            if (this.agentBreadcrumbs.length > 0) {
                const parentBreadcrumb = this.agentBreadcrumbs.pop();
                const defaultMaxRebate = parentBreadcrumb.market_type === 'A' ? 0.011 : 0.041;
                this.currentManagingAgent = {
                    id: parentBreadcrumb.id,
                    username: parentBreadcrumb.username,
                    level: parentBreadcrumb.level,
                    market_type: parentBreadcrumb.market_type,
                    rebate_percentage: parentBreadcrumb.rebate_percentage || parentBreadcrumb.max_rebate_percentage || defaultMaxRebate,
                    max_rebate_percentage: parentBreadcrumb.max_rebate_percentage || defaultMaxRebate
                };
            } else {
                // 返回到自己
                const defaultMaxRebate = this.user.market_type === 'A' ? 0.011 : 0.041;
                this.currentManagingAgent = {
                    id: this.user.id,
                    username: this.user.username,
                    level: this.user.level,
                    market_type: this.user.market_type,
                    rebate_percentage: this.user.rebate_percentage || this.user.max_rebate_percentage || defaultMaxRebate,
                    max_rebate_percentage: this.user.max_rebate_percentage || defaultMaxRebate
                };
            }
            
            console.log('⬆️ 返回上級代理，更新currentManagingAgent:', this.currentManagingAgent);
            
            // 重新载入代理列表和会员列表
            await this.searchAgents();
            await this.searchMembers();
        },
        
        // 显示退水设定模態框
        showRebateSettingsModal(agent) {
            // 修復：需要從上級代理获取退水限制，根据盤口类型设定默认值
            const defaultMaxRebate = this.currentManagingAgent.market_type === 'A' ? 0.011 : 0.041;
            const maxRebate = this.currentManagingAgent.rebate_percentage || this.currentManagingAgent.max_rebate_percentage || defaultMaxRebate;
            
            this.rebateAgent = {
                id: agent.id,
                username: agent.username,
                rebate_mode: agent.rebate_mode || 'percentage',
                rebate_percentage: maxRebate, // 使用上級代理的退水限制
                max_rebate_percentage: agent.max_rebate_percentage || defaultMaxRebate
            };
            
            this.rebateSettings = {
                rebate_mode: agent.rebate_mode || 'percentage',
                rebate_percentage: ((agent.rebate_percentage || 0) * 100).toFixed(1)
            };
            
            this.showRebateModal = true;
            this.$nextTick(() => {
                const modalEl = document.getElementById('rebateSettingsModal');
                if (modalEl) {
                    this.rebateSettingsModal = new bootstrap.Modal(modalEl);
                    this.rebateSettingsModal.show();
                }
            });
        },
        
        // 隐藏退水设定模態框
        hideRebateSettingsModal() {
            if (this.rebateSettingsModal) {
                this.rebateSettingsModal.hide();
            }
            this.showRebateModal = false;
        },
        
        // 更新退水设定
        async updateRebateSettings() {
            this.loading = true;
            try {
                const payload = {
                    rebate_mode: this.rebateSettings.rebate_mode
                };
                
                if (this.rebateSettings.rebate_mode === 'percentage') {
                    payload.rebate_percentage = parseFloat(this.rebateSettings.rebate_percentage) / 100;
                }
                
                const response = await axios.put(`${API_BASE_URL}/update-rebate-settings/${this.rebateAgent.id}`, payload);
                
                if (response.data.success) {
                    this.showMessage('退水设定更新成功', 'success');
                    this.hideRebateSettingsModal();
                    await this.searchAgents(); // 刷新代理列表
                } else {
                    this.showMessage(response.data.message || '更新退水设定失败', 'error');
                }
            } catch (error) {
                console.error('更新退水设定错误:', error);
                this.showMessage(error.response?.data?.message || '更新退水设定失败', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 获取退水模式文本
        getRebateModeText(mode) {
            switch (mode) {
                case 'all':
                    return '全拿退水';
                case 'none':
                    return '全退下級';
                case 'percentage':
                    return '自定比例';
                default:
                    return '未设定';
            }
        },

        // 新增：切換会员状态
        async toggleMemberStatus(memberId, currentStatus) {
            // 支援三種状态的切換：启用(1) -> 停用(0) -> 冻结(2) -> 启用(1)
            let newStatus, actionText;
            
            if (currentStatus === 1) {
                newStatus = 0;
                actionText = '停用';
            } else if (currentStatus === 0) {
                newStatus = 2;
                actionText = '冻结';
            } else {
                newStatus = 1;
                actionText = '启用';
            }
            
            if (!confirm(`确定要${actionText}該会员嗎？`)) {
                return;
            }

            this.loading = true;
            try {
                const response = await axios.post(`${API_BASE_URL}/toggle-member-status`, { memberId, status: newStatus });
                if (response.data.success) {
                    this.showMessage(`会员已${actionText}`, 'success');
                    // 更新本地会员列表中的状态
                    const member = this.members.find(m => m.id === memberId);
                    if (member) {
                        member.status = newStatus;
                    }
                    // 重新载入会员列表以確保状态同步
                    if (this.activeTab === 'members') {
                        // 在层级会员管理介面时刷新层级会员数据
                        await this.refreshHierarchicalMembers();
                    } else {
                        // 在其他介面时刷新会员列表
                        await this.searchMembers();
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
        
        // 获取状态文字
        getStatusText(status) {
            switch (parseInt(status)) {
                case 1:
                    return '启用';
                case 0:
                    return '停用';
                case 2:
                    return '冻结';
                default:
                    return '未知';
            }
        },
        
        // 获取状态徽章樣式類別
        getStatusBadgeClass(status) {
            switch (parseInt(status)) {
                case 1:
                    return 'badge bg-success'; // 绿色 - 启用
                case 0:
                    return 'badge bg-secondary'; // 灰色 - 停用
                case 2:
                    return 'badge bg-warning text-dark'; // 黄色 - 冻结
                default:
                    return 'badge bg-dark'; // 黑色 - 未知状态
            }
        },
        
        // 获取状态图标類別
        getStatusIconClass(status) {
            switch (parseInt(status)) {
                case 1:
                    return 'fa-check'; // 勾选 - 启用
                case 0:
                    return 'fa-ban'; // 禁止 - 停用
                case 2:
                    return 'fa-snowflake'; // 雪花 - 冻结
                default:
                    return 'fa-question'; // 问號 - 未知状态
            }
        },
        
        // 修改会员额度
        modifyMemberBalance(member) {
            this.modifyBalanceData.memberId = member.id;
            this.modifyBalanceData.memberUsername = member.username;
            this.modifyBalanceData.currentBalance = member.balance;
            this.modifyBalanceData.reason = '';
            this.modifyBalanceType = 'absolute';
            this.modifyBalanceAmount = 0;
            this.balanceChangeDirection = 'increase';
            
            this.$nextTick(() => {
                const modalEl = document.getElementById('modifyMemberBalanceModal');
                if (modalEl) {
                    this.modifyMemberBalanceModal = new bootstrap.Modal(modalEl);
                    this.modifyMemberBalanceModal.show();
                } else {
                    console.error('找不到修改会员额度模態框元素');
                    this.showMessage('系统错误，请稍後再試', 'error');
                }
            });
        },
        
        // 隐藏修改会员额度模態框
        hideModifyMemberBalanceModal() {
            if (this.modifyMemberBalanceModal) {
                this.modifyMemberBalanceModal.hide();
            }
        },
        
        // 计算最终修改後的会员余额
        calculateFinalModifiedBalance() {
            const currentBalance = parseFloat(this.modifyBalanceData.currentBalance) || 0;
            const modifyAmount = parseFloat(this.modifyBalanceAmount) || 0;
            
            if (this.modifyBalanceType === 'absolute') {
                return modifyAmount;
            } else {
                if (this.balanceChangeDirection === 'increase') {
                    return currentBalance + modifyAmount;
                } else {
                    return currentBalance - modifyAmount;
                }
            }
        },
        
        // 提交修改会员额度
        async submitModifyMemberBalance() {
            if (!this.modifyBalanceData.memberId || !this.modifyBalanceAmount || !this.modifyBalanceData.reason) {
                return this.showMessage('请填写完整资料', 'error');
            }
            
            // 检查修改後的金额是否合理
            const finalBalance = this.calculateFinalModifiedBalance();
            if (finalBalance < 0) {
                return this.showMessage('修改後的额度不能小於0', 'error');
            }
            
            this.loading = true;
            
            try {
                // 准备发送到後端的数据
                let requestData = {
                    memberId: this.modifyBalanceData.memberId,
                    amount: finalBalance,
                    reason: this.modifyBalanceData.reason
                };
                
                // 相对值模式下，发送相对值變化量
                if (this.modifyBalanceType === 'relative') {
                    requestData.amount = this.balanceChangeDirection === 'increase' 
                        ? this.modifyBalanceAmount 
                        : -this.modifyBalanceAmount;
                    requestData.isRelative = true;
                } else {
                    requestData.isRelative = false;
                }
                
                const response = await axios.post(`${API_BASE_URL}/modify-member-balance`, requestData);
                
                if (response.data.success) {
                    this.showMessage('会员额度修改成功', 'success');
                    this.hideModifyMemberBalanceModal();
                    // 根据当前介面决定刷新方式
                    if (this.activeTab === 'members') {
                        // 在层级会员管理介面时刷新层级会员数据
                        await this.refreshHierarchicalMembers();
                    } else {
                        // 在其他介面时刷新会员列表
                        this.searchMembers();
                    }
                } else {
                    this.showMessage(response.data.message || '会员额度修改失败', 'error');
                }
            } catch (error) {
                console.error('修改会员额度错误:', error);
                this.showMessage(error.response?.data?.message || '会员额度修改失败，请稍後再試', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 删除会员
        async deleteMember(memberId, username) {
            if (!confirm(`⚠️ 警告：确定要永久删除会员 ${username} 嗎？\n\n此操作將：\n✓ 完全從系统中移除該会员\n✓ 無法恢复任何数据\n✓ 必须确保会员余额为0\n\n请确认您真的要执行此不可逆操作！`)) {
                return;
            }
            
            this.loading = true;
            
            try {
                const response = await axios.delete(`${API_BASE_URL}/delete-member/${memberId}`);
                
                if (response.data.success) {
                    this.showMessage('会员删除成功', 'success');
                    // 根据当前介面决定刷新方式
                    if (this.activeTab === 'members') {
                        // 在层级会员管理介面时刷新层级会员数据
                        await this.refreshHierarchicalMembers();
                    } else {
                        // 在其他介面时刷新会员列表
                        this.searchMembers();
                    }
                } else {
                    this.showMessage(response.data.message || '会员删除失败', 'error');
                }
            } catch (error) {
                console.error('删除会员错误:', error);
                // 提取具体的错误信息
                let errorMessage = '会员删除失败，请稍後再試';
                if (error.response?.data?.message) {
                    errorMessage = error.response.data.message;
                } else if (error.message) {
                    errorMessage = error.message;
                }
                this.showMessage(errorMessage, 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 代理额度修改相关方法
        adjustAgentBalance(agent) {
            // 设置要修改的代理资料
            this.agentBalanceData = {
                agentId: agent.id,
                agentUsername: agent.username,
                currentBalance: agent.balance,
                description: ''
            };
            
            // 设置默认值
            this.agentTransferType = 'deposit';
            this.agentTransferAmount = 0;
            
            console.log('代理点数转移数据准备完成:', {
                agent: agent,
                user: this.user,
                agentBalanceData: this.agentBalanceData
            });
            
            // 使用Bootstrap 5标准方式显示模態框
            const modalElement = document.getElementById('adjustAgentBalanceModal');
            if (!modalElement) {
                console.error('找不到模態框元素');
                return this.showMessage('系统错误：找不到模態框元素', 'error');
            }
            
            // 直接使用Bootstrap 5的Modal方法
            const modal = new bootstrap.Modal(modalElement);
            this.adjustAgentBalanceModal = modal;
            modal.show();
        },
        
        // 计算最终下級代理余额
        calculateFinalSubAgentBalance() {
            // 确保使用有效數值
            const currentBalance = parseFloat(this.agentBalanceData?.currentBalance) || 0;
            const transferAmount = parseFloat(this.agentTransferAmount) || 0;
            
            if (this.agentTransferType === 'deposit') {
                return currentBalance + transferAmount;
            } else {
                return currentBalance - transferAmount;
            }
        },
        
        // 计算最终上級代理(自己)余额
        calculateFinalParentAgentBalance() {
            // 确保使用有效數值
            const currentBalance = parseFloat(this.user.balance) || 0;
            const transferAmount = parseFloat(this.agentTransferAmount) || 0;
            
            if (this.agentTransferType === 'deposit') {
                return currentBalance - transferAmount;
            } else {
                return currentBalance + transferAmount;
            }
        },

        // 设置最大转移金额（代理点数转移）
        setMaxAgentAmount() {
            if (this.agentTransferType === 'deposit') {
                // 存入：使用上級代理（自己）的全部余额
                this.agentTransferAmount = parseFloat(this.user.balance) || 0;
            } else if (this.agentTransferType === 'withdraw') {
                // 提领：使用下級代理的全部余额
                this.agentTransferAmount = parseFloat(this.agentBalanceData.currentBalance) || 0;
            }
        },
        
        // 切換代理状态
        async toggleAgentStatus(agent) {
            // 支援三種状态的切換：启用(1) -> 停用(0) -> 冻结(2) -> 启用(1)
            let newStatus, actionText;
            
            if (agent.status === 1) {
                newStatus = 0;
                actionText = '停用';
            } else if (agent.status === 0) {
                newStatus = 2;
                actionText = '冻结';
            } else {
                newStatus = 1;
                actionText = '启用';
            }
            
            if (!confirm(`确定要${actionText}該代理嗎？`)) {
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
                    // 更新本地代理列表中的状态
                    const agentInList = this.agents.find(a => a.id === agent.id);
                    if (agentInList) {
                        agentInList.status = newStatus;
                    }
                    // 根据当前介面决定刷新方式
                    if (this.activeTab === 'members') {
                        // 在层级会员管理介面时刷新层级会员数据
                        await this.refreshHierarchicalMembers();
                    } else {
                        // 在其他介面时刷新代理列表
                        this.searchAgents();
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

        // 直接设定代理状态（新的下拉选單功能）
        async changeAgentStatus(agent, newStatus) {
            const statusNames = { 1: '启用', 0: '停用', 2: '冻结' };
            const actionText = statusNames[newStatus];
            
            if (!confirm(`确定要将代理 ${agent.username} 设为${actionText}状态嗎？`)) {
                return;
            }

            this.loading = true;
            try {
                const response = await axios.post(`${API_BASE_URL}/toggle-agent-status`, { 
                    agentId: agent.id, 
                    status: newStatus 
                });
                
                if (response.data.success) {
                    this.showMessage(`代理已设为${actionText}`, 'success');
                    // 更新本地代理列表中的状态
                    const agentInList = this.agents.find(a => a.id === agent.id);
                    if (agentInList) {
                        agentInList.status = newStatus;
                    }
                    // 根据当前介面决定刷新方式
                    if (this.activeTab === 'members') {
                        // 在层级会员管理介面时刷新层级会员数据
                        await this.refreshHierarchicalMembers();
                    } else {
                        // 在其他介面时刷新代理列表
                        this.searchAgents();
                    }
                } else {
                    this.showMessage(response.data.message || `设置代理状态失败`, 'error');
                }
            } catch (error) {
                console.error(`设置代理状态出錯:`, error);
                this.showMessage(error.response?.data?.message || `设置代理状态失败，请稍後再試`, 'error');
            } finally {
                this.loading = false;
            }
        },

        // 直接设定会员状态（新的下拉选單功能）
        async changeMemberStatus(member, newStatus) {
            const statusNames = { 1: '启用', 0: '停用', 2: '冻结' };
            const actionText = statusNames[newStatus];
            
            if (!confirm(`确定要将会员 ${member.username} 设为${actionText}状态嗎？`)) {
                return;
            }

            this.loading = true;
            try {
                const response = await axios.post(`${API_BASE_URL}/toggle-member-status`, { 
                    memberId: member.id, 
                    status: newStatus 
                });
                
                if (response.data.success) {
                    this.showMessage(`会员已设为${actionText}`, 'success');
                    // 更新本地会员列表中的状态
                    const memberInList = this.members.find(m => m.id === member.id);
                    if (memberInList) {
                        memberInList.status = newStatus;
                    }
                    // 根据当前介面决定刷新方式
                    if (this.activeTab === 'members') {
                        // 在层级会员管理介面时刷新层级会员数据
                        await this.refreshHierarchicalMembers();
                    } else {
                        // 在其他介面时刷新会员列表
                        await this.searchMembers();
                    }
                } else {
                    this.showMessage(response.data.message || `设置会员状态失败`, 'error');
                }
            } catch (error) {
                console.error(`设置会员状态出錯:`, error);
                this.showMessage(error.response?.data?.message || `设置会员状态失败，请稍後再試`, 'error');
            } finally {
                this.loading = false;
            }
        },

        // 编辑代理备注
        editAgentNotes(agent) {
            console.log('editAgentNotes 方法被調用，agent:', agent);
            
            this.editNotesData = {
                id: agent.id,
                username: agent.username,
                notes: agent.notes || '',
                type: 'agent'
            };
            
            // 確保在下一个tick执行，让Vue完成渲染
            this.$nextTick(() => {
                // 使用已初始化的Modal實例，如果沒有則重新创建
                if (!this.editAgentNotesModal) {
                    const modalEl = document.getElementById('editAgentNotesModal');
                    if (modalEl) {
                        // 检查Bootstrap是否可用
                        if (typeof bootstrap === 'undefined') {
                            console.error('Bootstrap未加载');
                            this.showMessage('系统組件未完全加载，请重新整理页面', 'error');
                            return;
                        }
                        this.editAgentNotesModal = new bootstrap.Modal(modalEl);
                    } else {
                        console.error('找不到editAgentNotesModal元素');
                        this.showMessage('系统错误，请重新整理页面', 'error');
                        return;
                    }
                }
                
                try {
                    this.editAgentNotesModal.show();
                } catch (error) {
                    console.error('显示Modal时出錯:', error);
                    this.showMessage('無法打开备注编辑視窗，请重新整理页面', 'error');
                }
            });
        },

        // 隐藏编辑代理备注模態框
        hideEditAgentNotesModal() {
            if (this.editAgentNotesModal) {
                this.editAgentNotesModal.hide();
            }
            this.editNotesData = {
                id: null,
                username: '',
                notes: '',
                type: ''
            };
        },

        // 更新代理备注
        async updateAgentNotes() {
            if (!this.editNotesData.id) {
                this.showMessage('无效的代理ID', 'error');
                return;
            }

            this.loading = true;
            try {
                const response = await axios.post(`${API_BASE_URL}/update-agent-notes`, {
                    agentId: this.editNotesData.id,
                    notes: this.editNotesData.notes || ''
                });

                if (response.data.success) {
                    this.showMessage('代理备注更新成功', 'success');
                    
                    // 更新本地代理列表中的备注
                    const agentInList = this.agents.find(a => a.id === this.editNotesData.id);
                    if (agentInList) {
                        agentInList.notes = this.editNotesData.notes;
                    }
                    
                    this.hideEditAgentNotesModal();
                    // 根据当前介面决定刷新方式
                    if (this.activeTab === 'members') {
                        // 在层级会员管理介面时刷新层级会员数据
                        await this.refreshHierarchicalMembers();
                    } else {
                        // 在其他介面时刷新代理列表
                        this.searchAgents();
                    }
                } else {
                    this.showMessage(response.data.message || '更新代理备注失败', 'error');
                }
            } catch (error) {
                console.error('更新代理备注错误:', error);
                this.showMessage(error.response?.data?.message || '更新代理备注失败，请稍後再試', 'error');
            } finally {
                this.loading = false;
            }
        },

        // 编辑会员备注
        editMemberNotes(member) {
            console.log('🔧 editMemberNotes 方法被調用，member:', member);
            
            // 重置loading状态
            this.loading = false;
            
            // 確保数据设置正確
            this.editNotesData = {
                id: member.id,
                username: member.username,
                notes: member.notes || '',
                type: 'member'
            };
            
            console.log('🔧 设置editNotesData:', this.editNotesData);
            
            // 使用Vue.js反应式方式显示模態框
            this.showEditMemberNotesModal = true;
            
            // 添加背景和防止滾動
            this.$nextTick(() => {
                // 添加模態框背景
                if (!document.querySelector('.modal-backdrop')) {
                    const backdrop = document.createElement('div');
                    backdrop.className = 'modal-backdrop fade show';
                    document.body.appendChild(backdrop);
                }
                
                // 防止背景滾動
                document.body.classList.add('modal-open');
                document.body.style.paddingRight = '17px';
                
                console.log('🔧 会员备注模態框已显示，Vue綁定應該正常工作');
            });
        },

        // 隐藏编辑会员备注模態框
        hideEditMemberNotesModal() {
            console.log('🔧 hideEditMemberNotesModal 方法被調用');
            
            // 重置Vue.js状态
            this.showEditMemberNotesModal = false;
            this.loading = false;
            
            // 移除模態框背景和body樣式
            document.body.classList.remove('modal-open');
            document.body.style.paddingRight = '';
            const backdrop = document.querySelector('.modal-backdrop');
            if (backdrop) {
                backdrop.remove();
            }
            
            // 清理编辑数据
            this.editNotesData = {
                id: null,
                username: '',
                notes: '',
                type: ''
            };
            
            console.log('🔧 会员备注模態框已隐藏，数据已重置');
        },

        // 更新会员备注
        async updateMemberNotes() {
            if (!this.editNotesData.id) {
                this.showMessage('无效的会员ID', 'error');
                return;
            }

            this.loading = true;
            try {
                const response = await axios.post(`${API_BASE_URL}/update-member-notes`, {
                    memberId: this.editNotesData.id,
                    notes: this.editNotesData.notes || ''
                });

                if (response.data.success) {
                    this.showMessage('会员备注更新成功', 'success');
                    
                    // 更新本地会员列表中的备注
                    const memberInList = this.members.find(m => m.id === this.editNotesData.id);
                    if (memberInList) {
                        memberInList.notes = this.editNotesData.notes;
                    }
                    
                    this.hideEditMemberNotesModal();
                    
                    // 根据当前介面决定刷新方式
                    if (this.activeTab === 'members') {
                        // 在层级会员管理介面时刷新层级会员数据
                        await this.refreshHierarchicalMembers();
                    } else {
                        // 在其他介面时刷新会员列表
                        await this.searchMembers();
                    }
                } else {
                    this.showMessage(response.data.message || '更新会员备注失败', 'error');
                }
            } catch (error) {
                console.error('更新会员备注错误:', error);
                this.showMessage(error.response?.data?.message || '更新会员备注失败，请稍後再試', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 隐藏代理额度修改模態框
        hideAdjustAgentBalanceModal() {
            console.log('嘗試隐藏代理点数转移模態框');
            try {
                if (this.adjustAgentBalanceModal) {
                    console.log('找到模態框實例，嘗試隐藏');
                    this.adjustAgentBalanceModal.hide();
                    console.log('模態框隐藏方法已調用');
                } else {
                    console.log('找不到模態框實例，嘗試手動隐藏');
                    const modalEl = document.getElementById('adjustAgentBalanceModal');
                    if (modalEl) {
                        modalEl.style.display = 'none';
                        modalEl.classList.remove('show');
                        document.body.classList.remove('modal-open');
                        const backdrop = document.querySelector('.modal-backdrop');
                        if (backdrop) backdrop.remove();
                        console.log('已手動隐藏模態框');
                    }
                }
            } catch (error) {
                console.error('隐藏模態框时出錯:', error);
            }
        },
        
        // 计算最终代理余额（代理额度修改用）
        calculateFinalAgentBalance() {
            const currentBalance = parseFloat(this.agentBalanceData.currentBalance) || 0;
            const modifyAmount = parseFloat(this.agentModifyAmount) || 0;
            
            if (this.agentModifyType === 'absolute') {
                return modifyAmount;
            } else {
                if (this.agentChangeDirection === 'increase') {
                    return currentBalance + modifyAmount;
                } else {
                    return currentBalance - modifyAmount;
                }
            }
        },
        
        // 提交代理额度修改
        async submitAgentBalanceAdjustment() {
            console.log('嘗試提交代理点数转移');
            if (!this.agentBalanceData.agentId || !this.agentTransferAmount) {
                console.log('资料不完整:', {
                    agentId: this.agentBalanceData.agentId,
                    transferAmount: this.agentTransferAmount,
                    description: this.agentBalanceData.description
                });
                return this.showMessage('请填写转移金额', 'error');
            }
            
            this.loading = true;
            console.log('开始提交代理点数转移数据');
            
            try {
                // 准备要傳送的数据
                const payload = {
                    agentId: this.user.id,  // 当前代理ID（来源或目标）
                    subAgentId: this.agentBalanceData.agentId,  // 下級代理ID
                    amount: this.agentTransferType === 'deposit' ? this.agentTransferAmount : -this.agentTransferAmount, // 根据类型调整金额正負
                    type: this.agentTransferType, // 转移类型 'deposit' 或 'withdraw'
                    description: this.agentBalanceData.description
                };

                console.log('准备发送的数据:', payload);
                const response = await axios.post(`${API_BASE_URL}/transfer-agent-balance`, payload);
                console.log('伺服器返回结果:', response.data);
                
                if (response.data.success) {
                    this.showMessage('代理点数转移成功', 'success');
                    // 更新前端显示的代理余额
                    this.user.balance = response.data.parentBalance;
                    // 同时更新localStorage中的用戶资讯
                    localStorage.setItem('agent_user', JSON.stringify(this.user));
                    // 根据当前介面决定刷新方式
                    if (this.activeTab === 'members') {
                        // 在层级会员管理介面时刷新层级会员数据
                        await this.refreshHierarchicalMembers();
                    } else {
                        // 在其他介面时刷新代理列表
                        this.searchAgents();
                    }
                    this.hideAdjustAgentBalanceModal(); // 关闭模態框
                    await this.fetchDashboardData(); // 更新儀表板数据
                } else {
                    this.showMessage(response.data.message || '代理点数转移失败', 'error');
                }
            } catch (error) {
                console.error('提交代理点数转移错误:', error);
                this.showMessage(error.response?.data?.message || '代理点数转移失败，请稍後再試', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 删除代理
        async deleteAgent(agentId, username) {
            if (!confirm(`⚠️ 警告：确定要永久删除代理 ${username} 嗎？\n\n此操作將：\n✓ 完全從系统中移除該代理\n✓ 無法恢复任何数据\n✓ 必须确保代理余额为0且無下級代理/会员\n\n请确认您真的要执行此不可逆操作！`)) {
                return;
            }
            
            this.loading = true;
            
            try {
                const response = await axios.delete(`${API_BASE_URL}/delete-agent/${agentId}`);
                
                if (response.data.success) {
                    this.showMessage('代理删除成功', 'success');
                    // 根据当前介面决定刷新方式
                    if (this.activeTab === 'members') {
                        // 在层级会员管理介面时刷新层级会员数据
                        await this.refreshHierarchicalMembers();
                    } else {
                        // 在其他介面时刷新代理列表
                        this.searchAgents();
                    }
                } else {
                    this.showMessage(response.data.message || '代理删除失败', 'error');
                }
            } catch (error) {
                console.error('删除代理错误:', error);
                // 提取具体的错误信息
                let errorMessage = '代理删除失败，请稍後再試';
                if (error.response?.data?.message) {
                    errorMessage = error.response.data.message;
                } else if (error.message) {
                    errorMessage = error.message;
                }
                this.showMessage(errorMessage, 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 改變页碼
        changePage(page, type) {
            if (page < 1) return;
            
            switch (type) {
                case 'agents':
                    if (page > this.agentPagination.totalPages) return;
                    this.agentPagination.currentPage = page;
                    this.searchAgents();
                    break;
                case 'members':
                    if (page > this.memberPagination.totalPages) return;
                    this.memberPagination.currentPage = page;
                    this.searchMembers();
                    break;
                case 'draw':
                    if (page > this.drawPagination.totalPages) return;
                    this.drawPagination.currentPage = page;
                    this.searchDrawHistory();
                    break;
                case 'bets':
                    if (page > this.betPagination.totalPages) return;
                    this.betPagination.currentPage = page;
                    this.searchBets();
                    break;
                default:
                    console.warn('未知的分页类型:', type);
            }
        },
        
        // 格式化佣金比例显示

        
        // 格式化投注选项显示
        formatBetValue(value) {
            if (!value) return '-';
            
            // 处理龙虎投注格式：dragon_1_10 -> 龙(冠军vs第10名)
            if (value && value.includes('_')) {
                const parts = value.split('_');
                if (parts.length === 3 && (parts[0] === 'dragon' || parts[0] === 'tiger')) {
                    const dragonTiger = parts[0] === 'dragon' ? '龙' : '虎';
                    const pos1 = parts[1] === '1' ? '冠军' : parts[1] === '2' ? '亚军' : `第${parts[1]}名`;
                    const pos2 = parts[2] === '10' ? '第十名' : `第${parts[2]}名`;
                    return `${dragonTiger}(${pos1}vs${pos2})`;
                }
            }
            
            const valueMap = {
                // 大小
                'big': '大',
                'small': '小',
                // 單双
                'odd': '單',
                'even': '双',
                // 龙虎
                'dragon': '龙',
                'tiger': '虎',
                // 和值相关
                'sumBig': '总和大',
                'sumSmall': '总和小',
                'sumOdd': '总和單',
                'sumEven': '总和双',
            };
            
            // 如果是純數字，直接返回
            if (!isNaN(value) && !isNaN(parseFloat(value))) {
                return value;
            }
            
            // 查找对應的中文翻譯
            return valueMap[value] || value;
        },
        
        // 客服專用方法
        async loadAllAgents() {
            try {
                this.loading = true;
                console.log('开始加载所有代理...');
                // 递歸获取所有代理
                const response = await axios.get(`${API_BASE_URL}/sub-agents`, {
                    params: {
                        parentId: '', // 空值获取所有代理
                        level: -1,
                        status: -1,
                        page: 1,
                        limit: 1000 // 设置较大的limit获取所有代理
                    }
                });
                
                console.log('API响应:', response.data);
                
                if (response.data.success) {
                    this.allAgents = response.data.data.list || [];
                    console.log('加载所有代理成功:', this.allAgents.length, this.allAgents);
                    
                    // 确保每个代理都有正确的属性
                    this.allAgents.forEach((agent, index) => {
                        console.log(`代理 ${index}:`, {
                            id: agent.id,
                            username: agent.username,
                            level: agent.level,
                            balance: agent.balance,
                            levelName: this.getLevelName(agent.level),
                            formattedBalance: this.formatMoney(agent.balance)
                        });
                        
                        // 确保数据类型正确
                        agent.balance = parseFloat(agent.balance) || 0;
                        agent.level = parseInt(agent.level) || 0;
                    });
                    
                    // 手動更新代理选择下拉列表
                    this.updateAgentSelect();
                } else {
                    console.error('API返回失败:', response.data.message);
                    this.showMessage('加载代理列表失败', 'error');
                }
            } catch (error) {
                console.error('加载所有代理出錯:', error);
                this.showMessage('加载代理列表出錯', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        async loadCSTransactions(page = 1) {
            if (!this.isCustomerService) return;
            
            try {
                this.loading = true;
                // 确保 page 是一个有效的數字
                const pageNum = parseInt(page) || 1;
                const response = await axios.get(`${API_BASE_URL}/cs-transactions`, {
                    params: {
                        operatorId: this.user.id,
                        page: pageNum,
                        limit: this.csTransactionsPagination.limit,
                        userType: this.csTransactionFilters.userType,
                        transactionType: this.csTransactionFilters.transactionType
                    }
                });
                
                if (response.data.success) {
                    this.csTransactions = response.data.data.list || [];
                    this.csTransactionsPagination = {
                        page: response.data.data.page,
                        limit: response.data.data.limit,
                        total: response.data.data.total
                    };
                    console.log('加载客服交易记录成功:', this.csTransactions.length);
                } else {
                    this.showMessage(response.data.message || '加载客服交易记录失败', 'error');
                }
            } catch (error) {
                console.error('加载客服交易记录出錯:', error);
                this.showMessage('加载客服交易记录出錯', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 输赢控制相关方法
        
        // 载入输赢控制列表
        async loadWinLossControls(page = 1) {
            try {
                this.loading = true;
                console.log('载入输赢控制列表...');
                
                // 🔧 確保认证標头设置正確
                const headers = {};
                const sessionToken = localStorage.getItem('agent_session_token');
                const legacyToken = localStorage.getItem('agent_token');
                
                if (sessionToken) {
                    headers['x-session-token'] = sessionToken;
                    headers['X-Session-Token'] = sessionToken; // 確保大小写兼容
                }
                if (legacyToken) {
                    headers['Authorization'] = legacyToken;
                }
                
                console.log('🔐 使用认证標头:', { hasSessionToken: !!sessionToken, hasLegacyToken: !!legacyToken });
                
                const response = await axios.get(`${API_BASE_URL}/win-loss-control?page=${page}&limit=20`, { headers });
                
                if (response.data.success) {
                    this.winLossControls = response.data.data || [];
                    console.log('输赢控制列表载入成功:', this.winLossControls.length, '项记录');
                    
                    // 同时载入当前活躍控制、用戶清单和期數信息
                    await Promise.all([
                        this.loadActiveWinLossControl(),
                        this.loadAvailableAgents(),
                        this.loadAvailableMembers(),
                        this.loadCurrentPeriod()
                    ]);
                } else {
                    console.error('载入输赢控制列表失败:', response.data.message);
                    this.showMessage('载入控制列表失败: ' + response.data.message, 'error');
                }
            } catch (error) {
                console.error('载入输赢控制列表错误:', error);
                
                // 🔧 特殊处理401错误
                if (error.response?.status === 401) {
                    console.warn('⚠️ 认证失败，嘗試重新认证...');
                    this.showMessage('会话已过期，请重新登入', 'warning');
                    
                    // 清除过期的认证信息
                    delete axios.defaults.headers.common['Authorization'];
                    delete axios.defaults.headers.common['x-session-token'];
                    
                    // 提示用戶重新登入
                    setTimeout(() => {
                        this.logout();
                    }, 2000);
                } else {
                    this.showMessage('载入控制列表时發生错误', 'error');
                }
            } finally {
                this.loading = false;
            }
        },
        
        // 载入可用代理清单
        async loadAvailableAgents() {
            try {
                // 🔧 確保认证標头设置正確
                const headers = {};
                const sessionToken = localStorage.getItem('agent_session_token');
                const legacyToken = localStorage.getItem('agent_token');
                
                if (sessionToken) {
                    headers['x-session-token'] = sessionToken;
                    headers['X-Session-Token'] = sessionToken;
                }
                if (legacyToken) {
                    headers['Authorization'] = legacyToken;
                }
                
                const response = await axios.get(`${API_BASE_URL}/win-loss-control/agents`, { headers });
                if (response.data.success) {
                    this.availableAgents = response.data.data || [];
                    console.log('载入代理清单成功:', this.availableAgents.length, '个代理');
                }
            } catch (error) {
                console.error('载入代理清单错误:', error);
            }
        },
        
        // 载入可用会员清单
        async loadAvailableMembers() {
            try {
                // 🔧 確保认证標头设置正確
                const headers = {};
                const sessionToken = localStorage.getItem('agent_session_token');
                const legacyToken = localStorage.getItem('agent_token');
                
                if (sessionToken) {
                    headers['x-session-token'] = sessionToken;
                    headers['X-Session-Token'] = sessionToken;
                }
                if (legacyToken) {
                    headers['Authorization'] = legacyToken;
                }
                
                const response = await axios.get(`${API_BASE_URL}/win-loss-control/members`, { headers });
                if (response.data.success) {
                    this.availableMembers = response.data.data || [];
                    console.log('载入会员清单成功:', this.availableMembers.length, '个会员');
                }
            } catch (error) {
                console.error('载入会员清单错误:', error);
            }
        },
        
        // 载入当前期數信息
        async loadCurrentPeriod() {
            try {
                const response = await axios.get(`${API_BASE_URL}/win-loss-control/current-period`);
                if (response.data.success) {
                    this.currentPeriodInfo = response.data.data;
                    // 自動设定建议的开始期數
                    this.newWinLossControl.start_period = this.currentPeriodInfo.suggested_start;
                    console.log('载入期數信息成功:', this.currentPeriodInfo);
                }
            } catch (error) {
                console.error('载入期數信息错误:', error);
            }
        },
        
        // 载入当前活躍的输赢控制
        async loadActiveWinLossControl() {
            try {
                // 🔧 確保认证標头设置正確
                const headers = {};
                const sessionToken = localStorage.getItem('agent_session_token');
                const legacyToken = localStorage.getItem('agent_token');
                
                if (sessionToken) {
                    headers['x-session-token'] = sessionToken;
                    headers['X-Session-Token'] = sessionToken;
                }
                if (legacyToken) {
                    headers['Authorization'] = legacyToken;
                }
                
                const response = await axios.get(`${API_BASE_URL}/win-loss-control/active`, { headers });
                
                if (response.data.success) {
                    this.activeWinLossControl = response.data.data || { control_mode: 'normal', is_active: false };
                    console.log('当前活躍控制:', this.activeWinLossControl);
                } else {
                    console.error('载入活躍控制失败:', response.data.message);
                }
            } catch (error) {
                console.error('载入活躍控制错误:', error);
            }
        },
        
        // 创建输赢控制
        async createWinLossControl() {
            try {
                this.loading = true;
                console.log('创建输赢控制:', this.newWinLossControl);
                
                const response = await axios.post(`${API_BASE_URL}/win-loss-control`, this.newWinLossControl);
                
                if (response.data.success) {
                    this.showMessage('输赢控制设定成功', 'success');
                    
                    // 重新载入列表和活躍控制
                    await this.loadWinLossControls();
                    
                    // 重置表單
                    this.newWinLossControl = {
                        control_mode: 'normal',
                        target_type: '',
                        target_username: '',
                        control_percentage: 50,
                        win_control: false,
                        loss_control: false,
                        start_period: this.currentPeriodInfo.suggested_start
                    };
                } else {
                    this.showMessage('设定失败: ' + response.data.message, 'error');
                }
            } catch (error) {
                console.error('创建输赢控制错误:', error);
                this.showMessage('设定时發生错误', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 启用输赢控制
        async activateWinLossControl(controlId) {
            try {
                console.log('启用输赢控制:', controlId);
                
                const response = await axios.put(`${API_BASE_URL}/win-loss-control/${controlId}`, {
                    is_active: true
                });
                
                if (response.data.success) {
                    this.showMessage('控制已启用', 'success');
                    await this.loadWinLossControls();
                } else {
                    this.showMessage('启用失败: ' + response.data.message, 'error');
                }
            } catch (error) {
                console.error('启用输赢控制错误:', error);
                this.showMessage('启用时發生错误', 'error');
            }
        },
        
        // 停用输赢控制
        async deactivateWinLossControl(controlId) {
            try {
                console.log('停用输赢控制:', controlId);
                
                const response = await axios.put(`${API_BASE_URL}/win-loss-control/${controlId}`, {
                    is_active: false
                });
                
                if (response.data.success) {
                    this.showMessage('控制已停用', 'success');
                    await this.loadWinLossControls();
                } else {
                    this.showMessage('停用失败: ' + response.data.message, 'error');
                }
            } catch (error) {
                console.error('停用输赢控制错误:', error);
                this.showMessage('停用时發生错误', 'error');
            }
        },
        
        // 删除输赢控制
        async deleteWinLossControl(controlId) {
            try {
                if (!confirm('确定要删除此输赢控制设定嗎？')) {
                    return;
                }
                
                console.log('删除输赢控制:', controlId);
                
                const response = await axios.delete(`${API_BASE_URL}/win-loss-control/${controlId}`);
                
                if (response.data.success) {
                    this.showMessage('控制设定已删除', 'success');
                    await this.loadWinLossControls();
                } else {
                    this.showMessage('删除失败: ' + response.data.message, 'error');
                }
            } catch (error) {
                console.error('删除输赢控制错误:', error);
                this.showMessage('删除时發生错误', 'error');
            }
        },
        
        // 获取控制模式文字
        getControlModeText(mode) {
            const modes = {
                'normal': '正常機率',
                'agent_line': '代理線控制',
                'single_member': '單会员控制',
                'auto_detect': '自動偵測控制'
            };
            return modes[mode] || mode;
        },
        
        // 显示客服操作模態框
        async showCSOperationModalFunc() {
            console.log('=== 开始显示客服操作模態框 ===');
            
            // 重置表單数据
            this.csOperation = {
                targetAgentId: '',
                operationTarget: '',
                targetMemberId: '',
                transferType: '',
                amount: '',
                description: ''
            };
            this.agentMembers = [];
            
            console.log('当前allAgents数量:', this.allAgents.length);
            
            // 确保代理列表已加载
            if (this.allAgents.length === 0) {
                console.log('代理列表为空，开始加载...');
                await this.loadAllAgents();
            }
            
            console.log('加载後allAgents数量:', this.allAgents.length);
            console.log('allAgents内容:', this.allAgents);
            
            // 手動更新代理选择列表
            this.updateAgentSelect();
            
            // 显示模態框
            if (this.csOperationModal) {
                this.csOperationModal.show();
            } else {
                // 如果模態框还沒初始化，先初始化再显示
                const csOperationModalEl = document.getElementById('csOperationModal');
                if (csOperationModalEl) {
                    this.csOperationModal = new bootstrap.Modal(csOperationModalEl);
                    this.csOperationModal.show();
                }
            }
            
            // 设置初始操作对象（默认为代理）
            setTimeout(() => {
                const targetAgent = document.getElementById('csTargetAgent');
                if (targetAgent) {
                    targetAgent.checked = true;
                    this.csOperation.operationTarget = 'agent';
                    this.onOperationTargetChange();
                }
            }, 200);
            
            // 添加事件監聽器
            setTimeout(() => {
                const targetAgent = document.getElementById('csTargetAgent');
                const targetMember = document.getElementById('csTargetMember');
                const agentSelect = document.getElementById('agentSelect');
                const memberSelect = document.getElementById('memberSelect');
                const amountInput = document.getElementById('amountInput');
                const depositRadio = document.getElementById('csDeposit');
                const withdrawRadio = document.getElementById('csWithdraw');
                
                // 移除之前的事件監聽器（避免重复）
                if (targetAgent) {
                    targetAgent.removeEventListener('change', this.handleOperationTargetChange);
                    targetAgent.addEventListener('change', this.handleOperationTargetChange.bind(this));
                }
                if (targetMember) {
                    targetMember.removeEventListener('change', this.handleOperationTargetChange);
                    targetMember.addEventListener('change', this.handleOperationTargetChange.bind(this));
                }
                if (agentSelect) {
                    agentSelect.removeEventListener('change', this.handleAgentSelectionChange);
                    agentSelect.addEventListener('change', this.handleAgentSelectionChange.bind(this));
                }
                if (memberSelect) {
                    memberSelect.removeEventListener('change', this.handleMemberSelectionChange);
                    memberSelect.addEventListener('change', this.handleMemberSelectionChange.bind(this));
                }
                if (amountInput) {
                    amountInput.removeEventListener('input', this.handleAmountChange);
                    amountInput.addEventListener('input', this.handleAmountChange.bind(this));
                }
                if (depositRadio) {
                    depositRadio.removeEventListener('change', this.handleTransferTypeChange);
                    depositRadio.addEventListener('change', this.handleTransferTypeChange.bind(this));
                }
                if (withdrawRadio) {
                    withdrawRadio.removeEventListener('change', this.handleTransferTypeChange);
                    withdrawRadio.addEventListener('change', this.handleTransferTypeChange.bind(this));
                }
                
                // 添加表單提交事件監聽器
                const submitBtn = document.getElementById('csOperationSubmitBtn');
                if (submitBtn) {
                    submitBtn.removeEventListener('click', this.handleSubmitCSOperation);
                    submitBtn.addEventListener('click', this.handleSubmitCSOperation.bind(this));
                }
                
                console.log('事件監聽器已添加');
            }, 300);
            
            console.log('=== 客服操作模態框显示完成 ===');
        },
        
        // 事件处理器方法
        handleOperationTargetChange() {
            this.onOperationTargetChange();
        },
        
        handleAgentSelectionChange() {
            this.onAgentSelectionChange();
        },
        
        handleMemberSelectionChange() {
            const memberSelect = document.getElementById('memberSelect');
            const memberId = memberSelect ? memberSelect.value : '';
            this.csOperation.targetMemberId = memberId;
            this.updateCurrentBalanceDisplay();
        },
        
        handleAmountChange() {
            const amountInput = document.getElementById('amountInput');
            this.csOperation.amount = amountInput ? amountInput.value : '';
            this.updateFinalBalanceDisplay();
        },
        
        handleTransferTypeChange() {
            const depositRadio = document.getElementById('csDeposit');
            const withdrawRadio = document.getElementById('csWithdraw');
            
            if (depositRadio && depositRadio.checked) {
                this.csOperation.transferType = 'deposit';
            } else if (withdrawRadio && withdrawRadio.checked) {
                this.csOperation.transferType = 'withdraw';
            }
            this.updateFinalBalanceDisplay();
        },
        
        handleSubmitCSOperation() {
            console.log('处理表單提交');
            // 防止重复提交
            const submitBtn = document.getElementById('csOperationSubmitBtn');
            const spinner = document.getElementById('csOperationSpinner');
            
            if (submitBtn.disabled) {
                console.log('按钮已禁用，防止重复提交');
                return;
            }
            
            // 验证表單
            if (!this.isValidCSOperation) {
                console.log('表單验证失败');
                this.showMessage('请填写完整的操作信息', 'error');
                return;
            }
            
            // 显示载入状态
            submitBtn.disabled = true;
            spinner.style.display = 'inline-block';
            
            // 調用提交方法
            this.submitCSOperation().finally(() => {
                // 恢復按钮状态
                submitBtn.disabled = false;
                spinner.style.display = 'none';
            });
        },
        
        hideCSOperationModal() {
            this.showCSOperationModal = false;
            this.csOperation = {
                targetAgentId: '',
                operationTarget: '',
                targetMemberId: '',
                transferType: '',
                amount: '',
                description: ''
            };
            this.agentMembers = [];
        },
        
        // 操作对象變化时的处理
        async onOperationTargetChange() {
            const targetAgent = document.getElementById('csTargetAgent');
            const targetMember = document.getElementById('csTargetMember');
            
            let operationTarget = '';
            if (targetAgent && targetAgent.checked) {
                operationTarget = 'agent';
            } else if (targetMember && targetMember.checked) {
                operationTarget = 'member';
            }
            
            console.log('操作对象變化:', operationTarget);
            this.csOperation.operationTarget = operationTarget;
            
            // 重置会员选择和操作相关欄位（但保留代理选择）
            this.csOperation.targetMemberId = '';
            this.csOperation.transferType = '';
            this.csOperation.amount = '';
            this.agentMembers = [];
            
            // 清空表單
            const memberSelect = document.getElementById('memberSelect');
            const amountInput = document.getElementById('amountInput');
            const currentBalanceInput = document.getElementById('currentBalanceInput');
            const finalBalanceInput = document.getElementById('finalBalanceInput');
            const depositRadio = document.getElementById('csDeposit');
            const withdrawRadio = document.getElementById('csWithdraw');
            
            if (memberSelect) memberSelect.value = '';
            if (amountInput) amountInput.value = '';
            if (currentBalanceInput) currentBalanceInput.value = '';
            if (finalBalanceInput) finalBalanceInput.value = '';
            if (depositRadio) depositRadio.checked = false;
            if (withdrawRadio) withdrawRadio.checked = false;
            
            // 显示/隐藏相关元素
            const agentSelectDiv = document.getElementById('agentSelectDiv');
            const memberSelectDiv = document.getElementById('memberSelectDiv');
            const currentBalanceDiv = document.getElementById('currentBalanceDiv');
            const operationTypeDiv = document.getElementById('operationTypeDiv');
            const amountDiv = document.getElementById('amountDiv');
            const finalBalanceDiv = document.getElementById('finalBalanceDiv');
            
            if (operationTarget) {
                agentSelectDiv.style.display = 'block';
                this.updateAgentSelect();
            } else {
                agentSelectDiv.style.display = 'none';
                memberSelectDiv.style.display = 'none';
                currentBalanceDiv.style.display = 'none';
                operationTypeDiv.style.display = 'none';
                amountDiv.style.display = 'none';
                finalBalanceDiv.style.display = 'none';
            }
            
            // 清空会员选择列表
            this.updateMemberSelect();
            
            // 如果改为会员操作且已经选择了代理，則加载会员列表
            if (operationTarget === 'member' && this.csOperation.targetAgentId) {
                console.log('需要加载代理会员列表，代理ID:', this.csOperation.targetAgentId);
                await this.loadAgentMembers(this.csOperation.targetAgentId);
            }
            
            // 更新当前余额显示
            setTimeout(() => {
                this.updateCurrentBalanceDisplay();
            }, 100);
        },
        
        // 代理选择變化时的处理
        async onAgentSelectionChange() {
            const agentSelect = document.getElementById('agentSelect');
            const agentId = agentSelect ? agentSelect.value : '';
            
            console.log('代理选择變化:', agentId, '操作对象:', this.csOperation.operationTarget);
            this.csOperation.targetAgentId = agentId;
            
            // 重置会员选择和操作相关欄位
            this.csOperation.targetMemberId = '';
            this.csOperation.transferType = '';
            this.csOperation.amount = '';
            this.agentMembers = [];
            
            // 清空表單
            const memberSelect = document.getElementById('memberSelect');
            const amountInput = document.getElementById('amountInput');
            const currentBalanceInput = document.getElementById('currentBalanceInput');
            const finalBalanceInput = document.getElementById('finalBalanceInput');
            const depositRadio = document.getElementById('csDeposit');
            const withdrawRadio = document.getElementById('csWithdraw');
            
            if (memberSelect) memberSelect.value = '';
            if (amountInput) amountInput.value = '';
            if (currentBalanceInput) currentBalanceInput.value = '';
            if (finalBalanceInput) finalBalanceInput.value = '';
            if (depositRadio) depositRadio.checked = false;
            if (withdrawRadio) withdrawRadio.checked = false;
            
            // 显示/隐藏相关元素
            const memberSelectDiv = document.getElementById('memberSelectDiv');
            const currentBalanceDiv = document.getElementById('currentBalanceDiv');
            const operationTypeDiv = document.getElementById('operationTypeDiv');
            const amountDiv = document.getElementById('amountDiv');
            const finalBalanceDiv = document.getElementById('finalBalanceDiv');
            
            if (agentId) {
                // 根据操作对象决定是否显示会员选择
                if (this.csOperation.operationTarget === 'member') {
                    memberSelectDiv.style.display = 'block';
                    console.log('开始加载选中代理的会员列表，代理ID:', agentId);
                    await this.loadAgentMembers(agentId);
                } else {
                    memberSelectDiv.style.display = 'none';
                }
                
                currentBalanceDiv.style.display = 'block';
                operationTypeDiv.style.display = 'block';
                amountDiv.style.display = 'block';
                finalBalanceDiv.style.display = 'block';
            } else {
                memberSelectDiv.style.display = 'none';
                currentBalanceDiv.style.display = 'none';
                operationTypeDiv.style.display = 'none';
                amountDiv.style.display = 'none';
                finalBalanceDiv.style.display = 'none';
            }
            
            // 清空会员选择列表
            this.updateMemberSelect();
            
            // 更新当前余额显示
            setTimeout(() => {
                this.updateCurrentBalanceDisplay();
            }, 100);
        },
        
        // 加载指定代理的会员列表
        async loadAgentMembers(agentId) {
            try {
                const response = await axios.get(`${API_BASE_URL}/members`, {
                    params: {
                        agentId: agentId,
                        status: -1, // 获取所有状态的会员
                        page: 1,
                        limit: 1000 // 设置较大的limit获取所有会员
                    }
                });
                if (response.data.success) {
                    this.agentMembers = response.data.data.list || [];
                    console.log('加载代理会员列表成功:', this.agentMembers.length, this.agentMembers);
                    
                    // 确保每个会员都有正确的属性
                    this.agentMembers.forEach((member, index) => {
                        console.log(`会员 ${index}:`, {
                            id: member.id,
                            username: member.username,
                            balance: member.balance,
                            formattedBalance: this.formatMoney(member.balance)
                        });
                        
                        // 确保数据类型正确
                        member.balance = parseFloat(member.balance) || 0;
                    });
                    
                    // 手動更新会员选择下拉列表
                    this.updateMemberSelect();
                    
                    // 为会员选择添加change事件監聽器
                    this.$nextTick(() => {
                        const memberSelect = document.getElementById('memberSelect');
                        if (memberSelect) {
                            memberSelect.addEventListener('change', () => {
                                this.updateCurrentBalanceDisplay();
                            });
                        }
                        this.updateCurrentBalanceDisplay();
                    });
                } else {
                    console.error('加载代理会员列表失败:', response.data.message);
                    this.agentMembers = [];
                }
            } catch (error) {
                console.error('加载代理会员列表出錯:', error);
                this.agentMembers = [];
            }
        },
        
        // 手動更新代理选择下拉列表
        updateAgentSelect() {
            const agentSelect = document.getElementById('agentSelect');
            if (!agentSelect) return;
            
            // 清除現有选项（保留第一个）
            while (agentSelect.children.length > 1) {
                agentSelect.removeChild(agentSelect.lastChild);
            }
            
            // 添加代理选项
            this.allAgents.forEach(agent => {
                // 代理操作：排除总代理（避免自己操作自己）
                // 会员操作：包含总代理（可以操作自己旗下的会员）
                const shouldInclude = this.csOperation.operationTarget === 'member' || agent.level !== 0;
                
                if (shouldInclude) {
                    const option = document.createElement('option');
                    option.value = agent.id;
                    option.textContent = `${agent.username} (${this.getLevelName(agent.level)}) - 余额: ${this.formatMoney(agent.balance)}`;
                    agentSelect.appendChild(option);
                }
            });
            
            const totalOptions = agentSelect.children.length - 1; // 排除第一个默认选项
            console.log('已更新代理选择列表，共', totalOptions, '个选项，操作类型:', this.csOperation.operationTarget);
        },
        
        // 手動更新会员选择下拉列表
        updateMemberSelect() {
            const memberSelect = document.getElementById('memberSelect');
            if (!memberSelect) return;
            
            // 清除現有选项（保留第一个）
            while (memberSelect.children.length > 1) {
                memberSelect.removeChild(memberSelect.lastChild);
            }
            
            // 添加会员选项
            this.agentMembers.forEach(member => {
                const option = document.createElement('option');
                option.value = member.id;
                option.textContent = `${member.username} - 余额: ${this.formatMoney(member.balance)}`;
                memberSelect.appendChild(option);
            });
            
            console.log('已更新会员选择列表，共', this.agentMembers.length, '个选项');
        },
        
        // 更新当前余额显示
        updateCurrentBalanceDisplay() {
            const currentBalanceInput = document.getElementById('currentBalanceInput');
            if (currentBalanceInput) {
                const balance = this.getCurrentBalance();
                currentBalanceInput.value = balance !== null ? this.formatMoney(balance) : '';
                console.log('更新当前余额显示:', balance);
            }
        },
        
        // 更新操作後余额显示
        updateFinalBalanceDisplay() {
            const finalBalanceInput = document.getElementById('finalBalanceInput');
            if (finalBalanceInput) {
                const finalBalance = this.calculateFinalBalance();
                finalBalanceInput.value = this.formatMoney(finalBalance);
                console.log('更新操作後余额显示:', finalBalance);
            }
        },
        
        // 获取当前选中用戶的余额
        getCurrentBalance() {
            console.log('获取当前余额:', {
                operationTarget: this.csOperation.operationTarget,
                targetAgentId: this.csOperation.targetAgentId,
                targetMemberId: this.csOperation.targetMemberId,
                allAgents: this.allAgents.length,
                agentMembers: this.agentMembers.length
            });
            
            if (this.csOperation.operationTarget === 'agent' && this.csOperation.targetAgentId) {
                const selectedAgent = this.allAgents.find(agent => agent.id == this.csOperation.targetAgentId);
                console.log('找到代理:', selectedAgent);
                return selectedAgent ? parseFloat(selectedAgent.balance) : null;
            } else if (this.csOperation.operationTarget === 'member' && this.csOperation.targetMemberId) {
                const selectedMember = this.agentMembers.find(member => member.id == this.csOperation.targetMemberId);
                console.log('找到会员:', selectedMember);
                return selectedMember ? parseFloat(selectedMember.balance) : null;
            }
            return null;
        },
        
        // 计算操作後的最终余额
        calculateFinalBalance() {
            const currentBalance = this.getCurrentBalance();
            const amount = parseFloat(this.csOperation.amount) || 0;
            
            if (currentBalance === null || amount <= 0) {
                return currentBalance || 0;
            }
            
            if (this.csOperation.transferType === 'deposit') {
                return currentBalance + amount;
            } else if (this.csOperation.transferType === 'withdraw') {
                return currentBalance - amount;
            }
            
            return currentBalance;
        },
        
        async submitCSOperation() {
            console.log('开始提交客服操作');
            
            // 從DOM元素获取最新值
            const targetAgent = document.getElementById('csTargetAgent');
            const targetMember = document.getElementById('csTargetMember');
            const agentSelect = document.getElementById('agentSelect');
            const memberSelect = document.getElementById('memberSelect');
            const amountInput = document.getElementById('amountInput');
            const depositRadio = document.getElementById('csDeposit');
            const withdrawRadio = document.getElementById('csWithdraw');
            const descriptionInput = document.getElementById('csOperationDescription');
            
            // 更新csOperation数据
            if (targetAgent && targetAgent.checked) {
                this.csOperation.operationTarget = 'agent';
            } else if (targetMember && targetMember.checked) {
                this.csOperation.operationTarget = 'member';
            }
            
            this.csOperation.targetAgentId = agentSelect ? agentSelect.value : '';
            this.csOperation.targetMemberId = memberSelect ? memberSelect.value : '';
            this.csOperation.amount = amountInput ? amountInput.value : '';
            
            if (depositRadio && depositRadio.checked) {
                this.csOperation.transferType = 'deposit';
            } else if (withdrawRadio && withdrawRadio.checked) {
                this.csOperation.transferType = 'withdraw';
            }
            
            this.csOperation.description = descriptionInput ? descriptionInput.value : '';
            
            console.log('表單数据:', this.csOperation);
            
            if (!this.isValidCSOperation) {
                this.showMessage('请检查输入资料', 'error');
                return;
            }
            
            try {
                this.loading = true;
                let response;
                
                const currentBalance = this.getCurrentBalance();
                const amount = parseFloat(this.csOperation.amount);
                
                console.log('操作详情:', {
                    操作对象: this.csOperation.operationTarget,
                    当前余额: currentBalance,
                    操作金额: amount,
                    操作类型: this.csOperation.transferType
                });
                
                if (this.csOperation.operationTarget === 'agent') {
                    // 代理操作 - 客服代表总代理进行点数转移
                    // 存款 = 总代理转給目标代理
                    // 提款 = 目标代理转給总代理
                    response = await axios.post(`${API_BASE_URL}/cs-agent-transfer`, {
                        operatorId: this.user.id,
                        targetAgentId: this.csOperation.targetAgentId,
                        amount: amount,
                        transferType: this.csOperation.transferType, // 'deposit' 或 'withdraw'
                        description: this.csOperation.description || `客服${this.csOperation.transferType === 'deposit' ? '存款' : '提款'}`
                    });
                } else {
                    // 会员操作 - 客服代表代理进行点数转移
                    // 存款 = 代理转給会员
                    // 提款 = 会员转給代理
                    const selectedMember = this.agentMembers.find(member => member.id == this.csOperation.targetMemberId);
                    response = await axios.post(`${API_BASE_URL}/cs-member-transfer`, {
                        operatorId: this.user.id,
                        agentId: this.csOperation.targetAgentId,
                        targetMemberUsername: selectedMember.username,
                        amount: amount,
                        transferType: this.csOperation.transferType, // 'deposit' 或 'withdraw'
                        description: this.csOperation.description || `客服${this.csOperation.transferType === 'deposit' ? '存款' : '提款'}`
                    });
                }
                
                if (response.data.success) {
                    this.showMessage('余额调整成功!', 'success');
                    
                    // 更新客服余额（如果後端返回了csBalance）
                    if (response.data.csBalance !== undefined) {
                        this.user.balance = response.data.csBalance;
                        localStorage.setItem('agent_user', JSON.stringify(this.user));
                        console.log('✅ 客服余额已即时更新:', this.formatMoney(this.user.balance));
                    }
                    
                    // 保存操作类型和代理ID，用於後續刷新
                    const wasMembeOperation = this.csOperation.operationTarget === 'member';
                    const targetAgentId = this.csOperation.targetAgentId;
                    
                    // 隐藏模態框
                    if (this.csOperationModal) {
                        this.csOperationModal.hide();
                    }
                    this.hideCSOperationModal();
                    
                    // 重置操作表單
                    this.csOperation = {
                        targetAgentId: '',
                        operationTarget: '',
                        targetMemberId: '',
                        transferType: '',
                        amount: '',
                        description: ''
                    };
                    
                    // 全面刷新所有相关数据
                    const refreshPromises = [
                        this.loadCSTransactions(), // 刷新客服交易记录
                        this.loadAllAgents(),      // 刷新代理列表
                        this.fetchDashboardData()  // 刷新儀表板统计
                    ];
                    
                    // 如果操作的是会员，也要刷新会员列表
                    if (wasMembeOperation && targetAgentId) {
                        refreshPromises.push(this.loadAgentMembers(targetAgentId));
                    }
                    
                    // 如果当前在会员页面，刷新会员列表
                    if (this.activeTab === 'members') {
                        refreshPromises.push(this.searchMembers());
                    }
                    
                    // 执行所有刷新操作
                    await Promise.all(refreshPromises);
                    
                    console.log('✅ 客服操作完成，所有数据已刷新');
                } else {
                    this.showMessage(response.data.message || '余额调整失败', 'error');
                }
            } catch (error) {
                console.error('客服操作出錯:', error);
                this.showMessage(error.response?.data?.message || '操作失败，请稍後再試', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 刷新当前用戶余额
        async refreshUserBalance() {
            try {
                // 從所有代理列表中找到当前用戶並更新余额
                if (this.isCustomerService && this.allAgents.length > 0) {
                    const currentUserAgent = this.allAgents.find(agent => agent.id == this.user.id);
                    if (currentUserAgent) {
                        this.user.balance = currentUserAgent.balance;
                        // 同时更新localStorage中的用戶资讯
                        localStorage.setItem('agent_user', JSON.stringify(this.user));
                        console.log('✅ 用戶余额已更新:', this.formatMoney(this.user.balance));
                    }
                }
            } catch (error) {
                console.error('刷新用戶余额失败:', error);
            }
        },
        
        // 加载存款记录
        async loadDepositRecords(page = 1) {
            this.loading = true;
            try {
                console.log('加载存款记录...');
                const response = await axios.get(`${API_BASE_URL}/transactions?agentId=${this.user.id}&type=deposit&page=${page}&limit=${this.depositPagination.limit}`);
                
                if (!response.data.success) {
                    console.error('加载存款记录失败:', response.data.message);
                    this.depositRecords = [];
                    return;
                }
                
                const data = response.data;
                if (data.success) {
                    this.depositRecords = data.data.list || [];
                    this.depositPagination = {
                        page: data.data.page || 1,
                        limit: data.data.limit || 20,
                        total: data.data.total || 0
                    };
                    console.log('存款记录载入成功，共有 ' + this.depositRecords.length + ' 筆记录');
                } else {
                    console.error('存款记录数据格式错误:', data);
                    this.depositRecords = [];
                }
            } catch (error) {
                console.error('加载存款记录错误:', error);
                this.depositRecords = [];
            } finally {
                this.loading = false;
            }
        },
        
        // 加载提款记录
        async loadWithdrawRecords(page = 1) {
            this.loading = true;
            try {
                console.log('加载提款记录...');
                const response = await axios.get(`${API_BASE_URL}/transactions?agentId=${this.user.id}&type=withdraw&page=${page}&limit=${this.withdrawPagination.limit}`);
                
                if (!response.data.success) {
                    console.error('加载提款记录失败:', response.data.message);
                    this.withdrawRecords = [];
                    return;
                }
                
                const data = response.data;
                if (data.success) {
                    this.withdrawRecords = data.data.list || [];
                    this.withdrawPagination = {
                        page: data.data.page || 1,
                        limit: data.data.limit || 20,
                        total: data.data.total || 0
                    };
                    console.log('提款记录载入成功，共有 ' + this.withdrawRecords.length + ' 筆记录');
                } else {
                    console.error('提款记录数据格式错误:', data);
                    this.withdrawRecords = [];
                }
            } catch (error) {
                console.error('加载提款记录错误:', error);
                this.withdrawRecords = [];
            } finally {
                this.loading = false;
            }
        },
        
        // 载入退水记录
        async loadRebateRecords() {
            if (!this.isLoggedIn) return;
            
            this.loading = true;
            try {
                console.log('载入退水记录...');
                const response = await axios.get(`${API_BASE_URL}/transactions?agentId=${this.user.id}&type=rebate`);
                
                if (!response.data.success) {
                    console.error('载入退水记录失败:', response.data.message);
                    this.rebateRecords = [];
                    return;
                }
                
                const data = response.data;
                console.log('退水记录API回应:', data);
                
                if (data.success) {
                    this.rebateRecords = data.data.list || [];
                    // 计算總退水金额
                    this.totalRebateAmount = this.rebateRecords.reduce((sum, record) => {
                        return sum + (parseFloat(record.amount) || 0);
                    }, 0);
                    
                    console.log('退水记录载入成功:', this.rebateRecords.length, '筆，總金额:', this.totalRebateAmount);
                } else {
                    console.error('载入退水记录失败:', data.message);
                    this.showMessage(`载入退水记录失败: ${data.message}`, 'error');
                    this.rebateRecords = [];
                }
            } catch (error) {
                console.error('载入退水记录时發生错误:', error);
                this.showMessage('载入退水记录时發生错误', 'error');
                this.rebateRecords = [];
            } finally {
                this.loading = false;
            }
        },
        
        // 筛选退水记录
        filterRebateRecords() {
            // 觸發computed属性重新计算
            console.log('筛选退水记录，條件:', this.rebateFilters);
        },
        
        // 清除退水记录筛选條件
        clearRebateFilters() {
            this.rebateFilters.member = '';
            this.rebateFilters.date = '';
        },
        
        // 重设代理密码
        resetAgentPassword(agent) {
            this.resetPasswordData = {
                userType: 'agent',
                userId: agent.id,
                username: agent.username,
                newPassword: '',
                confirmPassword: ''
            };
            
            const modal = new bootstrap.Modal(document.getElementById('resetPasswordModal'));
            modal.show();
        },
        
        // 重设会员密码
        resetMemberPassword(member) {
            this.resetPasswordData = {
                userType: 'member',
                userId: member.id,
                username: member.username,
                newPassword: '',
                confirmPassword: ''
            };
            
            const modal = new bootstrap.Modal(document.getElementById('resetPasswordModal'));
            modal.show();
        },
        
        // 提交密码重设
        async submitPasswordReset() {
            if (!this.isPasswordResetValid) {
                this.showMessage('请确认密码格式正确且两次输入一致', 'error');
                return;
            }
            
            this.loading = true;
            
            try {
                const endpoint = this.resetPasswordData.userType === 'agent' ? 'reset-agent-password' : 'reset-member-password';
                
                const response = await axios.post(`${API_BASE_URL}/${endpoint}`, {
                    userId: this.resetPasswordData.userId,
                    newPassword: this.resetPasswordData.newPassword,
                    operatorId: this.user.id // 记录操作者
                });
                
                if (response.data.success) {
                    this.showMessage(`${this.resetPasswordData.userType === 'agent' ? '代理' : '会员'}密码重设成功`, 'success');
                    
                    // 关闭模態框
                    const modal = bootstrap.Modal.getInstance(document.getElementById('resetPasswordModal'));
                    modal.hide();
                    
                    // 清空表單数据
                    this.resetPasswordData = {
                        userType: '',
                        userId: null,
                        username: '',
                        newPassword: '',
                        confirmPassword: ''
                    };
                } else {
                    this.showMessage(response.data.message || '密码重设失败', 'error');
                }
            } catch (error) {
                console.error('重设密码错误:', error);
                this.showMessage(error.response?.data?.message || '密码重设失败，请稍後再試', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 显示个人资料模態框
        async showProfileModal() {
            // 安全检查：确保已登录且有用戶资讯
            if (!this.isLoggedIn || !this.user || !this.user.id) {
                console.warn('⚠️ 未登录或用戶资讯不完整，無法显示个人资料');
                return;
            }
            
            console.log('显示个人资料模態框');
            // 载入个人资料数据
            await this.loadProfileData();
            // 显示 modal
            this.isProfileModalVisible = true;
        },
        
        // 隐藏个人资料模態框
        hideProfileModal() {
            this.isProfileModalVisible = false;
        },
        
        // 载入个人资料数据
        async loadProfileData() {
            this.profileLoading = true;
            
            try {
                const response = await axios.get(`${API_BASE_URL}/agent-profile/${this.user.id}`);
                
                if (response.data.success) {
                    // 更新个人资料数据
                    this.profileData = {
                        realName: response.data.data.real_name || '',
                        phone: response.data.data.phone || '',
                        email: response.data.data.email || '',
                        lineId: response.data.data.line_id || '',
                        telegram: response.data.data.telegram || '',
                        address: response.data.data.address || '',
                        remark: response.data.data.remark || ''
                    };
                } else {
                    console.log('首次载入个人资料，使用空白数据');
                }
            } catch (error) {
                console.error('载入个人资料错误:', error);
                // 如果载入失败，使用空白数据
                this.profileData = {
                    realName: '',
                    phone: '',
                    email: '',
                    lineId: '',
                    telegram: '',
                    address: '',
                    remark: ''
                };
            } finally {
                this.profileLoading = false;
            }
        },
        
        // 更新个人资料
        async updateProfile() {
            console.log('开始更新个人资料...', this.user?.id);
             
             if (!this.user?.id) {
                 this.showMessage('用戶信息错误，请重新登录', 'error');
                 return;
             }
             
             this.profileLoading = true;
             
             try {
                 console.log('发送更新请求到:', `${API_BASE_URL}/update-agent-profile`);
                 
                 const response = await axios.post(`${API_BASE_URL}/update-agent-profile`, {
                     agentId: this.user.id,
                     realName: this.profileData.realName,
                     phone: this.profileData.phone,
                     email: this.profileData.email,
                     lineId: this.profileData.lineId,
                     telegram: this.profileData.telegram,
                     address: this.profileData.address,
                     remark: this.profileData.remark
                 }, {
                     timeout: 10000, // 10秒超时
                     headers: {
                         'Content-Type': 'application/json'
                     }
                 });
                 
                 console.log('收到API回应:', response.data);
                 
                 if (response.data.success) {
                     this.showMessage('个人资料更新成功', 'success');
                     
                     // 关闭 modal
                     this.hideProfileModal();
                 } else {
                     this.showMessage(response.data.message || '个人资料更新失败', 'error');
                 }
             } catch (error) {
                 console.error('更新个人资料错误:', error);
                 console.error('错误详情:', error.response);
                 
                 let errorMessage = '个人资料更新失败，请稍後再試';
                 if (error.response?.data?.message) {
                     errorMessage = error.response.data.message;
                 } else if (error.message) {
                     errorMessage = error.message;
                 }
                 
                 this.showMessage(errorMessage, 'error');
             } finally {
                 console.log('更新个人资料完成');
                 this.profileLoading = false;
                 
                 // 额外的安全机制：确保按钮状态正确重置
                 setTimeout(() => {
                     if (this.profileLoading) {
                         console.warn('检测到 profileLoading 状态异常，强制重置');
                         this.profileLoading = false;
                     }
                 }, 1000);
             }
         },

         // 报表查询相关方法
         getCurrentDateText() {
             const today = new Date();
             return today.toLocaleDateString('zh-CN', {
                 year: 'numeric',
                 month: '2-digit',
                 day: '2-digit'
             });
         },

         setDateRange(type) {
             const today = new Date();
             const yesterday = new Date(today);
             yesterday.setDate(today.getDate() - 1);
             
             switch(type) {
                 case 'today':
                     this.reportFilters.startDate = today.toISOString().split('T')[0];
                     this.reportFilters.endDate = today.toISOString().split('T')[0];
                     break;
                 case 'yesterday':
                     this.reportFilters.startDate = yesterday.toISOString().split('T')[0];
                     this.reportFilters.endDate = yesterday.toISOString().split('T')[0];
                     break;
                 case 'week':
                     const weekStart = new Date(today);
                     weekStart.setDate(today.getDate() - today.getDay());
                     this.reportFilters.startDate = weekStart.toISOString().split('T')[0];
                     this.reportFilters.endDate = today.toISOString().split('T')[0];
                     break;
                 case 'month':
                     const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                     this.reportFilters.startDate = monthStart.toISOString().split('T')[0];
                     this.reportFilters.endDate = today.toISOString().split('T')[0];
                     break;
             }
         },



         async searchReports() {
             try {
                 this.loading = true;
                 
                 // 准备筛选参数
                 const params = new URLSearchParams();
                 
                 // 日期参数
                 if (this.reportFilters.startDate) {
                     params.append('startDate', this.reportFilters.startDate);
                 }
                 if (this.reportFilters.endDate) {
                     params.append('endDate', this.reportFilters.endDate);
                 }
                 
                 // 结算状态
                 if (this.reportFilters.settlementStatus) {
                     params.append('settlementStatus', this.reportFilters.settlementStatus);
                 }
                 
                 // 用戶名筛选
                 if (this.reportFilters.username && this.reportFilters.username.trim()) {
                     params.append('username', this.reportFilters.username.trim());
                 }
                 
                 // 遊戲类型：只支援FS金彩赛车
                 params.append('gameTypes', 'pk10');

                 console.log('📊 前端: 調用代理层级分析API');
                 
                 const response = await axios.get(`${API_BASE_URL}/reports/agent-analysis?${params.toString()}`);
                 const data = response.data;
                 
                 console.log('📊 前端: 接收到报表数据', data);
                 
                 // 新的簡化数据結構
                 this.reportData = {
                     success: data.success,
                     reportData: data.reportData || [],                  // 統一的代理+会员列表
                     totalSummary: data.totalSummary || {
                         betCount: 0,
                         betAmount: 0.0,
                         validAmount: 0.0,
                         memberWinLoss: 0.0,
                         rebate: 0.0,
                         profitLoss: 0.0,
                         actualRebate: 0.0,
                         rebateProfit: 0.0,
                         finalProfitLoss: 0.0
                     },
                     hasData: data.hasData || false,
                     agentInfo: data.agentInfo || {},                    // 代理信息：下級数量等
                     message: data.message
                 };
                 
                 if (!data.hasData) {
                     this.showMessage(data.message || '查询期间內没有数据', 'info');
                 }
                 
             } catch (error) {
                 console.error('查询报表失败:', error);
                 this.showMessage('查询报表失败: ' + error.message, 'error');
                 
                 // 设置空的报表数据結構
                 this.reportData = {
                     success: false,
                     reportData: [],
                     totalSummary: {
                         betCount: 0,
                         betAmount: 0.0,
                         validAmount: 0.0,
                         memberWinLoss: 0.0,
                         rebate: 0.0,
                         profitLoss: 0.0,
                         actualRebate: 0.0,
                         rebateProfit: 0.0,
                         finalProfitLoss: 0.0
                     },
                     hasData: false,
                     agentInfo: {},
                     message: error.message
                 };
             } finally {
                 this.loading = false;
             }
         },



         async refreshReportData() {
             await this.searchReports();
         },
         
         async enterAgentReport(agent) {
             try {
                 // 设置载入状态，避免短暫显示「沒有资料」
                 this.loading = true;
                 
                 // 添加到面包屑導航
                 this.reportBreadcrumb.push({
                     username: agent.username,
                     level: agent.level,
                     agentId: agent.id || agent.username,
                     viewType: 'agents'
                 });
                 
                 console.log('🔍 进入代理报表:', agent.username, '层级:', agent.level);
                 
                 // 准备参数
                 const params = new URLSearchParams();
                 
                 // 保持当前筛选條件
                 if (this.reportFilters.startDate) {
                     params.append('startDate', this.reportFilters.startDate);
                 }
                 if (this.reportFilters.endDate) {
                     params.append('endDate', this.reportFilters.endDate);
                 }
                 if (this.reportFilters.settlementStatus) {
                     params.append('settlementStatus', this.reportFilters.settlementStatus);
                 }
                 if (this.reportFilters.username && this.reportFilters.username.trim()) {
                     params.append('username', this.reportFilters.username.trim());
                 }
                 
                 // 指定查看該代理
                 params.append('targetAgent', agent.username);
                 params.append('gameTypes', 'pk10');
                 
                 const response = await fetch(`${this.API_BASE_URL}/reports/agent-analysis?${params.toString()}`, {
                     method: 'GET',
                     headers: {
                         'Content-Type': 'application/json',
                         'Authorization': `Bearer ${localStorage.getItem('agent_token')}`
                     }
                 });

                 if (!response.ok) {
                     throw new Error(`HTTP error! status: ${response.status}`);
                 }

                 const data = await response.json();
                 
                 console.log('📊 代理层级报表数据:', data);
                 
                 // 更新报表数据
                 this.reportData = {
                     success: data.success,
                     reportData: data.reportData || [],                  // 統一的代理+会员列表
                     totalSummary: data.totalSummary || {
                         betCount: 0,
                         betAmount: 0.0,
                         validAmount: 0.0,
                         memberWinLoss: 0.0,
                         rebate: 0.0,
                         profitLoss: 0.0,
                         actualRebate: 0.0,
                         rebateProfit: 0.0,
                         finalProfitLoss: 0.0
                     },
                     hasData: data.hasData || false,
                     agentInfo: data.agentInfo || {},                    // 代理信息：下級数量等
                     message: data.message
                 };
                 
                 // 移除成功提示讯息，让HTML模板来处理空数据显示
                 
             } catch (error) {
                 console.error('查看代理报表失败:', error);
                 this.showMessage('查看代理报表失败: ' + error.message, 'error');
             } finally {
                 // 取消载入状态
                 this.loading = false;
             }
         },

         async viewAgentMembers(agent) {
             try {
                 this.loading = true;
                 
                 // 添加到面包屑導航
                 this.reportBreadcrumb.push({
                     username: agent.username,
                     level: `${agent.level} - 会员列表`,
                     agentId: agent.id || agent.username,
                     viewType: 'members'
                 });
                 
                 console.log('👥 查看代理会员:', agent.username);
                 
                 // 准备参数
                 const params = new URLSearchParams();
                 
                 // 保持当前筛选條件
                 if (this.reportFilters.startDate) {
                     params.append('startDate', this.reportFilters.startDate);
                 }
                 if (this.reportFilters.endDate) {
                     params.append('endDate', this.reportFilters.endDate);
                 }
                 if (this.reportFilters.settlementStatus) {
                     params.append('settlementStatus', this.reportFilters.settlementStatus);
                 }
                 if (this.reportFilters.username && this.reportFilters.username.trim()) {
                     params.append('username', this.reportFilters.username.trim());
                 }
                 
                 // 指定查看該代理的会员
                 params.append('targetAgent', agent.username);
                 params.append('viewType', 'members');
                 params.append('gameTypes', 'pk10');
                 
                 const response = await fetch(`${this.API_BASE_URL}/reports/agent-analysis?${params.toString()}`, {
                     method: 'GET',
                     headers: {
                         'Content-Type': 'application/json',
                         'Authorization': `Bearer ${localStorage.getItem('agent_token')}`
                     }
                 });

                 if (!response.ok) {
                     throw new Error(`HTTP error! status: ${response.status}`);
                 }

                 const data = await response.json();
                 
                 console.log('👥 会员报表数据:', data);
                 
                 // 更新报表数据
                 this.reportData = {
                     success: data.success,
                     reportData: data.reportData || [],
                     totalSummary: data.totalSummary || {
                         betCount: 0,
                         betAmount: 0.0,
                         validAmount: 0.0,
                         memberWinLoss: 0.0,
                         ninthAgentWinLoss: 0.0,
                         upperDelivery: 0.0,
                         upperSettlement: 0.0,
                         rebate: 0.0,
                         profitLoss: 0.0,
                         downlineReceivable: 0.0,
                         commission: 0.0,
                         commissionAmount: 0.0,
                         commissionResult: 0.0,
                         actualRebate: 0.0,
                         rebateProfit: 0.0,
                         finalProfitLoss: 0.0
                     },
                     hasData: data.hasData || false,
                     message: data.message
                 };
                 
                 if (data.hasData && data.reportData && data.reportData.length > 0) {
                     this.showMessage(`查看 ${agent.username} 的会员报表完成`, 'success');
                 }
                 
             } catch (error) {
                 console.error('查看会员报表失败:', error);
                 this.showMessage('查看会员报表失败: ' + error.message, 'error');
             } finally {
                 this.loading = false;
             }
         },
         
         goBackToParentReport() {
             if (this.reportBreadcrumb.length === 0) {
                 // 回到根报表
                 this.searchReports();
                 return;
             }
             
             // 移除最后一个层级
             this.reportBreadcrumb.pop();
             
             if (this.reportBreadcrumb.length === 0) {
                 // 回到根报表
                 this.searchReports();
             } else {
                 // 回到上一个层级
                 const parentAgent = this.reportBreadcrumb[this.reportBreadcrumb.length - 1];
                 this.enterAgentReport(parentAgent);
             }
         },
         
         goBackToLevel(targetItem) {
             // 直接进入該层级的报表
             this.enterAgentReport(targetItem);
         },

         async exportReport() {
             try {
                 this.loading = true;
                 
                 // 准备筛选参数
                 const params = new URLSearchParams({
                     startDate: this.reportFilters.startDate,
                     endDate: this.reportFilters.endDate,
                     settlementStatus: this.reportFilters.settlementStatus,
                     betType: this.reportFilters.betType,
                     username: this.reportFilters.username,
                     minAmount: this.reportFilters.minAmount,
                     maxAmount: this.reportFilters.maxAmount,
                     export: 'true'
                 });

                 // 处理遊戲类型筛选
                 const selectedGameTypes = [];
                 if (!this.reportFilters.gameTypes.all) {
                     if (this.reportFilters.gameTypes.pk10) selectedGameTypes.push('pk10');
                     if (this.reportFilters.gameTypes.ssc) selectedGameTypes.push('ssc');
                     if (this.reportFilters.gameTypes.lottery539) selectedGameTypes.push('lottery539');
                     if (this.reportFilters.gameTypes.lottery) selectedGameTypes.push('lottery');
                     if (this.reportFilters.gameTypes.other) selectedGameTypes.push('other');
                 }
                 
                 if (selectedGameTypes.length > 0) {
                     params.append('gameTypes', selectedGameTypes.join(','));
                 }

                 const response = await fetch(`${this.API_BASE_URL}/reports/export?${params.toString()}`, {
                     method: 'GET',
                     headers: {
                         'Authorization': `Bearer ${localStorage.getItem('agent_token')}`
                     }
                 });

                 if (!response.ok) {
                     throw new Error(`HTTP error! status: ${response.status}`);
                 }

                 // 处理檔案下载
                 const blob = await response.blob();
                 const url = window.URL.createObjectURL(blob);
                 const a = document.createElement('a');
                 a.href = url;
                 a.download = `报表_${this.reportFilters.startDate}_${this.reportFilters.endDate}.xlsx`;
                 document.body.appendChild(a);
                 a.click();
                 window.URL.revokeObjectURL(url);
                 document.body.removeChild(a);
                 
                 this.showMessage('报表匯出完成', 'success');
                 
             } catch (error) {
                 console.error('匯出报表失败:', error);
                 this.showMessage('匯出报表失败: ' + error.message, 'error');
             } finally {
                 this.loading = false;
             }
         },



         formatGameType(gameType) {
             const gameTypeMap = {
                 'pk10': 'AR PK10',
                 'ssc': 'AR 时时彩',
                 'lottery539': 'AR 539',
                 'lottery': 'AR 六合彩',
                 'racing': 'FS金彩赛车'
             };
             return gameTypeMap[gameType] || '其他遊戲';
         },

         formatBetContent(record) {
             if (!record.bet_content) return '-';
             
             try {
                 // 如果是JSON字符串，解析它
                 const content = typeof record.bet_content === 'string' ? 
                               JSON.parse(record.bet_content) : record.bet_content;
                 
                 if (content.position) {
                     return `位置投注: ${content.position}`;
                 } else if (content.numbers) {
                     return `号码投注: ${content.numbers.join(', ')}`;
                 } else if (content.type) {
                     return `${content.type}投注`;
                 }
                 return JSON.stringify(content);
             } catch (e) {
                 return record.bet_content;
             }
         },

         getProfitClass(profit) {
             if (!profit || profit === 0) return 'text-muted';
             return profit > 0 ? 'text-success fw-bold' : 'text-danger fw-bold';
         },

         formatProfit(amount) {
             if (!amount || amount === 0) return '$0.00';
             const formatted = this.formatMoney(Math.abs(amount));
             return amount > 0 ? `+${formatted}` : `-${formatted}`;
         },

         formatPercentage(rate) {
             if (!rate) return '0%';
             return `${(rate * 100).toFixed(1)}%`;
         },

         // 登录日誌相关方法
         async loadLoginLogs() {
             try {
                 this.loading = true;
                 
                 const params = new URLSearchParams({
                     startDate: this.loginLogFilters.startDate,
                     endDate: this.loginLogFilters.endDate
                 });

                 const response = await axios.get(`${API_BASE_URL}/login-logs?${params.toString()}`);
                 const data = response.data;
                 this.loginLogs = data.logs || [];
                 this.calculateLoginLogPagination();
                 
             } catch (error) {
                 console.error('载入登录日誌失败:', error);
                 this.showMessage('载入登录日誌失败: ' + error.message, 'error');
             } finally {
                 this.loading = false;
             }
         },



         searchLoginLogs() {
             this.loadLoginLogs();
         },

         setLoginLogDateRange(type) {
             const today = new Date();
             const yesterday = new Date(today);
             yesterday.setDate(today.getDate() - 1);
             
             switch(type) {
                 case 'today':
                     this.loginLogFilters.startDate = today.toISOString().split('T')[0];
                     this.loginLogFilters.endDate = today.toISOString().split('T')[0];
                     break;
                 case 'yesterday':
                     this.loginLogFilters.startDate = yesterday.toISOString().split('T')[0];
                     this.loginLogFilters.endDate = yesterday.toISOString().split('T')[0];
                     break;
                 case 'week':
                     const weekStart = new Date(today);
                     weekStart.setDate(today.getDate() - today.getDay());
                     this.loginLogFilters.startDate = weekStart.toISOString().split('T')[0];
                     this.loginLogFilters.endDate = today.toISOString().split('T')[0];
                     break;
                 case '7days':
                     const sevenDaysAgo = new Date(today);
                     sevenDaysAgo.setDate(today.getDate() - 7);
                     this.loginLogFilters.startDate = sevenDaysAgo.toISOString().split('T')[0];
                     this.loginLogFilters.endDate = today.toISOString().split('T')[0];
                     break;
             }
             // 设定日期范围後自動查询
             this.loadLoginLogs();
         },

         calculateLoginLogPagination() {
             this.loginLogPagination.totalPages = Math.ceil(this.loginLogs.length / this.loginLogPagination.limit);
             if (this.loginLogPagination.currentPage > this.loginLogPagination.totalPages) {
                 this.loginLogPagination.currentPage = 1;
             }
         },

         changeLoginLogPage(page) {
             if (page >= 1 && page <= this.loginLogPagination.totalPages) {
                 this.loginLogPagination.currentPage = page;
             }
         },

         getLoginLogPageRange() {
             const currentPage = this.loginLogPagination.currentPage;
             const totalPages = this.loginLogPagination.totalPages;
             const range = [];
             
             const startPage = Math.max(1, currentPage - 2);
             const endPage = Math.min(totalPages, currentPage + 2);
             
             for (let i = startPage; i <= endPage; i++) {
                 range.push(i);
             }
             
             return range;
         },

         formatLoginDate(dateString) {
             if (!dateString) return '-';
             const date = new Date(dateString);
             return date.toLocaleDateString('zh-CN', {
                 year: 'numeric',
                 month: '2-digit',
                 day: '2-digit'
             });
         },

                   formatLoginTime(dateString) {
              if (!dateString) return '-';
              const date = new Date(dateString);
              return date.toLocaleTimeString('zh-CN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: false
              });
          },

          formatLoginDateTime(dateString) {
              if (!dateString) return '-';
              const date = new Date(dateString);
                                  return date.toLocaleString('zh-CN', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: false
              });
          },

          formatUserType(userType) {
              const typeMap = {
                  'member': '会员',
                  'agent': '代理',
                  'admin': '管理員'
              };
              return typeMap[userType] || userType;
          },

          formatIPAddress(ipAddress) {
              if (!ipAddress) return '-';
              // 移除IPv6映射的前綴 ::ffff:
              return ipAddress.replace(/^::ffff:/i, '');
          },

          // 查看会员下注记录
          async viewMemberBets(memberUsername, dateRange = null) {
              try {
                  console.log('🎯 查看会员下注记录:', memberUsername, '期间:', dateRange);
                  
                  // 切換到下注记录页面
                  this.activeTab = 'stats';
                  
                  // 等待页面切換完成
                  await this.$nextTick();
                  
                  // 设置筛选條件为該会员
                  this.betFilters.member = memberUsername;
                  this.betFilters.viewScope = 'downline'; // 使用整條代理線模式確保能查到
                  
                  // 如果有傳入期间范围，设置期间筛选
                  if (dateRange && dateRange.startDate && dateRange.endDate) {
                      this.betFilters.startDate = dateRange.startDate;
                      this.betFilters.endDate = dateRange.endDate;
                      // 清空單日查询，使用期间查询
                      this.betFilters.date = '';
                      console.log('📅 设置期间查询:', dateRange.startDate, '至', dateRange.endDate);
                  }
                  
                  // 载入直屬会员数据並搜索
                  await this.loadDirectMembersForBets();
                  await this.searchBets();
                  
                  const dateMsg = dateRange ? ` (${dateRange.startDate} 至 ${dateRange.endDate})` : '';
                  this.showMessage(`正在查看 ${memberUsername} 的下注记录${dateMsg}`, 'info');
                  
              } catch (error) {
                  console.error('查看会员下注记录失败:', error);
                  this.showMessage('查看会员下注记录失败: ' + error.message, 'error');
              }
          },

          // 设置下注记录期间查询
          setBetDateRange(type) {
              const today = new Date();
              let startDate, endDate;
              
              switch(type) {
                  case 'today':
                      startDate = endDate = today.toISOString().split('T')[0];
                      break;
                  case 'yesterday':
                      const yesterday = new Date(today);
                      yesterday.setDate(today.getDate() - 1);
                      startDate = endDate = yesterday.toISOString().split('T')[0];
                      break;
                  case 'thisWeek':
                      const firstDay = new Date(today);
                      firstDay.setDate(today.getDate() - today.getDay());
                      startDate = firstDay.toISOString().split('T')[0];
                      endDate = today.toISOString().split('T')[0];
                      break;
                  case 'thisMonth':
                      startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
                      endDate = today.toISOString().split('T')[0];
                      break;
                  case 'lastMonth':
                      const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
                      startDate = lastMonthStart.toISOString().split('T')[0];
                      endDate = lastMonthEnd.toISOString().split('T')[0];
                      break;
                  case 'clear':
                      this.betFilters.startDate = '';
                      this.betFilters.endDate = '';
                      this.betFilters.date = '';
                      return;
                  default:
                      return;
              }
              
              this.betFilters.startDate = startDate;
              this.betFilters.endDate = endDate;
              this.betFilters.date = ''; // 清空單日查询
              
              console.log('📅 设置下注记录期间查询:', type, startDate, '至', endDate);
          },

        // 调整会员限红 - 使用v-if控制显示
        async adjustMemberBettingLimit(member) {
            try {
                console.log('开始调整会员限红:', member);
                
                // 重置数据
                this.bettingLimitData = {
                    loading: true,
                    submitting: false,
                    member: {
                        id: member.id,
                        username: member.username,
                        bettingLimitLevel: '',
                        levelDisplayName: '',
                        description: ''
                    },
                    configs: [],
                    newLimitLevel: '',
                    reason: ''
                };
                
                // 显示Modal
                this.showBettingLimitModal = true;
                console.log('✅ 限红调整Modal已显示！');
                
                // 並行载入数据
                const [memberResponse, configsResponse] = await Promise.all([
                    axios.get(`${API_BASE_URL}/member-betting-limit/${member.id}`),
                    axios.get(`${API_BASE_URL}/betting-limit-configs`)
                ]);
                
                if (memberResponse.data.success) {
                    this.bettingLimitData.member = {
                        ...this.bettingLimitData.member,
                        bettingLimitLevel: memberResponse.data.member.bettingLimitLevel,
                        levelDisplayName: memberResponse.data.member.levelDisplayName,
                        description: memberResponse.data.member.description
                    };
                }
                
                if (configsResponse.data.success) {
                    this.bettingLimitData.configs = configsResponse.data.configs;
                }
                
                this.bettingLimitData.loading = false;
                
            } catch (error) {
                console.error('载入限红设定失败:', error);
                this.showMessage('载入限红设定失败，请稍後再試', 'error');
                this.bettingLimitData.loading = false;
                this.showBettingLimitModal = false;
            }
        },
        
        // 隐藏限红调整Modal
        hideBettingLimitModal() {
            this.showBettingLimitModal = false;
        },

        // 提交限红调整
        async submitBettingLimitAdjustment() {
            try {
                this.bettingLimitData.submitting = true;
                
                const response = await axios.post(`${API_BASE_URL}/update-member-betting-limit`, {
                    operatorId: this.user.id,
                    memberId: this.bettingLimitData.member.id,
                    newLimitLevel: this.bettingLimitData.newLimitLevel,
                    reason: this.bettingLimitData.reason
                });
                
                if (response.data.success) {
                    this.showMessage('限红设定调整成功', 'success');
                    
                    // 关闭Modal
                    this.showBettingLimitModal = false;
                    
                    // 刷新会员列表
                    if (this.activeTab === 'members') {
                        await this.searchMembers();
                    } else if (this.activeTab === 'hierarchical') {
                        await this.refreshHierarchicalMembers();
                    }
                } else {
                    this.showMessage(response.data.message || '调整限红失败', 'error');
                }
                
            } catch (error) {
                console.error('调整限红失败:', error);
                this.showMessage('调整限红失败，请稍後再試', 'error');
            } finally {
                this.bettingLimitData.submitting = false;
            }
        },

        // 格式化投注类型名称
        formatBetTypeName(key) {
            const names = {
                'number': '1-10车號',
                'twoSide': '两面',
                'sumValueSize': '冠亚军和大小',
                'sumValueOddEven': '冠亚军和單双',
                'sumValue': '冠亚军和',
                'dragonTiger': '龙虎'
            };
            return names[key] || key;
        }
    },

    // 计算属性
    computed: {
        // 分页後的登录日誌
        paginatedLoginLogs() {
            const start = (this.loginLogPagination.currentPage - 1) * this.loginLogPagination.limit;
            const end = start + this.loginLogPagination.limit;
            return this.loginLogs.slice(start, end);
        },
        
        // 计算最终代理余额（会员点数转移用）- 作为计算属性
        finalAgentBalance() {
            const currentBalance = parseFloat(this.agentCurrentBalance) || 0;
            const amount = parseFloat(this.transferAmount) || 0;
            
            if (this.transferType === 'deposit') {
                // 代理存入点数給会员，代理余额减少
                return currentBalance - amount;
            } else {
                // 代理從会员提领点数，代理余额增加
                return currentBalance + amount;
            }
        },
        
        // 检查转移是否有效
        isValidTransfer() {
            if (parseFloat(this.transferAmount) <= 0) {
                return false;
            }
            
            if (this.transferType === 'deposit') {
                return this.agentCurrentBalance >= parseFloat(this.transferAmount);
            } else if (this.transferType === 'withdraw') {
                return this.balanceAdjustData.currentBalance >= parseFloat(this.transferAmount);
            }
            
            return false;
        },
        
        // 检查代理点数转移是否有效
        isValidAgentTransfer() {
            // 确保數值正确
            const amount = parseFloat(this.agentTransferAmount) || 0;
            const userBalance = parseFloat(this.user.balance) || 0;
            const agentBalance = parseFloat(this.agentBalanceData?.currentBalance) || 0;
            
            console.log('验证代理点数转移:', {
                amount, 
                userBalance, 
                agentBalance, 
                type: this.agentTransferType
            });
            
            // 金额必须大於0
            if (amount <= 0) {
                return false;
            }
            
            if (this.agentTransferType === 'deposit') {
                // 存入时，检查上級代理(自己)余额是否足夠
                return userBalance >= amount;
            } else if (this.agentTransferType === 'withdraw') {
                // 提领时，检查下級代理余额是否足夠
                return agentBalance >= amount;
            }
            
            return false;
        },

        // 检查会员点數转移是否有效
        isValidMemberTransfer() {
            // 確保數值正確
            const amount = parseFloat(this.memberTransferAmount) || 0;
            const userBalance = parseFloat(this.user.balance) || 0;
            const memberBalance = parseFloat(this.memberBalanceData?.currentBalance) || 0;
            
            console.log('验证会员点數转移:', {
                amount, 
                userBalance, 
                memberBalance, 
                type: this.memberTransferType
            });
            
            // 金额必须大於0
            if (amount <= 0) {
                return false;
            }
            
            if (this.memberTransferType === 'deposit') {
                // 存入时，检查代理(自己)余额是否足夠
                return userBalance >= amount;
            } else if (this.memberTransferType === 'withdraw') {
                // 提领时，检查会员余额是否足夠
                return memberBalance >= amount;
            }
            
            return false;
        },
        
        // 检查会员余额修改是否有效
        isValidBalanceModification() {
            const amount = parseFloat(this.modifyBalanceAmount) || 0;
            if (amount <= 0) return false;
            
            if (this.modifyBalanceType === 'absolute') {
                return true; // 絕对值模式下，只要金额大於0即可
            } else {
                // 相对值模式下，如果是减少，則不能超过当前余额
                if (this.balanceChangeDirection === 'decrease') {
                    const currentBalance = parseFloat(this.modifyBalanceData.currentBalance) || 0;
                    return amount <= currentBalance;
                }
                return true;
            }
        },
        
        // 检查代理余额修改是否有效
        isValidAgentBalanceModification() {
            const amount = parseFloat(this.agentModifyAmount) || 0;
            if (amount <= 0) return false;
            
            if (this.agentModifyType === 'absolute') {
                return true; // 絕对值模式下，只要金额大於0即可
            } else {
                // 相对值模式下，如果是减少，則不能超过当前余额
                if (this.agentChangeDirection === 'decrease') {
                    const currentBalance = parseFloat(this.agentBalanceData.currentBalance) || 0;
                    return amount <= currentBalance;
                }
                return true;
            }
        },
        
        // 检查客服操作是否有效
        isValidCSOperation() {
            const amount = parseFloat(this.csOperation.amount) || 0;
            
            if (amount <= 0) return false;
            if (!this.csOperation.operationTarget) return false;
            if (!this.csOperation.targetAgentId) return false;
            if (this.csOperation.operationTarget === 'member' && !this.csOperation.targetMemberId) return false;
            if (!this.csOperation.transferType) return false;
            
            return true;
        },
        
        // 检查密码重设是否有效
        isPasswordResetValid() {
            return (
                this.resetPasswordData.newPassword && 
                this.resetPasswordData.confirmPassword &&
                this.resetPasswordData.newPassword.length >= 6 &&
                this.resetPasswordData.newPassword === this.resetPasswordData.confirmPassword
            );
        },
        
        // 当前用戶名
        currentUsername() {
            console.log('计算currentUsername，user:', this.user);
            const username = this.user?.username || '载入中...';
            console.log('计算得到的username:', username);
            return username;
        },
        
        // 当前用戶级别
        currentUserLevel() {
            console.log('计算currentUserLevel，user.level:', this.user?.level);
            if (this.user?.level !== undefined && this.user?.level !== null) {
                const levelName = this.getLevelName(this.user.level);
                console.log('计算得到的levelName:', levelName);
                return levelName;
            }
            console.log('回傳载入中...');
            return '载入中...';
        },
        
        // 过滤後的退水记录
        filteredRebateRecords() {
            let filtered = [...this.rebateRecords];
            
            // 按会员名称筛选
            if (this.rebateFilters.member) {
                const keyword = this.rebateFilters.member.toLowerCase();
                filtered = filtered.filter(record => 
                    record.member_username && record.member_username.toLowerCase().includes(keyword)
                );
            }
            
            // 按日期筛选
            if (this.rebateFilters.date) {
                const filterDate = this.rebateFilters.date;
                filtered = filtered.filter(record => {
                    if (!record.created_at) return false;
                    const recordDate = new Date(record.created_at).toISOString().split('T')[0];
                    return recordDate === filterDate;
                });
            }
            
            return filtered;
        },
        
        // 總下注金额（过滤後）
        totalFilteredBetAmount() {
            return this.filteredRebateRecords.reduce((sum, record) => {
                return sum + (parseFloat(record.bet_amount) || 0);
            }, 0);
        },
        
        // 總退水金额（过滤後）
        totalFilteredRebateAmount() {
            return this.filteredRebateRecords.reduce((sum, record) => {
                return sum + (parseFloat(record.amount) || 0);
            }, 0);
        },
        
        // 平均退水比例
        averageRebatePercentage() {
            if (this.filteredRebateRecords.length === 0) return '0.0';
            
            const totalPercentage = this.filteredRebateRecords.reduce((sum, record) => {
                return sum + ((parseFloat(record.rebate_percentage) || 0) * 100);
            }, 0);
            
            return (totalPercentage / this.filteredRebateRecords.length).toFixed(1);
        },
        
        // 计算选中的限红配置
        selectedLimitConfig() {
            if (!this.bettingLimitData.newLimitLevel || !this.bettingLimitData.configs.length) {
                return {};
            }
            
            const selectedConfig = this.bettingLimitData.configs.find(
                config => config.level_name === this.bettingLimitData.newLimitLevel
            );
            
            return selectedConfig ? selectedConfig.config : {};
        }
    },


    
    // 監聽属性
    watch: {
        // 當活動分页变更时，加载对應数据
        activeTab(newTab, oldTab) {
            if (newTab === 'dashboard' && oldTab !== 'dashboard') {
                this.fetchDashboardData();
            }
            if (newTab === 'members') {
                this.loadHierarchicalMembers();
            }
            if (newTab === 'agents') {
                this.searchAgents();
            }
            if (newTab === 'draw') {
                this.loadDrawHistory();
            }
            if (newTab === 'stats') {
                // 载入下注记录页面时，先载入直屬会员列表（预設模式）
                this.loadDirectMembersForBets();
                this.searchBets();
            }
            if (newTab === 'notices') {
                this.fetchNotices();
            }
            if (newTab === 'transactions' && this.transactionTab === 'transfers') {
                this.loadPointTransfers();
            }
            if (newTab === 'reports') {
                // 载入报表查询页面时，自動执行一次查询（今日报表）
                this.searchReports();
            }
            if (newTab === 'login-logs') {
                // 载入登录日誌页面时，自動执行一次查询（最近7天）
                this.loadLoginLogs();
            }
                                 if (newTab === 'customer-service' && this.user.level === 0) {
                         this.loadCSTransactions();
                     }
        },
        transactionTab(newTab, oldTab) {
            if (this.activeTab === 'transactions') {
                if (newTab === 'transfers') {
                    this.loadPointTransfers();
                } else if (newTab === 'rebate') {
                    this.loadRebateRecords();
                } else if (newTab === 'deposit') {
                    this.loadDepositRecords();
                } else if (newTab === 'withdraw') {
                    this.loadWithdrawRecords();
                }
            }
        },
        
        // 監聽输赢控制模式变更
        'newWinLossControl.control_mode'(newMode, oldMode) {
            console.log('控制模式变更:', oldMode, '->', newMode);
            
            // 當切換到自動偵測模式时，重置相关设定
            if (newMode === 'auto_detect') {
                // 自動偵測模式不需要手動设定比例和控制类型
                this.newWinLossControl.control_percentage = 50; // 保留预設值但不显示
                this.newWinLossControl.win_control = false;
                this.newWinLossControl.loss_control = false;
                this.newWinLossControl.target_type = '';
                this.newWinLossControl.target_username = '';
                console.log('✅ 自動偵測模式：已清空手動设定');
            }
            
            // 當切換到正常模式时，清空所有控制设定
            if (newMode === 'normal') {
                this.newWinLossControl.control_percentage = 50;
                this.newWinLossControl.win_control = false;
                this.newWinLossControl.loss_control = false;
                this.newWinLossControl.target_type = '';
                this.newWinLossControl.target_username = '';
                this.newWinLossControl.start_period = null;
                console.log('✅ 正常模式：已清空所有控制设定');
            }
            
            // 當切換到其他模式时，確保有合理的预設值
            if (newMode === 'agent_line' || newMode === 'single_member') {
                if (!this.newWinLossControl.control_percentage) {
                    this.newWinLossControl.control_percentage = 50;
                }
                console.log('✅', newMode, '模式：已设定预設比例');
            }
        }
    }
});

// 延迟掛载 Vue 应用，确保所有依赖都已载入
setTimeout(function() {
    console.log('延迟掛载 Vue 应用');
    console.log('Vue 可用性:', typeof Vue);
    console.log('Document 状态:', document.readyState);
    
    const appElement = document.getElementById('app');
    console.log('找到 app 元素:', appElement);
    
    if (appElement && typeof Vue !== 'undefined') {
        try {
            // 检查是否已经掛载过
            if (appElement.__vue_app__) {
                console.log('Vue 应用已经掛载过，跳过');
                return;
            }
            
            const mountedApp = app.mount('#app');
            console.log('Vue 应用掛载成功:', mountedApp);
            // 暴露到全域方便除錯
            window.vueApp = mountedApp;
            
            // 添加全域调试函數
            window.debugVue = function() {
                console.log('=== Vue 除錯资讯 ===');
                console.log('Vue 實例:', mountedApp);
                console.log('showNoticeForm:', mountedApp.showNoticeForm);
                console.log('noticeForm:', mountedApp.noticeForm);
                console.log('isCustomerService:', mountedApp.isCustomerService);
                
                // 测试显示公告表單
                console.log('测试显示公告表單...');
                mountedApp.startEditNotice({
                    id: 1,
                    title: '测试公告',
                    content: '这是测试内容',
                    category: '最新公告'
                });
            };
            
            window.closeForm = function() {
                mountedApp.showNoticeForm = false;
                console.log('强制关闭公告表單');
            };
            
            console.log('全域除錯函數已添加：debugVue() 和 closeForm()');
            
            // 额外检查：确保响应式變數正常工作
            setTimeout(() => {
                if (mountedApp && mountedApp.noticeForm) {
                    console.log('Vue 响应式数据检查:', {
                        noticeForm: mountedApp.noticeForm,
                        showNoticeForm: mountedApp.showNoticeForm
                    });
                }
            }, 1000);
            
        } catch (error) {
            console.error('Vue 应用掛载失败:', error);
            console.error('错误详情:', error.stack);
            
            // 嘗試重新整理页面
            setTimeout(() => {
                if (confirm('系统载入失败，是否重新整理页面？')) {
                    window.location.reload();
                }
            }, 2000);
        }
    } else {
        console.error('條件不滿足:', {
            appElement: !!appElement,
            Vue: typeof Vue
        });
        
        // 嘗試等待更长时间
        setTimeout(arguments.callee, 500);
    }
}, 100);

