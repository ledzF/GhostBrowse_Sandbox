


# GhostBrowse - Secure Browser Sandbox

GhostBrowse is a cybersecurity sandbox that runs isolated browser sessions inside Docker containers. Each URL is opened in a fresh Ubuntu desktop environment with Firefox, streamed to the user via noVNC. This enables safe analysis of untrusted or potentially malicious web content.

---

## Features

- Isolated browser sessions using Docker containers  
- Full Ubuntu desktop environment with Firefox  
- Real-time interaction through noVNC  
- Automatic session termination after a fixed duration  
- Hardened container configuration with restricted privileges  
- Blocking of internal and private network access  
- Lightweight and responsive web interface  

---

## Architecture

```

User Browser
│
▼
Web Interface (HTML/JS)
│
▼
Node.js Server
│
▼
Docker Engine
│
▼
Isolated Containers (Ubuntu + Firefox + noVNC)

````

---

## Prerequisites

- Docker installed and running  
- Node.js (v16 or higher)  
- npm  

---

## Installation

```bash
git clone https://github.com/yourusername/ghostbrowse.git
cd ghostbrowse
npm install
docker pull dorowu/ubuntu-desktop-lxde-vnc
node server.js
````

---

## Usage

Open the application in a browser:

```
http://localhost:3000
```

Enter a URL to launch a new isolated browsing session.

---

## Project Structure

```
ghostbrowse/
├── server.js
├── index.html
├── package.json
├── start-browser-sandbox.sh
└── README.md
```




## Security Features

### URL Validation

* Blocks localhost and private IP ranges
* Blocks cloud metadata endpoints
* Enforces safe URL handling

### Container Hardening

* No privileged access
* Read-only file system
* Resource limits (CPU and memory)
* No persistent storage

### Session Isolation

* Each session runs in a separate container
* No shared volumes or data
* Automatic cleanup after expiration

---

## Configuration

Session timeout can be modified in `server.js`:

```javascript
setTimeout(() => cleanupSession(sessionId), 30 * 60 * 1000);
```

Port allocation:

```javascript
let nextPort = 10000;
```

---

## Use Cases

* Phishing link analysis
* Malware website inspection
* Secure browsing of untrusted URLs
* Security training demonstrations
* Safe preview of external links


## Performance

* Container startup time: 5–8 seconds
* Memory usage per session: ~500 MB
* CPU allocation per session: 0.5 cores
* Maximum concurrent sessions depends on system resources



## Troubleshooting

**Application not loading**

* Ensure `index.html` is in the correct directory

**Black screen in session**

* Wait for container initialization and refresh

**Port already in use**

```bash
fuser -k 3000/tcp
```

**Docker not running**

```bash
sudo systemctl start docker
```

---

## Capstone Project Information

Title: GhostBrowse - Secure Remote Browser Isolation System
Domain: Cybersecurity
Technologies: Docker, Node.js, noVNC, Ubuntu, Firefox

---

## License

This project is licensed under the MIT License.



## Disclaimer

This project is intended for educational and authorized security research purposes only. Misuse of this system for unauthorized activities is strictly prohibited.


