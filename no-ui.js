require('dotenv').config();
const PORT = process.env.PORT || 5000;
const fs = require('fs');
const path = require('path');
const { JSDOM, ResourceLoader } = require('jsdom');
const http = require('http');
class CustomResourceLoader extends ResourceLoader {
    fetch(url, options) {
        const filePath = url.startsWith('file:') 
            ? url.slice(8)
            : path.join(__dirname, url.pathname);
        if (fs.existsSync(filePath)) {
            return Promise.resolve(fs.readFileSync(filePath));
        }
        return new Promise((resolve, reject) => {
            http.get(url, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => resolve(Buffer.from(data)));
            }).on('error', reject);
        });
    }
}
const indexPath = path.join(__dirname, 'templates', 'index.html');
let indexHtml = fs.readFileSync(indexPath, 'utf8');
function url_for(endpoint, filename) {
    if (endpoint === 'static') {
        return `file://${path.join(__dirname, 'static', filename)}`;
    }
    return '';
}
indexHtml = indexHtml.replace(/\{\{\s*url_for\('static',\s*filename='(.+?)'\)\s*\}\}/g, (match, filename) => {
    return url_for('static', filename);
});
function customFetch(url, options = {}) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url, `http://127.0.0.1:${PORT}`);
        const requestOptions = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port,
            path: parsedUrl.pathname + parsedUrl.search,
            method: options.method || 'GET',
            headers: options.headers || {},
        };
        if (options.body instanceof URLSearchParams) {
            const body = options.body.toString();
            requestOptions.headers['Content-Type'] = 'application/x-www-form-urlencoded';
            requestOptions.headers['Content-Length'] = Buffer.byteLength(body);
        } else if (typeof options.body === 'string') {
            requestOptions.headers['Content-Length'] = Buffer.byteLength(options.body);
        }
        const req = http.request(requestOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    json: () => Promise.resolve(JSON.parse(data)),
                    text: () => Promise.resolve(data)
                });
            });
        });
        req.on('error', reject);
        if (options.body) {
            if (options.body instanceof URLSearchParams) {
                req.write(options.body.toString());
            } else {
                req.write(options.body);
            }
        }
        req.end();
    });
}
const dom = new JSDOM(indexHtml, {
    url: `http://127.0.0.1:${PORT}`,
    runScripts: "dangerously",
    resources: new CustomResourceLoader(),
    pretendToBeVisual: true,
    beforeParse(window) {
        window.url_for = url_for;
        window.fetch = customFetch;
    }
});
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.fetch = customFetch;
global.console = {
    log: console.log.bind(console),
    error: console.error.bind(console),
    warn: console.warn.bind(console),
    info: console.info.bind(console),
};
(function() {
    try {
        console.log('no-ui.js success');
        const event = new dom.window.Event('DOMContentLoaded');
        dom.window.document.dispatchEvent(event);
    } catch (error) {
        console.error('no-ui.js error:', error);
    }
})();
setInterval(() => {}, 1000);
