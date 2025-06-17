const { spawn } = require('child_process');
const path = require('path');

// Check Node.js version
const requiredVersion = '14.0.0';
const currentVersion = process.version;
if (compareVersions(currentVersion, requiredVersion) < 0) {
    console.error(`Error: Node.js version ${requiredVersion} or higher is required.`);
    console.error(`Current version: ${currentVersion}`);
    process.exit(1);
}

// Start the server
const server = spawn('node', ['server.js'], {
    stdio: 'inherit',
    env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || 'development'
    }
});

server.on('error', (error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
});

server.on('exit', (code) => {
    if (code !== 0) {
        console.error(`Server exited with code ${code}`);
        process.exit(code);
    }
});

// Helper function to compare versions
function compareVersions(v1, v2) {
    const v1Parts = v1.replace('v', '').split('.').map(Number);
    const v2Parts = v2.replace('v', '').split('.').map(Number);
    
    for (let i = 0; i < 3; i++) {
        if (v1Parts[i] > v2Parts[i]) return 1;
        if (v1Parts[i] < v2Parts[i]) return -1;
    }
    return 0;
} 