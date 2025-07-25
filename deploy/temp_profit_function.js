                // 获取盈亏记录
                getProfitRecords() {
                    const username = sessionStorage.getItem('username');
                    if (!username) {
                        console.error('用户未登入，无法获取盈亏记录');
                        return;
                    }
                    
                    // 计算周的开始和结束日期
                    const now = new Date();
                    let startDate, endDate;
                    
                    if (this.profitTimeRange === 'thisWeek') {
                        // 本周：从这周的星期一到星期日
                        const currentWeekday = now.getDay(); // 0=星期日, 1=星期一, ...
                        const daysToMonday = currentWeekday === 0 ? 6 : currentWeekday - 1; // 计算到星期一的天数
                        
                        startDate = new Date(now);
                        startDate.setDate(now.getDate() - daysToMonday);
                        startDate.setHours(0, 0, 0, 0);
                        
                        endDate = new Date(startDate);
                        endDate.setDate(startDate.getDate() + 6);
                        endDate.setHours(23, 59, 59, 999);
                    } else if (this.profitTimeRange === 'lastWeek') {
                        // 上周：从上周的星期一到星期日
                        const currentWeekday = now.getDay();
                        const daysToMonday = currentWeekday === 0 ? 6 : currentWeekday - 1;
                        
                        startDate = new Date(now);
                        startDate.setDate(now.getDate() - daysToMonday - 7); // 往前推一周
                        startDate.setHours(0, 0, 0, 0);
                        
                        endDate = new Date(startDate);
                        endDate.setDate(startDate.getDate() + 6);
                        endDate.setHours(23, 59, 59, 999);
                    }
                    
                    const weekType = this.profitTimeRange === 'thisWeek' ? '本周' : '上周';
                    console.log(`正在获取用户 ${username} 的${weekType}盈亏记录...`);
                    console.log(`周期范围: ${startDate.toISOString()} 到 ${endDate.toISOString()}`);
                    
                    fetch(`${this.API_BASE_URL}/api/weekly-profit-records?username=${username}&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`)
                        .then(response => {
                            console.log('盈亏记录API响应状态:', response.status);
                            return response.json();
                        })
                        .then(data => {
                            console.log('盈亏记录API响应数据:', data);
                            if (data.success) {
                                this.profitRecords = data.records || [];
                                this.totalBetCount = data.totalBetCount || 0;
                                this.totalProfit = data.totalProfit || 0;
                                console.log(`成功载入 ${this.profitRecords.length} 条盈亏记录`);
                            } else {
                                console.error('获取盈亏记录失败:', data.message);
                                this.profitRecords = [];
                                this.totalBetCount = 0;
                                this.totalProfit = 0;
                            }
                        })
                        .catch(error => {
                            console.error('获取盈亏记录出错:', error);
                            this.profitRecords = [];
                            this.totalBetCount = 0;
                            this.totalProfit = 0;
                        });
                },
