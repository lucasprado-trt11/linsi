document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('apiKeyInput');
    const saveBtn = document.getElementById('saveBtn');
    const statusMsg = document.getElementById('statusMsg');

    // Carregar chave salva
    chrome.storage.sync.get(['apiKey'], (result) => {
        if (result.apiKey) {
            apiKeyInput.value = result.apiKey;
        }
    });

    saveBtn.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();

        if (!key) {
            statusMsg.style.color = 'red';
            statusMsg.innerText = "Por favor, insira uma chave válida.";
            return;
        }

        chrome.storage.sync.set({ apiKey: key }, () => {
            statusMsg.style.color = 'green';
            statusMsg.innerText = "Configuração salva com sucesso!";
            setTimeout(() => { statusMsg.innerText = ""; }, 2000);
        });
    });
});