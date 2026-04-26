const express = require('express');
const { exec, spawn } = require('child_process');
const crypto = require('crypto');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(express.static(__dirname));

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const sessions = new Map();
let nextPort = 10000;

app.post('/api/sessions', async (req, res) => {
    try {
        const { url } = req.body;
        
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }
        
        let targetUrl = url.trim();
        if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
            targetUrl = 'https://' + targetUrl;
        }
        
        const sessionId = crypto.randomBytes(8).toString('hex');
        const port = nextPort++;
        const containerName = `browser-${sessionId}`;
        
        console.log(`\n[${sessionId}] 🚀 Creating session`);
        console.log(`[${sessionId}] URL: ${targetUrl}`);
        console.log(`[${sessionId}] Port: ${port}`);
        
        // Run docker container
        const dockerCmd = `docker run -d --name ${containerName} -p ${port}:80 -v /dev/shm:/dev/shm dorowu/ubuntu-desktop-lxde-vnc`;
        
        console.log(`[${sessionId}] Starting container...`);
        const { stdout, stderr } = await execPromise(dockerCmd);
        
        if (stderr && stderr.includes('Error')) {
            throw new Error(stderr);
        }
        
        const containerId = stdout.trim();
        console.log(`[${sessionId}] Container: ${containerId.substring(0, 12)}`);
        
        // Store session
        const session = {
            id: sessionId,
            containerId,
            containerName,
            port,
            url: targetUrl,
            created: Date.now()
        };
        
        sessions.set(sessionId, session);
        
        // Send response immediately
        res.json({
            sessionId,
            streamUrl: `/view/${sessionId}/`,
            url: targetUrl,
            expiresIn: 1800
        });
        
        // Wait for container to be fully ready, then install Firefox
        console.log(`[${sessionId}] Waiting for desktop...`);
        
        // Check if container is ready by polling
        let ready = false;
        for (let i = 0; i < 30; i++) {
            await sleep(2000);
            const { stdout: healthCheck } = await execPromise(`docker exec ${containerName} pgrep Xvfb 2>/dev/null`);
            if (healthCheck.trim()) {
                ready = true;
                console.log(`[${sessionId}] Desktop ready after ${(i+1)*2}s`);
                break;
            }
            console.log(`[${sessionId}] Waiting... (${(i+1)*2}s)`);
        }
        
        if (ready) {
            // Install Firefox
            console.log(`[${sessionId}] Installing Firefox...`);
            await execPromise(`docker exec ${containerName} bash -c 'apt-get update -qq && apt-get install -y -qq firefox 2>/dev/null'`);
            console.log(`[${sessionId}] Firefox installed`);
            
            // Launch Firefox
            console.log(`[${sessionId}] Launching Firefox with: ${targetUrl}`);
            exec(`docker exec ${containerName} bash -c 'export DISPLAY=:1 && firefox "${targetUrl}" &'`);
            console.log(`[${sessionId}] ✅ Complete!`);
        } else {
            console.log(`[${sessionId}] ⚠️ Desktop not ready, skipping Firefox auto-launch`);
        }
        
        // Auto-cleanup after 30 minutes
        setTimeout(() => cleanupSession(sessionId), 30 * 60 * 1000);
        
    } catch (error) {
        console.error(`[ERROR] ${error.message}`);
        // If we haven't sent response yet
        if (!res.headersSent) {
            res.status(500).json({ 
                error: 'Failed to create session',
                details: error.message 
            });
        }
    }
});

// Proxy requests to containers
app.use('/view/:sessionId', (req, res) => {
    const session = sessions.get(req.params.sessionId);
    
    if (!session) {
        return res.status(404).send('Session expired or not found');
    }
    
    const httpProxy = require('http-proxy');
    const proxy = httpProxy.createProxyServer({
        proxyTimeout: 30000,
        timeout: 30000
    });
    
    proxy.on('error', (err, req, res) => {
        console.error(`Proxy error for ${session.id}: ${err.message}`);
        if (!res.headersSent) {
            res.writeHead(503, { 'Content-Type': 'text/html' });
            res.end('<html><body><h3>Container is starting...</h3><p>Please wait a moment and refresh.</p><script>setTimeout(()=>location.reload(),3000)</script></body></html>');
        }
    });
    
    proxy.web(req, res, { 
        target: `http://127.0.0.1:${session.port}`,
        changeOrigin: true
    });
});

// WebSocket proxy
server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const parts = url.pathname.split('/');
    
    if (parts[1] === 'view' && parts[2]) {
        const session = sessions.get(parts[2]);
        if (session) {
            const httpProxy = require('http-proxy');
            const proxy = httpProxy.createProxyServer({ ws: true });
            
            proxy.on('error', (err) => {
                console.error(`WS proxy error: ${err.message}`);
            });
            
            proxy.ws(req, socket, head, {
                target: `ws://127.0.0.1:${session.port}`,
                changeOrigin: true
            });
            return;
        }
    }
    socket.destroy();
});

// Get session info
app.get('/api/sessions/:sessionId', (req, res) => {
    const session = sessions.get(req.params.sessionId);
    if (!session) {
        return res.status(404).json({ error: 'Not found' });
    }
    
    const elapsed = Math.round((Date.now() - session.created) / 1000);
    res.json({
        id: session.id,
        url: session.url,
        age: elapsed,
        remaining: Math.max(0, 1800 - elapsed)
    });
});

// Delete session
app.delete('/api/sessions/:sessionId', async (req, res) => {
    await cleanupSession(req.params.sessionId);
    res.json({ success: true });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok',
        activeSessions: sessions.size 
    });
});

async function cleanupSession(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return;
    
    console.log(`[${sessionId}] 🗑️ Cleaning up...`);
    
    try {
        await execPromise(`docker stop ${session.containerName} -t 3`);
        await execPromise(`docker rm ${session.containerName}`);
        console.log(`[${sessionId}] ✅ Removed`);
    } catch (e) {
        console.error(`[${sessionId}] Cleanup error: ${e.message}`);
    }
    
    sessions.delete(sessionId);
}

function execPromise(cmd) {
    return new Promise((resolve) => {
        exec(cmd, { timeout: 60000 }, (error, stdout, stderr) => {
            resolve({ stdout: stdout || '', stderr: stderr || '' });
        });
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Cleanup stale sessions
setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
        if (now - session.created > 35 * 60 * 1000) {
            cleanupSession(id);
        }
    }
}, 60000);

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log('\n' + '='.repeat(60));
    console.log('🔒 Secure Browser Sandbox');
    console.log('='.repeat(60));
    console.log(`📡 Server: http://0.0.0.0:${PORT}`);
    console.log(`🌐 Cloud Shell Web Preview on port ${PORT}`);
    console.log(`🐳 Image: dorowu/ubuntu-desktop-lxde-vnc`);
    console.log('='.repeat(60) + '\n');
});

// Graceful shutdown - DON'T cleanup containers
process.on('SIGINT', () => {
    console.log('\n⚠️ Server stopping. Containers will keep running.');
    console.log('To cleanup: docker ps -a | grep browser- | xargs docker rm -f');
    process.exit(0);
});
