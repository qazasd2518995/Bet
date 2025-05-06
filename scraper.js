// scraper.js - 網頁爬蟲工具
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

/**
 * 等待指定的毫秒數
 * @param {Page} page - Puppeteer 頁面對象
 * @param {number} timeout - 等待時間（毫秒）
 */
async function waitTimeout(page, timeout) {
    await page.evaluate(timeout => new Promise(resolve => setTimeout(resolve, timeout)), timeout);
}

/**
 * 爬取網頁內容
 * @param {string} url - 要爬取的網址
 * @param {Object} options - 爬取選項
 * @returns {Promise<Object>} - 返回爬取的內容
 */
async function scrapeWebsite(url, options = {}) {
    const defaultOptions = {
        saveHtml: true,
        saveCss: true,
        saveJs: true,
        saveImages: false,
        outputDir: path.join(__dirname, 'scraped')
    };

    const config = { ...defaultOptions, ...options };
    
    console.log(`開始爬取網站: ${url}`);
    
    // 創建輸出目錄
    if (!fs.existsSync(config.outputDir)) {
        fs.mkdirSync(config.outputDir, { recursive: true });
    }
    
    // 啟動瀏覽器
    const browser = await puppeteer.launch({
        headless: 'new', // 使用新的無頭模式
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        
        // 設置視窗大小
        await page.setViewport({ width: 1920, height: 1080 });
        
        // 訪問目標網址
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        
        // 獲取頁面內容
        const htmlContent = await page.content();
        
        // 使用 cheerio 解析 HTML
        const $ = cheerio.load(htmlContent);
        
        // 提取信息
        const title = $('title').text();
        const metaTags = [];
        $('meta').each((i, el) => {
            const attributes = {};
            Object.keys(el.attribs).forEach(key => {
                attributes[key] = el.attribs[key];
            });
            metaTags.push(attributes);
        });
        
        // 收集結果數據
        const result = {
            title,
            url,
            metaTags,
            html: htmlContent
        };
        
        // 保存 HTML
        if (config.saveHtml) {
            fs.writeFileSync(
                path.join(config.outputDir, 'index.html'),
                htmlContent
            );
            console.log('HTML 已保存');
        }
        
        // 提取並保存 CSS
        if (config.saveCss) {
            const cssLinks = [];
            $('link[rel="stylesheet"]').each((i, el) => {
                const href = $(el).attr('href');
                if (href) cssLinks.push(href);
            });
            
            // 創建 CSS 目錄
            const cssDir = path.join(config.outputDir, 'css');
            if (!fs.existsSync(cssDir)) {
                fs.mkdirSync(cssDir, { recursive: true });
            }
            
            // 下載 CSS 文件
            for (const [index, link] of cssLinks.entries()) {
                try {
                    let cssUrl = link;
                    if (link.startsWith('//')) {
                        cssUrl = 'https:' + link;
                    } else if (!link.startsWith('http')) {
                        cssUrl = new URL(link, url).href;
                    }
                    
                    const response = await axios.get(cssUrl, { responseType: 'text' });
                    const cssFileName = `style-${index + 1}.css`;
                    fs.writeFileSync(path.join(cssDir, cssFileName), response.data);
                    console.log(`CSS 已保存: ${cssFileName}`);
                } catch (error) {
                    console.error(`下載 CSS 文件 ${link} 失敗:`, error.message);
                }
            }
            
            result.cssFiles = cssLinks.length;
        }
        
        // 提取並保存 JavaScript
        if (config.saveJs) {
            const scriptLinks = [];
            $('script[src]').each((i, el) => {
                const src = $(el).attr('src');
                if (src) scriptLinks.push(src);
            });
            
            // 創建 JS 目錄
            const jsDir = path.join(config.outputDir, 'js');
            if (!fs.existsSync(jsDir)) {
                fs.mkdirSync(jsDir, { recursive: true });
            }
            
            // 下載 JS 文件
            for (const [index, link] of scriptLinks.entries()) {
                try {
                    let jsUrl = link;
                    if (link.startsWith('//')) {
                        jsUrl = 'https:' + link;
                    } else if (!link.startsWith('http')) {
                        jsUrl = new URL(link, url).href;
                    }
                    
                    const response = await axios.get(jsUrl, { responseType: 'text' });
                    const jsFileName = `script-${index + 1}.js`;
                    fs.writeFileSync(path.join(jsDir, jsFileName), response.data);
                    console.log(`JavaScript 已保存: ${jsFileName}`);
                } catch (error) {
                    console.error(`下載 JavaScript 文件 ${link} 失敗:`, error.message);
                }
            }
            
            result.jsFiles = scriptLinks.length;
        }
        
        // 提取並保存圖片
        if (config.saveImages) {
            const imageLinks = [];
            $('img[src]').each((i, el) => {
                const src = $(el).attr('src');
                if (src) imageLinks.push(src);
            });
            
            // 創建圖片目錄
            const imgDir = path.join(config.outputDir, 'images');
            if (!fs.existsSync(imgDir)) {
                fs.mkdirSync(imgDir, { recursive: true });
            }
            
            // 下載圖片
            for (const [index, link] of imageLinks.entries()) {
                try {
                    let imgUrl = link;
                    if (link.startsWith('//')) {
                        imgUrl = 'https:' + link;
                    } else if (!link.startsWith('http')) {
                        imgUrl = new URL(link, url).href;
                    }
                    
                    const response = await axios.get(imgUrl, { responseType: 'arraybuffer' });
                    const extension = path.extname(imgUrl) || '.jpg';
                    const imgFileName = `image-${index + 1}${extension}`;
                    fs.writeFileSync(path.join(imgDir, imgFileName), response.data);
                    console.log(`圖片已保存: ${imgFileName}`);
                } catch (error) {
                    console.error(`下載圖片 ${link} 失敗:`, error.message);
                }
            }
            
            result.imageFiles = imageLinks.length;
        }
        
        return result;
    } finally {
        await browser.close();
        console.log('爬取完成！');
    }
}

/**
 * 爬取需要登入的網頁內容
 * @param {string} url - 要爬取的網址
 * @param {Object} loginInfo - 登入信息
 * @param {Object} options - 爬取選項
 * @returns {Promise<Object>} - 返回爬取的內容
 */
async function scrapeWithLogin(url, loginInfo, options = {}) {
    const defaultOptions = {
        saveHtml: true,
        saveCss: true,
        saveJs: true,
        saveImages: false,
        outputDir: path.join(__dirname, 'scraped'),
        loginUrl: null,  // 如果登入頁面與主頁不同，可以指定登入頁面的 URL
        loginSelectors: {
            usernameField: 'input[name="username"], input[name="account"], input[name="email"], input[type="text"]',
            passwordField: 'input[name="password"], input[type="password"]',
            submitButton: 'button[type="submit"], input[type="submit"], button:contains("登入"), button:contains("Login"), button:contains("login"), button[class*="login"]'
        },
        afterLoginWaitTime: 5000,  // 登入後等待的時間（毫秒）
        extraWaitForSelector: null  // 登入後額外等待的選擇器
    };

    const config = { ...defaultOptions, ...options };
    
    console.log(`開始爬取需要登入的網站: ${url}`);
    console.log(`使用帳號: ${loginInfo.username}`);
    
    // 創建輸出目錄
    if (!fs.existsSync(config.outputDir)) {
        fs.mkdirSync(config.outputDir, { recursive: true });
    }
    
    // 啟動瀏覽器
    const browser = await puppeteer.launch({
        headless: false,  // 使用有頭模式方便查看登入過程
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
        defaultViewport: null
    });
    
    try {
        const page = await browser.newPage();
        
        // 設置視窗大小
        await page.setViewport({ width: 1920, height: 1080 });
        
        // 先訪問登入頁面
        const loginUrl = config.loginUrl || url;
        console.log(`訪問登入頁面: ${loginUrl}`);
        await page.goto(loginUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        
        // 等待頁面加載完成
        await waitTimeout(page, 2000);
        
        // 填寫登入表單
        console.log('開始填寫登入表單...');
        
        // 檢查是否有指定的登入選擇器
        const usernameSelector = config.loginSelectors.usernameField;
        const passwordSelector = config.loginSelectors.passwordField;
        const submitSelector = config.loginSelectors.submitButton;
        
        // 嘗試填寫用戶名
        try {
            await page.waitForSelector(usernameSelector, { timeout: 5000 });
            await page.type(usernameSelector, loginInfo.username);
            console.log(`填寫用戶名: ${loginInfo.username}`);
        } catch (error) {
            console.error('無法找到用戶名輸入框:', error.message);
            console.log('請手動指定正確的用戶名選擇器');
            // 提供當前頁面上的所有輸入框
            const inputFields = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('input')).map(input => {
                    return {
                        type: input.type,
                        name: input.name,
                        id: input.id,
                        placeholder: input.placeholder
                    };
                });
            });
            console.log('頁面上的輸入框:', JSON.stringify(inputFields, null, 2));
        }
        
        // 等待一下，模擬人類行為
        await waitTimeout(page, 1000);
        
        // 嘗試填寫密碼
        try {
            await page.waitForSelector(passwordSelector, { timeout: 5000 });
            await page.type(passwordSelector, loginInfo.password);
            console.log(`填寫密碼: ******`);
        } catch (error) {
            console.error('無法找到密碼輸入框:', error.message);
            console.log('請手動指定正確的密碼選擇器');
        }
        
        // 等待一下，模擬人類行為
        await waitTimeout(page, 1000);
        
        // 嘗試點擊登入按鈕
        try {
            await page.waitForSelector(submitSelector, { timeout: 5000 });
            console.log('點擊登入按鈕...');
            
            // 截圖登入前的頁面
            await page.screenshot({ path: path.join(config.outputDir, 'before-login.png') });
            
            // 點擊登入按鈕
            await Promise.all([
                page.click(submitSelector),
                page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(e => console.log('導航等待超時，但繼續執行'))
            ]);
        } catch (error) {
            console.error('無法找到或點擊登入按鈕:', error.message);
            console.log('請手動指定正確的登入按鈕選擇器');
            // 提供當前頁面上的所有按鈕
            const buttons = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('button, input[type="submit"]')).map(button => {
                    return {
                        type: button.type,
                        name: button.name,
                        id: button.id,
                        text: button.textContent.trim()
                    };
                });
            });
            console.log('頁面上的按鈕:', JSON.stringify(buttons, null, 2));
        }
        
        // 等待登入完成
        console.log(`等待登入完成 (${config.afterLoginWaitTime / 1000} 秒)...`);
        await waitTimeout(page, config.afterLoginWaitTime);
        
        // 如果有指定登入後等待的選擇器，則等待該選擇器出現
        if (config.extraWaitForSelector) {
            console.log(`等待選擇器出現: ${config.extraWaitForSelector}`);
            try {
                await page.waitForSelector(config.extraWaitForSelector, { timeout: 10000 });
            } catch (error) {
                console.warn(`等待選擇器超時: ${config.extraWaitForSelector}，但繼續執行`);
            }
        }
        
        // 截圖登入後的頁面
        await page.screenshot({ path: path.join(config.outputDir, 'after-login.png') });
        
        // 檢查是否登入成功
        console.log('檢查是否登入成功...');
        const loginSuccess = await page.evaluate(() => {
            // 嘗試通過文本內容檢查是否有登出相關元素
            const elements = Array.from(document.querySelectorAll('a, button'));
            const logoutElements = elements.filter(el => 
                el.textContent.includes('登出') || 
                el.textContent.includes('Logout') || 
                el.textContent.toLowerCase().includes('sign out') ||
                el.textContent.toLowerCase().includes('log out')
            );
            
            // 檢查是否有用戶信息相關元素
            const userElements = document.querySelectorAll('.user-name, .username, .user-info, .account-info');
            
            // 檢查URL是否包含會員中心等路徑
            const isInMemberArea = window.location.href.includes('member') || 
                                  window.location.href.includes('account') || 
                                  window.location.href.includes('profile');
                                  
            return logoutElements.length > 0 || userElements.length > 0 || isInMemberArea;
        });
        
        if (loginSuccess) {
            console.log('登入成功！');
        } else {
            console.warn('可能登入失敗，但繼續執行...');
        }
        
        // 如果登入頁面與目標頁面不同，則導航到目標頁面
        if (config.loginUrl && config.loginUrl !== url) {
            console.log(`導航到目標頁面: ${url}`);
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        }
        
        // 等待頁面完全加載
        await waitTimeout(page, 3000);
        
        // 獲取頁面內容
        const htmlContent = await page.content();
        
        // 使用 cheerio 解析 HTML
        const $ = cheerio.load(htmlContent);
        
        // 提取信息
        const title = $('title').text();
        const metaTags = [];
        $('meta').each((i, el) => {
            const attributes = {};
            Object.keys(el.attribs).forEach(key => {
                attributes[key] = el.attribs[key];
            });
            metaTags.push(attributes);
        });
        
        // 收集結果數據
        const result = {
            title,
            url,
            metaTags,
            html: htmlContent,
            loginSuccess
        };
        
        // 保存 HTML
        if (config.saveHtml) {
            fs.writeFileSync(
                path.join(config.outputDir, 'index.html'),
                htmlContent
            );
            console.log('HTML 已保存');
        }
        
        // 以下是原有的提取 CSS、JS 和圖片的代碼
        // 提取並保存 CSS
        if (config.saveCss) {
            const cssLinks = [];
            $('link[rel="stylesheet"]').each((i, el) => {
                const href = $(el).attr('href');
                if (href) cssLinks.push(href);
            });
            
            // 創建 CSS 目錄
            const cssDir = path.join(config.outputDir, 'css');
            if (!fs.existsSync(cssDir)) {
                fs.mkdirSync(cssDir, { recursive: true });
            }
            
            // 下載 CSS 文件
            for (const [index, link] of cssLinks.entries()) {
                try {
                    let cssUrl = link;
                    if (link.startsWith('//')) {
                        cssUrl = 'https:' + link;
                    } else if (!link.startsWith('http')) {
                        cssUrl = new URL(link, url).href;
                    }
                    
                    const response = await axios.get(cssUrl, { responseType: 'text' });
                    const cssFileName = `style-${index + 1}.css`;
                    fs.writeFileSync(path.join(cssDir, cssFileName), response.data);
                    console.log(`CSS 已保存: ${cssFileName}`);
                } catch (error) {
                    console.error(`下載 CSS 文件 ${link} 失敗:`, error.message);
                }
            }
            
            result.cssFiles = cssLinks.length;
        }
        
        // 提取並保存 JavaScript
        if (config.saveJs) {
            const scriptLinks = [];
            $('script[src]').each((i, el) => {
                const src = $(el).attr('src');
                if (src) scriptLinks.push(src);
            });
            
            // 創建 JS 目錄
            const jsDir = path.join(config.outputDir, 'js');
            if (!fs.existsSync(jsDir)) {
                fs.mkdirSync(jsDir, { recursive: true });
            }
            
            // 下載 JS 文件
            for (const [index, link] of scriptLinks.entries()) {
                try {
                    let jsUrl = link;
                    if (link.startsWith('//')) {
                        jsUrl = 'https:' + link;
                    } else if (!link.startsWith('http')) {
                        jsUrl = new URL(link, url).href;
                    }
                    
                    const response = await axios.get(jsUrl, { responseType: 'text' });
                    const jsFileName = `script-${index + 1}.js`;
                    fs.writeFileSync(path.join(jsDir, jsFileName), response.data);
                    console.log(`JavaScript 已保存: ${jsFileName}`);
                } catch (error) {
                    console.error(`下載 JavaScript 文件 ${link} 失敗:`, error.message);
                }
            }
            
            result.jsFiles = scriptLinks.length;
        }
        
        // 提取並保存圖片
        if (config.saveImages) {
            const imageLinks = [];
            $('img[src]').each((i, el) => {
                const src = $(el).attr('src');
                if (src) imageLinks.push(src);
            });
            
            // 創建圖片目錄
            const imgDir = path.join(config.outputDir, 'images');
            if (!fs.existsSync(imgDir)) {
                fs.mkdirSync(imgDir, { recursive: true });
            }
            
            // 下載圖片
            for (const [index, link] of imageLinks.entries()) {
                try {
                    let imgUrl = link;
                    if (link.startsWith('//')) {
                        imgUrl = 'https:' + link;
                    } else if (!link.startsWith('http')) {
                        imgUrl = new URL(link, url).href;
                    }
                    
                    const response = await axios.get(imgUrl, { responseType: 'arraybuffer' });
                    const extension = path.extname(imgUrl) || '.jpg';
                    const imgFileName = `image-${index + 1}${extension}`;
                    fs.writeFileSync(path.join(imgDir, imgFileName), response.data);
                    console.log(`圖片已保存: ${imgFileName}`);
                } catch (error) {
                    console.error(`下載圖片 ${link} 失敗:`, error.message);
                }
            }
            
            result.imageFiles = imageLinks.length;
        }
        
        return result;
    } finally {
        // 提示用戶是否關閉瀏覽器
        console.log('爬取完成！按 Enter 鍵關閉瀏覽器...');
        await new Promise(resolve => {
            process.stdin.once('data', () => {
                resolve();
            });
        });
        
        await browser.close();
    }
}

/**
 * 爬取需要登入和驗證碼的網頁內容
 * @param {string} url - 要爬取的網址
 * @param {Object} loginInfo - 登入信息
 * @param {Object} options - 爬取選項
 * @returns {Promise<Object>} - 返回爬取的內容
 */
async function scrapeWithLoginAndCaptcha(url, loginInfo, options = {}) {
    const defaultOptions = {
        saveHtml: true,
        saveCss: true,
        saveJs: true,
        saveImages: false,
        outputDir: path.join(__dirname, 'scraped'),
        loginUrl: null,  // 如果登入頁面與主頁不同，可以指定登入頁面的 URL
        loginSelectors: {
            usernameField: 'input[name="username"], input[name="account"], input[name="email"], input[type="text"]',
            passwordField: 'input[name="password"], input[type="password"]',
            captchaField: 'input[name="captcha"], input[id="captcha"], input[placeholder*="驗證碼"], input[placeholder*="验证码"], input[class*="captcha"], .captcha input, input[placeholder="CAPTCHA"]',
            captchaImg: 'img[alt*="驗證碼"], img[alt*="验证码"], img.captcha, img.verifycode, img[src*="captcha"], img[src*="verifycode"], img[id*="captcha"]',
            submitButton: 'button[type="submit"], input[type="submit"], button:contains("登入"), button:contains("Login"), button:contains("login"), button[class*="login"], .login-button, button, div.login, div[class*="login"]'
        },
        afterLoginWaitTime: 5000,  // 登入後等待的時間（毫秒）
        extraWaitForSelector: null  // 登入後額外等待的選擇器
    };

    const config = { ...defaultOptions, ...options };
    
    console.log(`開始爬取需要登入和驗證碼的網站: ${url}`);
    console.log(`使用帳號: ${loginInfo.username}`);
    
    // 創建輸出目錄
    if (!fs.existsSync(config.outputDir)) {
        fs.mkdirSync(config.outputDir, { recursive: true });
    }
    
    // 啟動瀏覽器
    const browser = await puppeteer.launch({
        headless: false,  // 使用有頭模式方便查看登入過程
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
        defaultViewport: null
    });
    
    try {
        const page = await browser.newPage();
        
        // 設置視窗大小
        await page.setViewport({ width: 1920, height: 1080 });
        
        // 先訪問登入頁面
        const loginUrl = config.loginUrl || url;
        console.log(`訪問登入頁面: ${loginUrl}`);
        await page.goto(loginUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        
        // 等待頁面加載完成
        await waitTimeout(page, 2000);
        
        // 填寫登入表單
        console.log('開始填寫登入表單...');
        
        // 檢查是否有指定的登入選擇器
        const usernameSelector = config.loginSelectors.usernameField;
        const passwordSelector = config.loginSelectors.passwordField;
        const captchaSelector = config.loginSelectors.captchaField;
        const captchaImgSelector = config.loginSelectors.captchaImg;
        const submitSelector = config.loginSelectors.submitButton;
        
        // 嘗試填寫用戶名
        try {
            await page.waitForSelector(usernameSelector, { timeout: 5000 });
            await page.type(usernameSelector, loginInfo.username);
            console.log(`填寫用戶名: ${loginInfo.username}`);
        } catch (error) {
            console.error('無法找到用戶名輸入框:', error.message);
            console.log('請手動指定正確的用戶名選擇器');
            // 提供當前頁面上的所有輸入框
            const inputFields = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('input')).map(input => {
                    return {
                        type: input.type,
                        name: input.name,
                        id: input.id,
                        placeholder: input.placeholder
                    };
                });
            });
            console.log('頁面上的輸入框:', JSON.stringify(inputFields, null, 2));
        }
        
        // 等待一下，模擬人類行為
        await waitTimeout(page, 1000);
        
        // 嘗試填寫密碼
        try {
            await page.waitForSelector(passwordSelector, { timeout: 5000 });
            await page.type(passwordSelector, loginInfo.password);
            console.log(`填寫密碼: ******`);
        } catch (error) {
            console.error('無法找到密碼輸入框:', error.message);
            console.log('請手動指定正確的密碼選擇器');
        }
        
        // 等待一下，模擬人類行為
        await waitTimeout(page, 1000);

        // 處理驗證碼
        try {
            // 檢查頁面是否有驗證碼輸入框
            const hasCaptchaField = await page.evaluate((selector) => {
                return document.querySelector(selector) !== null;
            }, captchaSelector);

            if (hasCaptchaField) {
                console.log('發現驗證碼輸入框，開始處理驗證碼...');
                
                // 嘗試找到驗證碼圖片
                const hasCaptchaImg = await page.evaluate((selector) => {
                    return document.querySelector(selector) !== null;
                }, captchaImgSelector);

                if (hasCaptchaImg) {
                    // 截取驗證碼圖片
                    const captchaImgElement = await page.$(captchaImgSelector);
                    if (captchaImgElement) {
                        const captchaImgPath = path.join(config.outputDir, 'captcha.png');
                        await captchaImgElement.screenshot({ path: captchaImgPath });
                        console.log(`驗證碼圖片已保存至: ${captchaImgPath}`);
                        
                        // 打開驗證碼圖片
                        const os = require('os');
                        const platform = os.platform();
                        if (platform === 'darwin') {
                            require('child_process').execSync(`open ${captchaImgPath}`);
                        } else if (platform === 'win32') {
                            require('child_process').execSync(`start ${captchaImgPath}`);
                        } else if (platform === 'linux') {
                            require('child_process').execSync(`xdg-open ${captchaImgPath}`);
                        }
                        
                        // 讓用戶輸入驗證碼
                        const readline = require('readline').createInterface({
                            input: process.stdin,
                            output: process.stdout
                        });
                        
                        const captchaCode = await new Promise((resolve) => {
                            readline.question('請查看打開的圖片並輸入驗證碼: ', (answer) => {
                                readline.close();
                                resolve(answer);
                            });
                        });
                        
                        // 填入驗證碼
                        await page.type(captchaSelector, captchaCode);
                        console.log(`已填入驗證碼: ${captchaCode}`);
                    } else {
                        console.error('找到驗證碼選擇器但無法獲取元素');
                    }
                } else {
                    console.error('無法找到驗證碼圖片');
                    // 顯示所有圖片元素
                    const imgElements = await page.evaluate(() => {
                        return Array.from(document.querySelectorAll('img')).map(img => {
                            return {
                                src: img.src,
                                alt: img.alt,
                                id: img.id,
                                class: img.className
                            };
                        });
                    });
                    console.log('頁面上的圖片元素:', JSON.stringify(imgElements, null, 2));
                    
                    // 讓用戶手動查看網頁並輸入驗證碼
                    const readline = require('readline').createInterface({
                        input: process.stdin,
                        output: process.stdout
                    });
                    
                    const captchaCode = await new Promise((resolve) => {
                        readline.question('請在瀏覽器中查看驗證碼並輸入: ', (answer) => {
                            readline.close();
                            resolve(answer);
                        });
                    });
                    
                    // 填入驗證碼
                    await page.type(captchaSelector, captchaCode);
                    console.log(`已填入驗證碼: ${captchaCode}`);
                }
            } else {
                console.log('沒有找到驗證碼輸入框，跳過驗證碼處理');
            }
        } catch (error) {
            console.error('處理驗證碼時出錯:', error.message);
        }
        
        // 等待一下，模擬人類行為
        await waitTimeout(page, 1000);
        
        // 嘗試點擊登入按鈕
        try {
            await page.waitForSelector(submitSelector, { timeout: 5000 });
            console.log('點擊登入按鈕...');
            
            // 截圖登入前的頁面
            await page.screenshot({ path: path.join(config.outputDir, 'before-login.png') });
            
            // 點擊登入按鈕
            await Promise.all([
                page.click(submitSelector),
                page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(e => console.log('導航等待超時，但繼續執行'))
            ]);
        } catch (error) {
            console.error('無法找到或點擊登入按鈕:', error.message);
            console.log('請手動指定正確的登入按鈕選擇器');
            // 提供當前頁面上的所有按鈕
            const buttons = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('button, input[type="submit"]')).map(button => {
                    return {
                        type: button.type,
                        name: button.name,
                        id: button.id,
                        text: button.textContent.trim()
                    };
                });
            });
            console.log('頁面上的按鈕:', JSON.stringify(buttons, null, 2));
        }
        
        // 等待登入完成
        console.log(`等待登入完成 (${config.afterLoginWaitTime / 1000} 秒)...`);
        await waitTimeout(page, config.afterLoginWaitTime);
        
        // 如果有指定登入後等待的選擇器，則等待該選擇器出現
        if (config.extraWaitForSelector) {
            console.log(`等待選擇器出現: ${config.extraWaitForSelector}`);
            try {
                await page.waitForSelector(config.extraWaitForSelector, { timeout: 10000 });
            } catch (error) {
                console.warn(`等待選擇器超時: ${config.extraWaitForSelector}，但繼續執行`);
            }
        }
        
        // 截圖登入後的頁面
        await page.screenshot({ path: path.join(config.outputDir, 'after-login.png') });
        
        // 檢查是否登入成功
        console.log('檢查是否登入成功...');
        const loginSuccess = await page.evaluate(() => {
            // 嘗試通過文本內容檢查是否有登出相關元素
            const elements = Array.from(document.querySelectorAll('a, button'));
            const logoutElements = elements.filter(el => 
                el.textContent.includes('登出') || 
                el.textContent.includes('Logout') || 
                el.textContent.toLowerCase().includes('sign out') ||
                el.textContent.toLowerCase().includes('log out')
            );
            
            // 檢查是否有用戶信息相關元素
            const userElements = document.querySelectorAll('.user-name, .username, .user-info, .account-info');
            
            // 檢查URL是否包含會員中心等路徑
            const isInMemberArea = window.location.href.includes('member') || 
                                  window.location.href.includes('account') || 
                                  window.location.href.includes('profile');
                                  
            return logoutElements.length > 0 || userElements.length > 0 || isInMemberArea;
        });
        
        if (loginSuccess) {
            console.log('登入成功！');
        } else {
            console.warn('可能登入失敗，但繼續執行...');
        }
        
        // 如果登入頁面與目標頁面不同，則導航到目標頁面
        if (config.loginUrl && config.loginUrl !== url) {
            console.log(`導航到目標頁面: ${url}`);
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        }
        
        // 等待頁面完全加載
        await waitTimeout(page, 3000);
        
        // 獲取頁面內容
        const htmlContent = await page.content();
        
        // 使用 cheerio 解析 HTML
        const $ = cheerio.load(htmlContent);
        
        // 提取信息
        const title = $('title').text();
        const metaTags = [];
        $('meta').each((i, el) => {
            const attributes = {};
            Object.keys(el.attribs).forEach(key => {
                attributes[key] = el.attribs[key];
            });
            metaTags.push(attributes);
        });
        
        // 收集結果數據
        const result = {
            title,
            url,
            metaTags,
            html: htmlContent,
            loginSuccess
        };
        
        // 保存 HTML
        if (config.saveHtml) {
            fs.writeFileSync(
                path.join(config.outputDir, 'index.html'),
                htmlContent
            );
            console.log('HTML 已保存');
        }
        
        // 以下是原有的提取 CSS、JS 和圖片的代碼
        // 提取並保存 CSS
        if (config.saveCss) {
            const cssLinks = [];
            $('link[rel="stylesheet"]').each((i, el) => {
                const href = $(el).attr('href');
                if (href) cssLinks.push(href);
            });
            
            // 創建 CSS 目錄
            const cssDir = path.join(config.outputDir, 'css');
            if (!fs.existsSync(cssDir)) {
                fs.mkdirSync(cssDir, { recursive: true });
            }
            
            // 下載 CSS 文件
            for (const [index, link] of cssLinks.entries()) {
                try {
                    let cssUrl = link;
                    if (link.startsWith('//')) {
                        cssUrl = 'https:' + link;
                    } else if (!link.startsWith('http')) {
                        cssUrl = new URL(link, url).href;
                    }
                    
                    const response = await axios.get(cssUrl, { responseType: 'text' });
                    const cssFileName = `style-${index + 1}.css`;
                    fs.writeFileSync(path.join(cssDir, cssFileName), response.data);
                    console.log(`CSS 已保存: ${cssFileName}`);
                } catch (error) {
                    console.error(`下載 CSS 文件 ${link} 失敗:`, error.message);
                }
            }
            
            result.cssFiles = cssLinks.length;
        }
        
        // 提取並保存 JavaScript
        if (config.saveJs) {
            const scriptLinks = [];
            $('script[src]').each((i, el) => {
                const src = $(el).attr('src');
                if (src) scriptLinks.push(src);
            });
            
            // 創建 JS 目錄
            const jsDir = path.join(config.outputDir, 'js');
            if (!fs.existsSync(jsDir)) {
                fs.mkdirSync(jsDir, { recursive: true });
            }
            
            // 下載 JS 文件
            for (const [index, link] of scriptLinks.entries()) {
                try {
                    let jsUrl = link;
                    if (link.startsWith('//')) {
                        jsUrl = 'https:' + link;
                    } else if (!link.startsWith('http')) {
                        jsUrl = new URL(link, url).href;
                    }
                    
                    const response = await axios.get(jsUrl, { responseType: 'text' });
                    const jsFileName = `script-${index + 1}.js`;
                    fs.writeFileSync(path.join(jsDir, jsFileName), response.data);
                    console.log(`JavaScript 已保存: ${jsFileName}`);
                } catch (error) {
                    console.error(`下載 JavaScript 文件 ${link} 失敗:`, error.message);
                }
            }
            
            result.jsFiles = scriptLinks.length;
        }
        
        // 提取並保存圖片
        if (config.saveImages) {
            const imageLinks = [];
            $('img[src]').each((i, el) => {
                const src = $(el).attr('src');
                if (src) imageLinks.push(src);
            });
            
            // 創建圖片目錄
            const imgDir = path.join(config.outputDir, 'images');
            if (!fs.existsSync(imgDir)) {
                fs.mkdirSync(imgDir, { recursive: true });
            }
            
            // 下載圖片
            for (const [index, link] of imageLinks.entries()) {
                try {
                    let imgUrl = link;
                    if (link.startsWith('//')) {
                        imgUrl = 'https:' + link;
                    } else if (!link.startsWith('http')) {
                        imgUrl = new URL(link, url).href;
                    }
                    
                    const response = await axios.get(imgUrl, { responseType: 'arraybuffer' });
                    const extension = path.extname(imgUrl) || '.jpg';
                    const imgFileName = `image-${index + 1}${extension}`;
                    fs.writeFileSync(path.join(imgDir, imgFileName), response.data);
                    console.log(`圖片已保存: ${imgFileName}`);
                } catch (error) {
                    console.error(`下載圖片 ${link} 失敗:`, error.message);
                }
            }
            
            result.imageFiles = imageLinks.length;
        }
        
        return result;
    } finally {
        // 提示用戶是否關閉瀏覽器
        console.log('爬取完成！按 Enter 鍵關閉瀏覽器...');
        await new Promise(resolve => {
            process.stdin.once('data', () => {
                resolve();
            });
        });
        
        await browser.close();
    }
}

/**
 * 轉換為您的專案格式
 * @param {string} inputDir - 輸入目錄
 * @param {string} outputDir - 輸出目錄
 */
function convertToProject(inputDir, outputDir) {
    // 檢查輸入目錄是否存在
    if (!fs.existsSync(inputDir)) {
        console.error(`輸入目錄不存在: ${inputDir}`);
        return;
    }
    
    // 創建輸出目錄
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // 讀取 HTML
    const htmlPath = path.join(inputDir, 'index.html');
    if (fs.existsSync(htmlPath)) {
        let html = fs.readFileSync(htmlPath, 'utf8');
        
        // 修改 HTML 以適應您的專案結構
        const $ = cheerio.load(html);
        
        // 修改 CSS 引用
        $('link[rel="stylesheet"]').each((i, el) => {
            $(el).attr('href', `./src/styles/main.css`);
        });
        
        // 修改 JS 引用
        $('script[src]').each((i, el) => {
            const src = $(el).attr('src');
            if (src && !src.includes('cdn')) {
                $(el).attr('src', `./src/scripts/main.js`);
            }
        });
        
        // 保存修改後的 HTML
        fs.writeFileSync(
            path.join(outputDir, 'index.html'),
            $.html()
        );
        console.log('已轉換 HTML 文件');
    }
    
    // 合併 CSS 文件
    const cssDir = path.join(inputDir, 'css');
    if (fs.existsSync(cssDir)) {
        const cssFiles = fs.readdirSync(cssDir)
            .filter(file => file.endsWith('.css'));
        
        let combinedCss = '';
        for (const file of cssFiles) {
            const css = fs.readFileSync(path.join(cssDir, file), 'utf8');
            combinedCss += `/* 來自 ${file} */\n${css}\n\n`;
        }
        
        // 確保目標目錄存在
        const stylesDir = path.join(outputDir, 'src', 'styles');
        if (!fs.existsSync(stylesDir)) {
            fs.mkdirSync(stylesDir, { recursive: true });
        }
        
        // 保存合併後的 CSS
        fs.writeFileSync(
            path.join(stylesDir, 'main.css'),
            combinedCss
        );
        console.log('已合併 CSS 文件');
    }
    
    // 合併 JS 文件
    const jsDir = path.join(inputDir, 'js');
    if (fs.existsSync(jsDir)) {
        const jsFiles = fs.readdirSync(jsDir)
            .filter(file => file.endsWith('.js'));
        
        let combinedJs = '';
        for (const file of jsFiles) {
            const js = fs.readFileSync(path.join(jsDir, file), 'utf8');
            combinedJs += `// 來自 ${file}\n${js}\n\n`;
        }
        
        // 確保目標目錄存在
        const scriptsDir = path.join(outputDir, 'src', 'scripts');
        if (!fs.existsSync(scriptsDir)) {
            fs.mkdirSync(scriptsDir, { recursive: true });
        }
        
        // 保存合併後的 JS
        fs.writeFileSync(
            path.join(scriptsDir, 'main.js'),
            combinedJs
        );
        console.log('已合併 JS 文件');
    }
    
    console.log('轉換完成！');
}

// 導出功能
module.exports = {
    scrapeWebsite,
    scrapeWithLogin,
    scrapeWithLoginAndCaptcha,
    convertToProject
};

// 如果直接執行，則爬取範例網站
if (require.main === module) {
    const url = process.argv[2];
    const needLogin = process.argv.includes('--login');
    const needCaptcha = process.argv.includes('--captcha');
    
    if (!url) {
        console.error('請提供要爬取的網址，例如: node scraper.js https://example.com');
        console.error('如果需要登入，請添加 --login 參數，例如: node scraper.js https://example.com --login');
        console.error('如果需要驗證碼，請添加 --captcha 參數，例如: node scraper.js https://example.com --captcha');
        process.exit(1);
    }
    
    if (needLogin || needCaptcha) {
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        readline.question('請輸入用戶名: ', username => {
            readline.question('請輸入密碼: ', password => {
                readline.question('請輸入登入頁面 URL (如與目標頁面相同則留空): ', loginUrl => {
                    console.log(`正在爬取需要登入的網站: ${url}`);
                    
                    (async () => {
                        try {
                            const options = {};
                            if (loginUrl) {
                                options.loginUrl = loginUrl;
                            }
                            
                            // 詢問自定義選擇器
                            readline.question('是否需要自定義選擇器？(y/n) ', needCustomSelectors => {
                                if (needCustomSelectors.toLowerCase() === 'y') {
                                    readline.question('用戶名輸入框選擇器: ', usernameField => {
                                        readline.question('密碼輸入框選擇器: ', passwordField => {
                                            readline.question('驗證碼輸入框選擇器: ', captchaField => {
                                                readline.question('驗證碼圖片選擇器: ', captchaImg => {
                                                    readline.question('登入按鈕選擇器: ', submitButton => {
                                                        if (usernameField) {
                                                            options.loginSelectors = options.loginSelectors || {};
                                                            options.loginSelectors.usernameField = usernameField;
                                                        }
                                                        if (passwordField) {
                                                            options.loginSelectors = options.loginSelectors || {};
                                                            options.loginSelectors.passwordField = passwordField;
                                                        }
                                                        if (captchaField) {
                                                            options.loginSelectors = options.loginSelectors || {};
                                                            options.loginSelectors.captchaField = captchaField;
                                                        }
                                                        if (captchaImg) {
                                                            options.loginSelectors = options.loginSelectors || {};
                                                            options.loginSelectors.captchaImg = captchaImg;
                                                        }
                                                        if (submitButton) {
                                                            options.loginSelectors = options.loginSelectors || {};
                                                            options.loginSelectors.submitButton = submitButton;
                                                        }
                                                        
                                                        startScraping(url, username, password, options, needCaptcha);
                                                    });
                                                });
                                            });
                                        });
                                    });
                                } else {
                                    startScraping(url, username, password, options, needCaptcha);
                                }
                            });
                        } catch (error) {
                            console.error('爬取失敗:', error);
                            readline.close();
                        }
                    })();
                });
            });
        });
        
        async function startScraping(url, username, password, options, needCaptcha) {
            try {
                const result = needCaptcha
                    ? await scrapeWithLoginAndCaptcha(url, { username, password }, options)
                    : await scrapeWithLogin(url, { username, password }, options);
                console.log('爬取結果摘要:');
                console.log(`標題: ${result.title}`);
                console.log(`CSS 文件: ${result.cssFiles || 0}`);
                console.log(`JS 文件: ${result.jsFiles || 0}`);
                console.log(`圖片文件: ${result.imageFiles || 0}`);
                console.log(`登入狀態: ${result.loginSuccess ? '成功' : '可能失敗'}`);
                
                // 轉換為專案格式
                readline.question('是否要轉換為您的專案格式？(y/n) ', answer => {
                    if (answer.toLowerCase() === 'y') {
                        const scraped = path.join(__dirname, 'scraped');
                        const output = path.join(__dirname, 'frontend');
                        convertToProject(scraped, output);
                    }
                    readline.close();
                });
            } catch (error) {
                console.error('爬取失敗:', error);
                readline.close();
            }
        }
    } else {
        console.log(`正在爬取網站: ${url}`);
        
        (async () => {
            try {
                const result = await scrapeWebsite(url);
                console.log('爬取結果摘要:');
                console.log(`標題: ${result.title}`);
                console.log(`CSS 文件: ${result.cssFiles || 0}`);
                console.log(`JS 文件: ${result.jsFiles || 0}`);
                console.log(`圖片文件: ${result.imageFiles || 0}`);
                
                // 轉換為專案格式
                const scraped = path.join(__dirname, 'scraped');
                const output = path.join(__dirname, 'frontend');
                
                // 詢問用戶是否要轉換
                const readline = require('readline').createInterface({
                    input: process.stdin,
                    output: process.stdout
                });
                
                readline.question('是否要轉換為您的專案格式？(y/n) ', answer => {
                    if (answer.toLowerCase() === 'y') {
                        convertToProject(scraped, output);
                    }
                    readline.close();
                });
            } catch (error) {
                console.error('爬取失敗:', error);
            }
        })();
    }
}