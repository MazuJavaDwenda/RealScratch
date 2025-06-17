const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');
const AdmZip = require('adm-zip');

// Load environment variables
try {
    require('dotenv').config();
} catch (error) {
    console.warn('Warning: .env file not found, using default values');
}

// Create Express app
const app = express();
const server = http.createServer(app);

// Configure WebSocket server with error handling
const wss = new WebSocket.Server({ 
    server,
    // Add error handling for the WebSocket server
    clientTracking: true,
    handleProtocols: () => true
});

// Error handling for WebSocket server
wss.on('error', (error) => {
    console.error('WebSocket Server Error:', error);
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase limit for large files
app.use(express.static(path.join(__dirname, 'public')));

// Store active sessions and their connections
const sessions = new Map();
// Store session data including host and project XML
const sessionData = new Map();

// WebSocket connection handler
wss.on('connection', (ws, req) => {
    let currentSession = null;
    let userId = generateUserId();
    let isHost = false;

    console.log(`New connection established: ${userId} from ${req.socket.remoteAddress}`);

    // Set up ping/pong to keep connection alive
    const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.ping();
        }
    }, 30000);

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            
            switch (data.type) {
                case 'join':
                    handleJoin(ws, data.sessionId, userId, data.isHost);
                    currentSession = data.sessionId;
                    isHost = data.isHost;
                    break;

                case 'sync':
                    handleSync(ws, data, currentSession);
                    break;

                case 'leave':
                    handleLeave(ws, currentSession, userId);
                    currentSession = null;
                    isHost = false;
                    break;

                case 'sb3-upload':
                    if (isHost) {
                        await handleSB3Upload(ws, data, currentSession);
                    } else {
                        sendError(ws, 'Only the host can upload SB3 files');
                    }
                    break;

                case 'host-status':
                    handleHostStatus(ws, data, currentSession, userId);
                    break;

                default:
                    console.warn(`Unknown message type: ${data.type}`);
            }
        } catch (error) {
            console.error('Error processing message:', error);
            sendError(ws, 'Invalid message format');
        }
    });

    ws.on('close', () => {
        clearInterval(pingInterval);
        if (currentSession) {
            handleLeave(ws, currentSession, userId);
        }
        console.log(`Connection closed: ${userId}`);
    });

    ws.on('error', (error) => {
        console.error(`WebSocket error for ${userId}:`, error);
        sendError(ws, 'Internal server error');
    });

    ws.on('pong', () => {
        // Connection is alive
    });
});

// Session management functions
function handleJoin(ws, sessionId, userId, isHost) {
    try {
        if (!sessions.has(sessionId)) {
            sessions.set(sessionId, new Map());
            sessionData.set(sessionId, {
                host: null,
                projectXML: null
            });
        }

        const session = sessions.get(sessionId);
        session.set(userId, ws);

        // If this is the first user or they're marked as host, make them the host
        const sessionInfo = sessionData.get(sessionId);
        if (!sessionInfo.host || isHost) {
            sessionInfo.host = userId;
            broadcastToSession(sessionId, {
                type: 'host-status',
                isHost: true
            }, ws);
        }

        // If there's existing project data, send it to the new user
        if (sessionInfo.projectXML) {
            ws.send(JSON.stringify({
                type: 'init-load',
                xml: sessionInfo.projectXML
            }));
        }

        // Notify all clients in the session about the new user
        broadcastToSession(sessionId, {
            type: 'userCount',
            count: session.size
        }, ws);

        console.log(`User ${userId} joined session ${sessionId} (${isHost ? 'as host' : 'as client'})`);
    } catch (error) {
        console.error('Error in handleJoin:', error);
        sendError(ws, 'Error joining session');
    }
}

function handleSync(ws, data, sessionId) {
    if (!sessionId || !sessions.has(sessionId)) {
        sendError(ws, 'Invalid session');
        return;
    }

    const session = sessions.get(sessionId);
    broadcastToSession(sessionId, {
        type: 'sync',
        sessionId: sessionId,
        changes: data.changes
    }, ws);
}

function handleLeave(ws, sessionId, userId) {
    if (!sessionId || !sessions.has(sessionId)) return;

    const session = sessions.get(sessionId);
    const sessionInfo = sessionData.get(sessionId);

    // If the leaving user was the host, assign a new host
    if (sessionInfo.host === userId) {
        const remainingUsers = Array.from(session.keys()).filter(id => id !== userId);
        if (remainingUsers.length > 0) {
            sessionInfo.host = remainingUsers[0];
            const newHostWs = session.get(sessionInfo.host);
            if (newHostWs) {
                newHostWs.send(JSON.stringify({
                    type: 'host-status',
                    isHost: true
                }));
            }
        }
    }

    session.delete(userId);

    // If session is empty, remove it
    if (session.size === 0) {
        sessions.delete(sessionId);
        sessionData.delete(sessionId);
        console.log(`Session ${sessionId} removed (empty)`);
    } else {
        // Notify remaining users
        broadcastToSession(sessionId, {
            type: 'userCount',
            count: session.size
        });
    }

    console.log(`User ${userId} left session ${sessionId}`);
}

async function handleSB3Upload(ws, data, sessionId) {
    try {
        // Convert array back to buffer
        const buffer = Buffer.from(data.data);
        
        // Parse SB3 file
        const zip = new AdmZip(buffer);
        const projectJson = JSON.parse(zip.readAsText('project.json'));
        
        // Extract workspace XML
        const xml = extractWorkspaceXML(projectJson);
        
        // Store XML in session data
        const sessionInfo = sessionData.get(sessionId);
        sessionInfo.projectXML = xml;
        
        // Broadcast to all clients
        broadcastToSession(sessionId, {
            type: 'init-load',
            xml: xml
        });
        
        console.log(`SB3 file processed for session ${sessionId}`);
    } catch (error) {
        console.error('Error processing SB3 file:', error);
        sendError(ws, 'Error processing SB3 file');
    }
}

function handleHostStatus(ws, data, sessionId, userId) {
    const sessionInfo = sessionData.get(sessionId);
    if (sessionInfo && sessionInfo.host === userId) {
        broadcastToSession(sessionId, {
            type: 'host-status',
            isHost: data.isHost
        });
    }
}

// Utility functions
function extractWorkspaceXML(projectJson) {
    // This is a simplified version - you'll need to implement the full conversion
    // from Scratch project JSON to Blockly XML
    const targets = projectJson.targets || [];
    const xml = targets.map(target => {
        const blocks = target.blocks || {};
        // Convert blocks to XML format
        return `<xml>
            <block type="when_green_flag_clicked" x="0" y="0">
                ${Object.entries(blocks).map(([id, block]) => 
                    `<block type="${block.opcode}" id="${id}">
                        ${block.inputs ? Object.entries(block.inputs).map(([name, input]) =>
                            `<value name="${name}">
                                <block type="${input[1][0]}" id="${input[1][1]}"/>
                            </value>`
                        ).join('') : ''}
                    </block>`
                ).join('')}
            </block>
        </xml>`;
    }).join('');
    
    return xml;
}

function broadcastToSession(sessionId, message, excludeWs = null) {
    const session = sessions.get(sessionId);
    if (!session) return;

    const messageStr = JSON.stringify(message);
    session.forEach((client, id) => {
        if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
            client.send(messageStr);
        }
    });
}

function sendError(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'error',
            message: message
        }));
    }
}

function generateUserId() {
    return Math.random().toString(36).substring(2, 15);
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        sessions: sessions.size,
        totalConnections: Array.from(sessions.values())
            .reduce((sum, session) => sum + session.size, 0)
    });
});

// Error handling for the HTTP server
server.on('error', (error) => {
    console.error('HTTP Server Error:', error);
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${process.env.PORT || 3000} is already in use`);
    }
});

// Start server
const PORT = process.env.PORT || 3000;
const WS_PORT = process.env.WS_PORT || 8080;

try {
    server.listen(WS_PORT, () => {
        console.log(`WebSocket server running on port ${WS_PORT}`);
        console.log(`HTTP server running on port ${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
} catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
}); 