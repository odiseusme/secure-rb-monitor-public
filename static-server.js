#!/usr/bin/env node
// Static file server for Rosen Bridge remote monitoring
// Serves dashboard accessible from any PC or mobile device
// Designed for easy deployment to cloud hosting (Cloudflare, AWS, etc.)
// Also runs periodic status updates for real-time monitoring

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = Number(process.env.PORT) || Number(process.env.MONITOR_PORT) || 8080;
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPDATE_INTERVAL = Number(process.env.UPDATE_INTERVAL) || 30000; // 30 seconds
const INITIAL_DELAY = Number(process.env.INITIAL_DELAY) || 2000; // 2 seconds

// MIME types for common files
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Status update function
function runStatusUpdate() {
  console.log(`[${new Date().toISOString()}] Running status update...`);
  
  const child = spawn('node', ['write_status.js'], {
    stdio: 'inherit',
    env: process.env,
    cwd: __dirname
  });

  child.on('error', (err) => {
    console.error('Failed to start write_status.js:', err);
  });

  child.on('exit', (code, signal) => {
    if (code === 0) {
      // write_status.js logs its own success
    } else {
      console.error(`write_status.js exited with code=${code}, signal=${signal || 'none'}`);
    }
  });
}

const server = http.createServer((req, res) => {
  // Parse URL and remove query parameters for file serving
  const urlPath = new URL(req.url, `http://localhost:${PORT}`).pathname;
  
  // Health check endpoint
  if (urlPath === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
    return;
  }
  
  // Serve index.html for root requests
  let filePath = urlPath === '/' ? '/index.html' : urlPath;
  filePath = path.join(PUBLIC_DIR, filePath);
  
  // Security: prevent directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }
  
  // Serve the file
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server Error');
      }
      return;
    }
    
    // Set appropriate content type
    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'text/plain';
    
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Static server running on port ${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Update interval: ${UPDATE_INTERVAL}ms`);
  
  // Schedule status updates
  setTimeout(runStatusUpdate, INITIAL_DELAY);
  setInterval(runStatusUpdate, UPDATE_INTERVAL);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down gracefully...');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  server.close(() => process.exit(0));
});