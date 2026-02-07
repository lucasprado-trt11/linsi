// background.js - Service Worker da extensão SimplificaAI

chrome.runtime.onInstalled.addListener(() => {
    console.log('[SimplificaAI] Extensão instalada/atualizada');

    // Cria menu de contexto (opcional, backup)
    chrome.contextMenus.create({
        id: 'simplificaAI-root',
        title: '📝 SimplificaAI',
        contexts: ['editable'],
        documentUrlPatterns: ['<all_urls>']
    });

    chrome.contextMenus.create({
        id: 'simplificaAI-analyze',
        parentId: 'simplificaAI-root',
        title: 'Analisar texto',
        contexts: ['editable'],
        documentUrlPatterns: ['<all_urls>']
    });
});

// Limpa menu ao desinstalar
chrome.runtime.onStartup.addListener(() => {
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: 'simplificaAI-root',
            title: '📝 SimplificaAI',
            contexts: ['editable'],
            documentUrlPatterns: ['<all_urls>']
        });
    });
});

// Manipula cliques no menu de contexto
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'simplificaAI-analyze') {
        chrome.tabs.sendMessage(tab.id, { 
            action: 'triggerAnalysis' 
        }).catch(err => {
            console.log('[SimplificaAI] Tab não acessível:', err);
        });
    }
});

// Comunicação com content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case 'getApiKey':
            chrome.storage.sync.get(['apiKey'], (result) => {
                sendResponse({ apiKey: result.apiKey || null });
            });
            return true; // Async

        case 'openOptions':
            chrome.runtime.openOptionsPage();
            break;

        default:
            break;
    }
});

// Atualiza ícone quando API key é configurada
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && changes.apiKey) {
        console.log('[SimplificaAI] API Key atualizada');
    }
});