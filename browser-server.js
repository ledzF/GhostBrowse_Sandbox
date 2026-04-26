const express = require('express');
const { exec } = require('child_process');
const crypto = require('crypto');
const http = require('http');
const httpProxy = require('http-proxy');

const app = express();
const server = http.createServer(app);
const proxy = httpProxy.createProxyServer({ ws: true });

app.use(express.json());

// Store active sessions
const sessions = new Map();
let nextPort = 10000;

// CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// Create new browser session
app.post('/api/sessions', async (req, res) => {
    try {
        const { url } = req.body;
        const sessionId = crypto.randomBytes(8).toString('hex');
        const port = nextPort++;
        const containerName = `browser-${sessionId}`;
        
        console.log(`[${sessionId}] Creating container for: ${url}`);
        
        // Use the EXACT same docker command you had working
        // Just with different name and port
        const dockerCmd = `docker run -d \
            --name ${containerName} \
            -p ${port}:80 \
            -v /dev/shm:/dev/shm \
            dorowu/ubuntu-desktop-lxde-vnc`;
        
        console.log(`[${sessionId}] Running: ${dockerCmd}`);
        
        const { stdout, stderr } = await execPromise(dockerCmd);
        
        if (stderr && stderr.includes('Error')) {
            throw new Error(stderr);
        }
        
        const containerId = stdout.trim();
        console.log(`[${sessionId}] Container started: ${containerId}`);
        
        // Wait for VNC to be ready
        console.log(`[${sessionId}] Waiting for desktop...`);
        await sleep(5000);
        
        // Install Firefox and open URL
        console.log(`[${sessionId}] Installing Firefox...`);
        const firefoxCmd = `docker exec ${containerName} bash -c 'apt-get update && apt-get install -y firefox && export DISPLAY=:1 && firefox "${url}"'`;
        exec(firefoxCmd, (err) => {
            if (err) console.log(`[${sessionId}] Firefox install note:`, err.message);
            else console.log(`[${sessionId}] Firefox launched with: ${url}`);
        });
        
        // Store session
        const session = {
            id: sessionId,
            containerId,
            containerName,
            port,
            url,
            created: Date.now()
        };
        
        sessions.set(sessionId, session);
        
        // Auto cleanup after 30 minutes
        setTimeout(() => destroySession(sessionId), 30 * 60 * 1000);
        
        // Build the access URL
        // For Cloud Shell web preview, we proxy through our server
        const streamUrl = `/view/${sessionId}/`;
        
        console.log(`[${sessionId}] ✓ Session ready on port ${port}`);
        
        res.json({
            sessionId,
            streamUrl,
            port,
            url: url,
            expiresIn: 1800
        });
        
    } catch (error) {
        console.error('Error creating session:', error);
        res.status(500).json({ 
            error: 'Failed to create session',
            details: error.message 
        });
    }
});

// Proxy to container's noVNC
app.use('/view/:sessionId', (req, res) => {
    const session = sessions.get(req.params.sessionId);
    
    if (!session) {
        return res.status(404).send('Session expired or not found');
    }
    
    console.log(`Proxying to container ${session.containerName} on port ${session.port}`);
    
    // Proxy to the container's port 80 (where noVNC runs)
    proxy.web(req, res, { 
        target: `http://127.0.0.1:${session.port}`,
        changeOrigin: true
    }, (err) => {
        console.error('Proxy error:', err);
        res.status(502).send('Container not responding yet, please wait...');
    });
});

// WebSocket proxy for VNC
server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const parts = url.pathname.split('/');
    
    // Match /view/sessionId/websockify
    if (parts[1] === 'view' && parts[2]) {
        const session = sessions.get(parts[2]);
        
        if (session) {
            console.log(`WebSocket upgrade for session ${parts[2]}`);
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
    if (!session) return res.status(404).json({ error: 'Not found' });
    
    const elapsed = Math.round((Date.now() - session.created) / 1000);
    res.json({
        id: session.id,
        url: session.url,
        port: session.port,
        age: elapsed,
        remaining: Math.max(0, 1800 - elapsed)
    });
});

// List all sessions
app.get('/api/sessions', (req, res) => {
    const list = [];
    for (const [id, s] of sessions) {
        list.push({
            id: s.id,
            url: s.url,
            age: Math.round((Date.now() - s.created) / 1000)
        });
    }
    res.json(list);
});

// Delete session
app.delete('/api/sessions/:sessionId', async (req, res) => {
    await destroySession(req.params.sessionId);
    res.json({ success: true });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        activeSessions: sessions.size,
        uptime: process.uptime()
    });
});

// Destroy session function
async function destroySession(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return;
    
    console.log(`[${sessionId}] Destroying session...`);
    
    try {
        await execPromise(`docker stop ${session.containerName} -t 5`);
        await execPromise(`docker rm ${session.containerName}`);
        console.log(`[${sessionId}] Container removed`);
    } catch (e) {
        console.error(`[${sessionId}] Cleanup error:`, e.message);
    }
    
    sessions.delete(sessionId);
}

// Helper functions
function execPromise(cmd) {
    return new Promise((resolve) => {
        exec(cmd, (error, stdout, stderr) => {
            resolve({ stdout: stdout || '', stderr: stderr || '' });
        });
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Periodic cleanup of expired sessions
setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
        if (now - session.created > 35 * 60 * 1000) {
            console.log(`[${id}] Hard cleanup - expired`);
            destroySession(id);
        }
    }
}, 60000);

// Start server
const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log('='.repeat(60));
    console.log('🔒 Secure Browser Sandbox');
    console.log('='.repeat(60));
    console.log(`📡 Server running on port ${PORT}`);
    console.log(`🌐 Access via Cloud Shell web preview (port ${PORT})`);
    console.log(`🐳 Using: dorowu/ubuntu-desktop-lxde-vnc`);
    console.log('='.repeat(60));
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    for (const [id] of sessions) {
        await destroySession(id);
    }
    process.exit(0);
});
