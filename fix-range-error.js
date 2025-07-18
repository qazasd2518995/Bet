// fix-range-error.js - 修復 RangeNotSatisfiableError

// 在 backend.js 中的 express.static 後面添加錯誤處理中間件：

// 處理 Range Not Satisfiable 錯誤
app.use((err, req, res, next) => {
    if (err.status === 416 || err.message === 'Range Not Satisfiable') {
        console.log('處理 Range Not Satisfiable 錯誤:', req.url);
        // 返回完整文件而不是部分內容
        res.status(200);
        next();
    } else {
        next(err);
    }
});

// 或者修改靜態文件配置，禁用範圍請求：
app.use(express.static(path.join(__dirname, 'frontend'), {
    acceptRanges: false,
    etag: false,
    lastModified: false
}));

// 建議的完整修復方案：
// 1. 在 backend.js 中找到這行：
//    app.use(express.static(path.join(__dirname, 'frontend')));
//
// 2. 替換為：
//    app.use(express.static(path.join(__dirname, 'frontend'), {
//        acceptRanges: false,
//        setHeaders: (res, path, stat) => {
//            res.set('Cache-Control', 'no-store');
//        }
//    }));
//
// 3. 在所有路由後面添加錯誤處理：
//    app.use((err, req, res, next) => {
//        if (err.status === 416) {
//            console.log('Range Not Satisfiable 錯誤，返回完整文件');
//            res.status(200).sendFile(req.path);
//        } else {
//            console.error('伺服器錯誤:', err);
//            res.status(err.status || 500).json({
//                success: false,
//                message: err.message || '伺服器內部錯誤'
//            });
//        }
//    });