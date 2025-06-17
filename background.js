// Handle installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('RealScratch extension installed');
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'getSessionInfo':
      chrome.storage.local.get(['sessionId', 'isHost'], (result) => {
        sendResponse(result);
      });
      break;

    case 'updateSessionInfo':
      chrome.storage.local.set({
        sessionId: message.sessionId,
        isHost: message.isHost
      }, () => {
        // Notify all tabs about the session update
        chrome.tabs.query({ url: 'https://scratch.mit.edu/projects/*/editor*' }, (tabs) => {
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
              type: 'updateSessionInfo',
              sessionId: message.sessionId,
              isHost: message.isHost
            });
          });
        });
        sendResponse({ success: true });
      });
      break;

    case 'clearSession':
      chrome.storage.local.remove(['sessionId', 'isHost'], () => {
        // Notify all tabs about the session clear
        chrome.tabs.query({ url: 'https://scratch.mit.edu/projects/*/editor*' }, (tabs) => {
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
              type: 'clearSession'
            });
          });
        });
        sendResponse({ success: true });
      });
      break;

    case 'sb3FileUpload':
      // Forward the SB3 file data to all participants
      chrome.tabs.query({ url: 'https://scratch.mit.edu/projects/*/editor*' }, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, {
            type: 'sb3-file',
            sessionId: message.sessionId,
            fileData: message.fileData
          });
        });
      });
      sendResponse({ success: true });
      break;
  }
  return true; // Keep the message channel open for async responses
});

// Handle tab updates to inject content script
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url.includes('scratch.mit.edu/projects/')) {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    }).catch(err => console.error('Failed to inject content script:', err));
  }
}); 