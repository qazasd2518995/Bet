// fix-range-error.js - 修复 RangeNotSatisfiableError

// 在 backend.js 中的 express.static 后面添加错误处理中间件：

// 处理 Range Not Satisfiable 错误
app.use((err, req, res, next) => {
    if (err.status === 416 || err.message === 'Range Not Satisfiable') {
        console.log('处理 Range Not Satisfiable 错误:', req.url);
        // 返回完整文件而不是部分内容
        res.status(200);
        next();
    } else {
        next(err);
    }
});

// 或者修改静态文件配置，禁用范围请求：
app.use(express.static(path.join(__dirname, 'frontend'), {
    acceptRanges: false,
    etag: false,
    lastModified: false
}));

// 建议的完整修复方案：
// 1. 在 backend.js 中找到这行：
//    app.use(express.static(path.join(__dirname, 'frontend')));
//
// 2. 替换为：
//    app.use(express.static(path.join(__dirname, 'frontend'), {
//        acceptRanges: false,
//        setHeaders: (res, path, stat) => {
//            res.set('Cache-Control', 'no-store');
//        }
//    }));
//
// 3. 在所有路由后面添加错误处理：
//    app.use((err, req, res, next) => {
//        if (err.status === 416) {
//            console.log('Range Not Satisfiable 错误，返回完整文件');
//            res.status(200).sendFile(req.path);
//        } else {
//            console.error('伺服器错误:', err);
//            res.status(err.status || 500).json({
//                success: false,
//                message: err.message || '伺服器内部错误'
//            });
//        }
//    });