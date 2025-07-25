'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4">严重错误</h2>
            <p className="text-gray-600 mb-6">
              应用程序遇到严重错误。请刷新页面。
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-red-500 text-white rounded px-4 py-2 hover:bg-red-600"
            >
              刷新页面
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}