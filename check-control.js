import axios from 'axios';

async function adminLogin() {
  const response = await axios.post('http://localhost:3003/api/agent/login', {
    username: 'ti2025A', password: 'ti2025A'
  });
  return { 'Authorization': response.data.token, 'x-session-token': response.data.sessionToken };
}

async function main() {
  const auth = await adminLogin();
  
  // 检查所有控制
  const list = await axios.get('http://localhost:3003/api/agent/win-loss-control', { headers: auth });
  console.log('所有控制:', JSON.stringify(list.data, null, 2));
  
  // 检查活跃控制
  const active = await axios.get('http://localhost:3003/api/agent/win-loss-control/active', { headers: auth });
  console.log('活跃控制:', JSON.stringify(active.data, null, 2));
  
  // 检查内部API
  const internal = await axios.get('http://localhost:3003/api/agent/internal/win-loss-control/active');
  console.log('内部API:', JSON.stringify(internal.data, null, 2));
}

main().catch(console.error);
