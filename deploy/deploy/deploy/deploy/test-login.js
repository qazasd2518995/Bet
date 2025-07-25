import axios from 'axios';

async function testLogin() {
    try {
        console.log('測試登入...');
        const response = await axios.post('http://localhost:3003/api/agent/login', {
            username: 'MA@x9Kp#2025$zL7',
            password: 'A$2025@xK9p#Secure!mN7qR&wZ3'
        }, {
            timeout: 5000
        });
        
        console.log('登入回應:', response.data);
        
        if (response.data.success) {
            console.log('✓ 登入成功');
            console.log('Token:', response.data.token);
        } else {
            console.log('✗ 登入失敗:', response.data.message);
        }
    } catch (error) {
        console.error('錯誤:', error.response?.data || error.message);
        if (error.response?.status === 500) {
            console.error('伺服器內部錯誤');
        }
    }
}

testLogin();