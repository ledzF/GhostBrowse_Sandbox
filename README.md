# 👻 GhostBrowse - Secure Browser Sandbox

[![Security](https://img.shields.io/badge/Security-CEH%20%7C%20Security%2B-blue)]()
[![Docker](https://img.shields.io/badge/Docker-Containerized-brightgreen)]()
[![Node.js](https://img.shields.io/badge/Node.js-Backend-green)]()
[![License](https://img.shields.io/badge/License-MIT-yellow)]()

> **GhostBrowse** is a cybersecurity sandbox that runs isolated browser sessions in Docker containers. Each URL opens in a fresh Ubuntu desktop with Firefox, streamed directly to your browser via noVNC. Perfect for safely analyzing suspicious links, phishing URLs, and malware domains.

---

## 🎯 Features

- 🔒 **Isolated Environments** - Each session runs in a separate Docker container with no cross-contamination
- 🦊 **Full Desktop Experience** - Complete Ubuntu desktop with Firefox, not just a headless browser
- 📺 **Real-time VNC Streaming** - Interact with the remote browser via noVNC in your web browser
- ⏱️ **Auto-Destruction** - Sessions automatically terminate after 30 minutes
- 🛡️ **Security Hardened** - Containers run with restricted capabilities, no data persistence
- 🚫 **Internal Network Blocked** - Prevents access to localhost, private IPs, and cloud metadata
- 📊 **Session Management** - Monitor all active sessions with live countdown timers
- 🎨 **Responsive UI** - Works on desktop and mobile devices

---

## 🏗️ Architecture
┌─────────────────────────────────────────────────────────────┐
│ User's Browser │
│ ┌───────────────────────────────────────────────────────┐ │
│ │ GhostBrowse Web Interface (HTML/JS) │ │
│ └───────────────────┬───────────────────────────────────┘ │
└──────────────────────┼──────────────────────────────────────┘
│
│ HTTP/WebSocket
▼
┌─────────────────────────────────────────────────────────────┐
│ Node.js API Server │
│ ┌───────────────────────────────────────────────────────┐ │
│ │ • Session Management │ │
│ │ • Proxy Routing │ │
│ │ • URL Validation & Security │ │
│ │ • Container Lifecycle Mgmt │ │
│ └───────────────────┬───────────────────────────────────┘ │
└──────────────────────┼──────────────────────────────────────┘
│
│ Docker API
▼
┌─────────────────────────────────────────────────────────────┐
│ Docker Engine │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│ │Container 1│ │Container 2│ │Container N│ │
│ │ :10000 │ │ :10001 │ │ :1000N │ │
│ │ │ │ │ │ │ │
│ │ Ubuntu │ │ Ubuntu │ │ Ubuntu │ │
│ │ +Firefox │ │ +Firefox │ │ +Firefox │ │
│ │ +noVNC │ │ +noVNC │ │ +noVNC │ │
│ └──────────┘ └──────────┘ └──────────┘ │
└─────────────────────────────────────────────────────────────┘

text

---

## 🚀 Quick Start

### Prerequisites

- **Docker** installed and running
- **Node.js** v16 or higher
- **npm** (comes with Node.js)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/ghostbrowse.git
cd ghostbrowse

# Install dependencies
npm install express http-proxy

# Pull the base image
docker pull dorowu/ubuntu-desktop-lxde-vnc

# Start the server
node server.js
Access
Open your browser and navigate to:

text
http://localhost:3000
For Cloud Shell users:

text
Click "Web Preview" → Change port to 3000
📦 Project Structure
text
ghostbrowse/
├── server.js                    # Main Node.js API server
├── index.html                   # Web interface
├── package.json                 # Dependencies
├── start-browser-sandbox.sh     # Startup script
├── README.md                    # This file
└── node_modules/                # npm dependencies
🔧 API Endpoints
Method	Endpoint	Description
GET	/	Web interface
POST	/api/sessions	Create new browser session
GET	/api/sessions	List all active sessions
GET	/api/sessions/:id	Get session details
DELETE	/api/sessions/:id	Destroy a session
GET	/api/health	Health check
GET	/view/:sessionId/	Proxy to container's noVNC
Example: Create Session
bash
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
Response:

json
{
  "sessionId": "a1b2c3d4e5f6",
  "streamUrl": "/view/a1b2c3d4e5f6/",
  "url": "https://example.com",
  "expiresIn": 1800,
  "created": 1719000000000
}
🛡️ Security Features
URL Validation
Blocks internal IPs (127.0.0.1, 192.168.x.x, 10.x.x.x, 172.16.x.x)

Blocks metadata endpoints (169.254.169.254)

Enforces HTTPS when protocol not specified

Container Hardening
bash
--cap-drop=ALL           # Drop all capabilities
--security-opt=no-new-privileges  # Prevent privilege escalation
--read-only              # Read-only root filesystem
--memory=512m            # Memory limit
--cpus=0.5               # CPU limit
Session Isolation
Each session gets a unique container

No shared volumes between sessions

Random port assignment per container

No data persistence between sessions

🎓 Use Cases
Phishing Analysis - Safely open suspected phishing URLs

Malware Research - Visit potentially malicious websites

Privacy Browsing - Browse without leaving local traces

Cross-Browser Testing - Test websites in isolated environments

Security Training - Demonstrate browser-based attacks safely

URL Scanning - Preview links before sharing

🔄 How It Works
User enters URL in the web interface

Server spawns a new Docker container with Ubuntu desktop

Firefox installs automatically inside the container

noVNC streams the desktop to your browser via WebSocket

User interacts with the remote browser in real-time

Session auto-destroys after 30 minutes (configurable)

text
User Input → URL Validation → Docker Container Spawn → 
Desktop Ready → Firefox Launch → VNC Stream → 
Browser Interaction → Auto-Destroy after 30min
