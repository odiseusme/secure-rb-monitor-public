#!/usr/bin/env node
// Status updater for remote Rosen Bridge monitoring
// Continuously updates status.json for remote access from PCs and mobile devices
// Use with external static servers or cloud hosting (Cloudflare, Netlify, etc.)

const { spawn } = require('child_process');
const path = require('path');

const UPDATE_INTERVAL = Number(process.env.UPDATE_INTERVAL) || 30000; // 30 seconds
const INITIAL_DELAY = Number(process.env.INITIAL_DELAY) || 2000; // 2 seconds

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
      console.log(`[${new Date().toISOString()}] Status update completed successfully`);
    } else {
      console.error(`write_status.js exited with code=${code}, signal=${signal || 'none'}`);
    }
  });
}

console.log(`[${new Date().toISOString()}] Status updater starting...`);
console.log(`Update interval: ${UPDATE_INTERVAL}ms`);
console.log(`Initial delay: ${INITIAL_DELAY}ms`);

// Run first update after initial delay
setTimeout(runStatusUpdate, INITIAL_DELAY);

// Schedule periodic updates
setInterval(runStatusUpdate, UPDATE_INTERVAL);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Status updater shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Status updater shutting down gracefully...');
  process.exit(0);
});