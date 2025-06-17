// Constants
const WS_SERVER = 'wss://realscratch-server.onrender.com'; // Using a public WebSocket server
const SYNC_INTERVAL = 500; // Increased sync frequency for better real-time experience
const MAX_RETRY_ATTEMPTS = 5;
const RETRY_DELAY = 2000;

// State
let ws = null;
let sessionId = null;
let retryCount = 0;
let syncInterval = null;
let lastSyncState = null;
let isHost = false;
let projectId = null;

// Get project ID from URL
function getProjectId() {
  const match = window.location.pathname.match(/\/projects\/(\d+)/);
  return match ? match[1] : null;
}

// Initialize WebSocket connection
function initializeWebSocket() {
  if (ws) {
    ws.close();
  }

  ws = new WebSocket(WS_SERVER);
  
  ws.onopen = () => {
    console.log('WebSocket connected');
    retryCount = 0;
    if (sessionId) {
      ws.send(JSON.stringify({
        type: 'join',
        sessionId: sessionId,
        isHost: isHost,
        projectId: projectId
      }));
      startSync();
    }
  };

  ws.onclose = () => {
    console.log('WebSocket disconnected');
    stopSync();
    handleReconnection();
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleWebSocketMessage(data);
  };
}

// Handle WebSocket messages
function handleWebSocketMessage(data) {
  switch (data.type) {
    case 'sync':
      if (data.sessionId === sessionId && data.projectId === projectId) {
        applyRemoteChanges(data.changes);
      }
      break;
    case 'sb3-file':
      if (data.sessionId === sessionId && !isHost) {
        loadSB3File(data.fileData);
      }
      break;
    case 'error':
      console.error('Server error:', data.message);
      break;
  }
}

// Load SB3 file
async function loadSB3File(fileData) {
  try {
    const vm = window.vm;
    if (!vm) {
      console.error('Scratch VM not found');
      return;
    }

    // Convert array back to ArrayBuffer
    const arrayBuffer = new Uint8Array(fileData).buffer;
    
    // Create a Blob from the ArrayBuffer
    const blob = new Blob([arrayBuffer], { type: 'application/x.scratch.sb3' });
    
    // Create a File object
    const file = new File([blob], 'project.sb3', { type: 'application/x.scratch.sb3' });

    // Load the project
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const projectData = JSON.parse(e.target.result);
        await vm.loadProject(projectData);
        console.log('Project loaded successfully');
        
        // Update project ID after loading
        projectId = getProjectId();
        
        // Notify server about project load
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'project-loaded',
            sessionId: sessionId,
            projectId: projectId
          }));
        }
      } catch (error) {
        console.error('Error loading project:', error);
      }
    };
    reader.readAsText(file);
  } catch (error) {
    console.error('Error processing SB3 file:', error);
  }
}

// Start periodic sync
function startSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
  }
  
  syncInterval = setInterval(() => {
    const currentState = getCurrentState();
    if (hasStateChanged(currentState, lastSyncState)) {
      sendStateUpdate(currentState);
      lastSyncState = currentState;
    }
  }, SYNC_INTERVAL);
}

// Stop periodic sync
function stopSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

// Handle reconnection
function handleReconnection() {
  if (retryCount < MAX_RETRY_ATTEMPTS) {
    retryCount++;
    console.log(`Attempting to reconnect (${retryCount}/${MAX_RETRY_ATTEMPTS})...`);
    setTimeout(initializeWebSocket, RETRY_DELAY);
  } else {
    console.error('Max retry attempts reached');
  }
}

// Get current Scratch project state
function getCurrentState() {
  try {
    const vm = window.vm;
    if (!vm) {
      console.error('Scratch VM not found');
      return null;
    }

    const projectData = {
      projectId: projectId,
      targets: vm.runtime.targets.map(target => ({
        id: target.id,
        name: target.sprite.name,
        blocks: target.blocks._blocks,
        variables: target.variables,
        costumes: target.sprite.costumes,
        sounds: target.sprite.sounds
      })),
      stage: {
        variables: vm.runtime.stage.variables,
        blocks: vm.runtime.stage.blocks._blocks
      }
    };

    return projectData;
  } catch (error) {
    console.error('Error getting current state:', error);
    return null;
  }
}

// Check if state has changed
function hasStateChanged(currentState, lastState) {
  if (!lastState) return true;
  return JSON.stringify(currentState) !== JSON.stringify(lastState);
}

// Send state update to server
function sendStateUpdate(state) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'sync',
      sessionId: sessionId,
      projectId: projectId,
      changes: state
    }));
  }
}

// Apply remote changes
function applyRemoteChanges(changes) {
  try {
    const vm = window.vm;
    if (!vm) {
      console.error('Scratch VM not found');
      return;
    }

    // Apply changes to targets
    changes.targets.forEach(targetData => {
      const target = vm.runtime.getTargetById(targetData.id);
      if (target) {
        // Update blocks
        Object.assign(target.blocks._blocks, targetData.blocks);
        
        // Update variables
        Object.entries(targetData.variables).forEach(([id, value]) => {
          const variable = target.variables[id];
          if (variable) {
            variable.value = value;
          }
        });
      }
    });

    // Apply changes to stage
    if (changes.stage) {
      const stage = vm.runtime.stage;
      Object.assign(stage.blocks._blocks, changes.stage.blocks);
      Object.entries(changes.stage.variables).forEach(([id, value]) => {
        const variable = stage.variables[id];
        if (variable) {
          variable.value = value;
        }
      });
    }

    // Refresh workspace
    vm.emitWorkspaceUpdate();
  } catch (error) {
    console.error('Error applying remote changes:', error);
  }
}

// Initialize extension
function initialize() {
  // Get project ID
  projectId = getProjectId();
  
  // Get session info from storage
  chrome.runtime.sendMessage({ type: 'getSessionInfo' }, (response) => {
    if (response && response.sessionId) {
      sessionId = response.sessionId;
      isHost = response.isHost;
      initializeWebSocket();
    }
  });

  // Listen for session changes
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'updateSessionInfo') {
      sessionId = message.sessionId;
      isHost = message.isHost;
      initializeWebSocket();
    } else if (message.type === 'clearSession') {
      sessionId = null;
      isHost = false;
      stopSync();
      if (ws) {
        ws.close();
      }
    }
  });

  // Listen for Scratch VM initialization
  const checkVM = setInterval(() => {
    if (window.vm) {
      clearInterval(checkVM);
      console.log('Scratch VM initialized');
      if (sessionId) {
        initializeWebSocket();
      }
    }
  }, 100);
}

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
} 