// 编辑代理功能
const app = Vue.component('edit-agent', {
    methods: {
        // 编辑代理
        async editAgent(agent) {
            console.log('编辑代理:', agent);
            
            // 初始化编辑资料
            this.editAgentData = {
                id: agent.id,
                username: agent.username,
                password: '', // 留空表示不修改
                commission: agent.commission,
                status: agent.status
            };
            
            this.showEditAgentModal = true;
            this.$nextTick(() => {
                // 確保模態框已經存在才显示
                if (document.getElementById('editAgentModal')) {
                    this.editAgentModal = new bootstrap.Modal(document.getElementById('editAgentModal'));
                    this.editAgentModal.show();
                } else {
                    console.error('找不到编辑代理模態框元素');
                }
            });
        },
        
        // 更新代理资讯
        async updateAgent() {
            if (!this.editAgentData.id) {
                return this.showMessage('缺少代理ID', 'error');
            }
            
            this.loading = true;
            
            try {
                // 使用update-status API更新代理资讯(暫时替代方案)
                // 待後端實現專门的更新API
                const url = `${API_BASE_URL}/update-status`;
                
                const response = await axios.put(url, {
                    id: this.editAgentData.id,
                    status: this.editAgentData.status
                });
                
                if (response.data.success) {
                    this.showMessage('更新代理状态成功', 'success');
                    
                    // 关闭模態框
                    if (this.editAgentModal) {
                        this.editAgentModal.hide();
                    }
                    this.showEditAgentModal = false;
                    
                    // 重新获取代理列表
                    await this.fetchAgents();
                } else {
                    this.showMessage(response.data.message || '更新代理资讯失败', 'error');
                }
            } catch (error) {
                console.error('更新代理错误:', error);
                this.showMessage(error.response?.data?.message || '更新代理资讯失败', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 隐藏编辑代理模態框
        hideEditAgentModal() {
            if (this.editAgentModal) {
                this.editAgentModal.hide();
            }
            this.showEditAgentModal = false;
        }
    }
});
