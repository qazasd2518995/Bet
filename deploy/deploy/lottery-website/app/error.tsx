'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to console
    console.error('Application error:', error);
    
    // If it's a chunk loading error, try to reload the page
    if (error.message && error.message.includes('Loading chunk')) {
      console.log('Chunk loading error detected, reloading page...');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">出错了！</h2>
        <p className="text-gray-600 mb-6">
          加载应用程序时遇到错误。这可能是由于最近的更新导致的。
        </p>
        <div className="space-y-3">
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-blue-500 text-white rounded px-4 py-2 hover:bg-blue-600 transition-colors"
          >
            重新加载页面
          </button>
          <button
            onClick={() => reset()}
            className="w-full bg-gray-200 text-gray-800 rounded px-4 py-2 hover:bg-gray-300 transition-colors"
          >
            重试
          </button>
        </div>
        {error.digest && (
          <p className="text-xs text-gray-400 mt-4">错误 ID: {error.digest}</p>
        )}
      </div>
    </div>
  );
}