const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Store active sessions
const sessions = new Map();

// Handle WebSocket connections
wss.on('connection', (ws) => {
  let currentSession = null;
  let isHost = false;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'join':
          // Handle session join
          currentSession = data.sessionId;
          isHost = data.isHost;
          
          if (!sessions.has(currentSession)) {
            sessions.set(currentSession, {
              host: isHost ? ws : null,
              participants: new Set(),
              projectId: data.projectId
            });
          }
          
          const session = sessions.get(currentSession);
          if (isHost) {
            session.host = ws;
          } else {
            session.participants.add(ws);
          }
          
          // Send current participants list
          broadcastParticipants(currentSession);
          break;

        case 'sync':
          // Handle state sync
          if (currentSession && sessions.has(currentSession)) {
            const session = sessions.get(currentSession);
            if (isHost) {
              // Broadcast to all participants
              session.participants.forEach(participant => {
                if (participant.readyState === WebSocket.OPEN) {
                  participant.send(JSON.stringify(data));
                }
              });
            }
          }
          break;

        case 'sb3-file':
          // Handle SB3 file upload
          if (currentSession && sessions.has(currentSession)) {
            const session = sessions.get(currentSession);
            if (isHost) {
              // Broadcast to all participants
              session.participants.forEach(participant => {
                if (participant.readyState === WebSocket.OPEN) {
                  participant.send(JSON.stringify(data));
                }
              });
            }
          }
          break;

        case 'project-loaded':
          // Handle project load notification
          if (currentSession && sessions.has(currentSession)) {
            const session = sessions.get(currentSession);
            session.projectId = data.projectId;
          }
          break;
      }
    } catch (error) {
      console.error('Error handling message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Error processing message'
      }));
    }
  });

  ws.on('close', () => {
    if (currentSession && sessions.has(currentSession)) {
      const session = sessions.get(currentSession);
      
      if (isHost) {
        // Host disconnected, end session
        session.participants.forEach(participant => {
          if (participant.readyState === WebSocket.OPEN) {
            participant.send(JSON.stringify({
              type: 'session-ended',
              message: 'Host disconnected'
            }));
          }
        });
        sessions.delete(currentSession);
      } else {
        // Participant disconnected
        session.participants.delete(ws);
        broadcastParticipants(currentSession);
        
        // If no participants left, clean up session
        if (session.participants.size === 0 && !session.host) {
          sessions.delete(currentSession);
        }
      }
    }
  });
});

// Broadcast participants list to all clients in a session
function broadcastParticipants(sessionId) {
  if (sessions.has(sessionId)) {
    const session = sessions.get(sessionId);
    const participants = Array.from(session.participants).map(ws => ({
      isHost: false
    }));
    
    if (session.host) {
      participants.unshift({ isHost: true });
    }
    
    const message = JSON.stringify({
      type: 'participants',
      participants: participants
    });
    
    if (session.host && session.host.readyState === WebSocket.OPEN) {
      session.host.send(message);
    }
    
    session.participants.forEach(participant => {
      if (participant.readyState === WebSocket.OPEN) {
        participant.send(message);
      }
    });
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', sessions: sessions.size });
});

// Start server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 