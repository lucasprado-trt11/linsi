// popup.js - Lógica da interface de configuração

document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('apiKeyInput');
    const saveBtn = document.getElementById('saveBtn');
    const statusMsg = document.getElementById('statusMsg');

    // Carrega chave salva
    chrome.storage.sync.get(['apiKey'], (result) => {
        if (result.apiKey) {
            apiKeyInput.value = result.apiKey;
            showStatus('Chave carregada com sucesso!', 'success');
        }
    });

    // Salva configuração
    saveBtn.addEventListener('click', async () => {
        const key = apiKeyInput.value.trim();

        if (!key) {
            showStatus('⚠️ Por favor, insira uma chave válida.', 'error');
            return;
        }

        // Valida formato básico
        if (!key.startsWith('sk-or-')) {
            showStatus('⚠️ Formato inválido. A chave deve começar com "sk-or-"', 'error');
            return;
        }

        try {
            // Salva no storage
            await chrome.storage.sync.set({ apiKey: key });

            // Notifica content scripts
            const tabs = await chrome.tabs.query({});
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, { 
                    action: 'updateApiKey', 
                    apiKey: key 
                }).catch(() => {
                    // Ignora erros de tabs sem content script
                });
            });

            showStatus('✅ Configuração salva com sucesso!', 'success');

            // Limpa mensagem após 2s
            setTimeout(() => {
                statusMsg.textContent = '';
            }, 2000);

        } catch (error) {
            showStatus(`❌ Erro: ${error.message}`, 'error');
        }
    });

    // Permite salvar com Enter
    apiKeyInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveBtn.click();
        }
    });

    function showStatus(message, type) {
        statusMsg.textContent = message;
        statusMsg.style.color = type === 'success' ? '#059669' : '#DC2626';
    }
});