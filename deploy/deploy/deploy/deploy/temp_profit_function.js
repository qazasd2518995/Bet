                // 獲取盈虧記錄
                getProfitRecords() {
                    const username = sessionStorage.getItem('username');
                    if (!username) {
                        console.error('用戶未登入，無法獲取盈虧記錄');
                        return;
                    }
                    
                    // 計算週的開始和結束日期
                    const now = new Date();
                    let startDate, endDate;
                    
                    if (this.profitTimeRange === 'thisWeek') {
                        // 本週：從這週的星期一到星期日
                        const currentWeekday = now.getDay(); // 0=星期日, 1=星期一, ...
                        const daysToMonday = currentWeekday === 0 ? 6 : currentWeekday - 1; // 計算到星期一的天數
                        
                        startDate = new Date(now);
                        startDate.setDate(now.getDate() - daysToMonday);
                        startDate.setHours(0, 0, 0, 0);
                        
                        endDate = new Date(startDate);
                        endDate.setDate(startDate.getDate() + 6);
                        endDate.setHours(23, 59, 59, 999);
                    } else if (this.profitTimeRange === 'lastWeek') {
                        // 上週：從上週的星期一到星期日
                        const currentWeekday = now.getDay();
                        const daysToMonday = currentWeekday === 0 ? 6 : currentWeekday - 1;
                        
                        startDate = new Date(now);
                        startDate.setDate(now.getDate() - daysToMonday - 7); // 往前推一週
                        startDate.setHours(0, 0, 0, 0);
                        
                        endDate = new Date(startDate);
                        endDate.setDate(startDate.getDate() + 6);
                        endDate.setHours(23, 59, 59, 999);
                    }
                    
                    const weekType = this.profitTimeRange === 'thisWeek' ? '本週' : '上週';
                    console.log(`正在獲取用戶 ${username} 的${weekType}盈虧記錄...`);
                    console.log(`週期範圍: ${startDate.toISOString()} 到 ${endDate.toISOString()}`);
                    
                    fetch(`${this.API_BASE_URL}/api/weekly-profit-records?username=${username}&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`)
                        .then(response => {
                            console.log('盈虧記錄API響應狀態:', response.status);
                            return response.json();
                        })
                        .then(data => {
                            console.log('盈虧記錄API響應數據:', data);
                            if (data.success) {
                                this.profitRecords = data.records || [];
                                this.totalBetCount = data.totalBetCount || 0;
                                this.totalProfit = data.totalProfit || 0;
                                console.log(`成功載入 ${this.profitRecords.length} 條盈虧記錄`);
                            } else {
                                console.error('獲取盈虧記錄失敗:', data.message);
                                this.profitRecords = [];
                                this.totalBetCount = 0;
                                this.totalProfit = 0;
                            }
                        })
                        .catch(error => {
                            console.error('獲取盈虧記錄出錯:', error);
                            this.profitRecords = [];
                            this.totalBetCount = 0;
                            this.totalProfit = 0;
                        });
                },
