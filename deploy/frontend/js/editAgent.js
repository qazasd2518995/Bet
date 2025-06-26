// 編輯代理功能
const app = Vue.component('edit-agent', {
    methods: {
        // 編輯代理
        async editAgent(agent) {
            console.log('編輯代理:', agent);
            
            // 初始化編輯資料
            this.editAgentData = {
                id: agent.id,
                username: agent.username,
                password: '', // 留空表示不修改
                commission: agent.commission,
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
        }
    }
});
