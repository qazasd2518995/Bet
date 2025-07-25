'use client';

import { useState, useEffect } from 'react';

export default function TestPage() {
  const [apiData, setApiData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/game-state');
        const data = await response.json();
        setApiData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="p-4">加载中...</div>;
  if (error) return <div className="p-4 text-red-500">错误: {error}</div>;

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">API 连接测试</h1>
      
      <div className="bg-gray-100 p-4 rounded">
        <h2 className="text-lg font-semibold mb-2">API 响应:</h2>
        <pre className="text-sm overflow-auto">
          {JSON.stringify(apiData, null, 2)}
        </pre>
      </div>

      {apiData?.success && (
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="bg-blue-100 p-3 rounded">
            <div className="font-semibold">期号</div>
            <div>{apiData.data.current_period}</div>
          </div>
          <div className="bg-green-100 p-3 rounded">
            <div className="font-semibold">倒计时</div>
            <div>{apiData.data.countdown_seconds}秒</div>
          </div>
          <div className="bg-yellow-100 p-3 rounded">
            <div className="font-semibold">状态</div>
            <div>{apiData.data.status}</div>
          </div>
          <div className="bg-purple-100 p-3 rounded">
            <div className="font-semibold">上期结果</div>
            <div>{apiData.data.last_result?.join(', ')}</div>
          </div>
        </div>
      )}
    </div>
  );
}