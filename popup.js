// Constants
const WS_SERVER = 'wss://realscratch-server.onrender.com';

// DOM Elements
const initialSelection = document.getElementById('initial-selection');
const hostScreen = document.getElementById('host-screen');
const joinScreen = document.getElementById('join-screen');
const connectedScreen = document.getElementById('connected-screen');
const hostBtn = document.getElementById('host-btn');
const joinBtn = document.getElementById('join-btn');
const backToSelectionBtn = document.getElementById('back-to-selection');
const sessionIdInput = document.getElementById('session-id');
const joinSessionBtn = document.getElementById('join-session-btn');
const hostSessionIdSpan = document.getElementById('host-session-id');
const copySessionIdBtn = document.getElementById('copy-session-id');
const participantsList = document.getElementById('participants');
const endSessionBtn = document.getElementById('end-session');
const leaveSessionBtn = document.getElementById('leave-session');
const currentSessionSpan = document.getElementById('current-session');
const userRoleSpan = document.getElementById('user-role');
const uploadSB3Input = document.getElementById('uploadSB3');
const connectionStatus = document.getElementById('connection-status');

// State
let ws = null;
let currentSessionId = null;
let isHost = false;
let participants = new Set();

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Load saved session
  chrome.storage.local.get(['sessionId', 'isHost'], (result) => {
    if (result.sessionId) {
      currentSessionId = result.sessionId;
      isHost = result.isHost;
      showConnectedScreen();
      initializeWebSocket();
    }
  });
});

// Event Listeners
hostBtn.addEventListener('click', () => {
  showHostScreen();
  generateSessionId();
});

joinBtn.addEventListener('click', () => {
  showJoinScreen();
});

backToSelectionBtn.addEventListener('click', () => {
  showInitialSelection();
});

joinSessionBtn.addEventListener('click', () => {
  const sessionId = sessionIdInput.value.trim();
  if (sessionId) {
    joinSession(sessionId);
  }
});

copySessionIdBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(currentSessionId)
    .then(() => alert('Session ID copied to clipboard!'))
    .catch(err => console.error('Failed to copy:', err));
});

endSessionBtn.addEventListener('click', () => {
  if (confirm('Are you sure you want to end this session?')) {
    endSession();
  }
});

leaveSessionBtn.addEventListener('click', () => {
  if (confirm('Are you sure you want to leave this session?')) {
    leaveSession();
  }
});

uploadSB3Input.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file || !file.name.endsWith('.sb3')) {
    alert('Please select a valid .sb3 file');
    return;
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'sb3-upload',
        sessionId: currentSessionId,
        data: Array.from(new Uint8Array(arrayBuffer))
      }));
    }
  } catch (error) {
    console.error('Error reading file:', error);
    alert('Error reading file. Please try again.');
  }
});

// Functions
function generateSessionId() {
  const id = Math.random().toString(36).substring(2, 8).toUpperCase();
  currentSessionId = id;
  hostSessionIdSpan.textContent = id;
  initializeWebSocket();
}

function joinSession(sessionId) {
  currentSessionId = sessionId;
  isHost = false;
  showConnectedScreen();
  initializeWebSocket();
}

function initializeWebSocket() {
  if (ws) {
    ws.close();
  }

  ws = new WebSocket(WS_SERVER);
  
  ws.onopen = () => {
    updateConnectionStatus(true);
    ws.send(JSON.stringify({
      type: 'join',
      sessionId: currentSessionId,
      isHost: isHost
    }));
    
    chrome.storage.local.set({ sessionId: currentSessionId, isHost });
  };

  ws.onclose = () => {
    updateConnectionStatus(false);
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    updateConnectionStatus(false);
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleWebSocketMessage(data);
  };
}

function handleWebSocketMessage(data) {
  switch (data.type) {
    case 'participants':
      updateParticipantsList(data.participants);
      break;
    case 'error':
      console.error('Server error:', data.message);
      alert(data.message);
      break;
  }
}

function updateParticipantsList(participants) {
  const list = document.getElementById('participants');
  list.innerHTML = '';
  participants.forEach(participant => {
    const li = document.createElement('li');
    li.textContent = `${participant.name} ${participant.isHost ? '(Host)' : ''}`;
    list.appendChild(li);
  });
}

function endSession() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'end-session',
      sessionId: currentSessionId
    }));
  }
  cleanup();
  showInitialSelection();
}

function leaveSession() {
  if (ws) {
    ws.close();
  }
  cleanup();
  showInitialSelection();
}

function cleanup() {
  currentSessionId = null;
  isHost = false;
  participants.clear();
  chrome.storage.local.remove(['sessionId', 'isHost']);
}

function updateConnectionStatus(connected) {
  connectionStatus.className = `status-indicator ${connected ? 'connected' : 'disconnected'}`;
  connectionStatus.querySelector('.status-text').textContent = 
    connected ? 'Connected' : 'Disconnected';
}

// Screen Management
function showInitialSelection() {
  initialSelection.style.display = 'block';
  hostScreen.style.display = 'none';
  joinScreen.style.display = 'none';
  connectedScreen.style.display = 'none';
}

function showHostScreen() {
  initialSelection.style.display = 'none';
  hostScreen.style.display = 'block';
  joinScreen.style.display = 'none';
  connectedScreen.style.display = 'none';
}

function showJoinScreen() {
  initialSelection.style.display = 'none';
  hostScreen.style.display = 'none';
  joinScreen.style.display = 'block';
  connectedScreen.style.display = 'none';
}

function showConnectedScreen() {
  initialSelection.style.display = 'none';
  hostScreen.style.display = isHost ? 'block' : 'none';
  joinScreen.style.display = 'none';
  connectedScreen.style.display = 'block';
  
  currentSessionSpan.textContent = currentSessionId;
  userRoleSpan.textContent = isHost ? 'Host' : 'Participant';
}

// Handle popup close
window.addEventListener('unload', () => {
  if (ws) {
    ws.close();
  }
}); 