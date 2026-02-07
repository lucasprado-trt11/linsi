// --- CONFIGURAÇÃO OPENROUTER ---
const API_URL = "https://openrouter.ai/api/v1/chat/completions";
// Modelo solicitado
const MODEL_ID = "openrouter/pony-alpha";

const editor = document.getElementById('editor');
const contextMenu = document.getElementById('contextMenu');
const menuOptions = document.getElementById('menuOptions');
const apiKeyInput = document.getElementById('apiKey');

// --- 1. Algoritmo de Legibilidade (Flesch) ---
function calculateFleschScore(text) {
    const cleanText = text.replace(/[^\w\sÀ-ÿ]/g, "");
    const words = cleanText.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return 100;

    const segmenter = new Intl.Segmenter('pt', { granularity: 'sentence' });
    const sentences = [...segmenter.segment(text)];

    let numSyllables = 0;
    words.forEach(w => {
        w = w.toLowerCase();
        if (w.length <= 2) { numSyllables += 1; }
        else {
            const vowels = w.match(/[aáàãâeéêiíoóõôuúü]+/gi);
            numSyllables += vowels ? vowels.length : 1;
        }
    });

    const ASL = words.length / sentences.length;
    const ASW = numSyllables / words.length;

    let score = 248.835 - (1.015 * ASL) - (84.6 * ASW);
    return Math.min(100, Math.max(0, score));
}

// --- 2. Análise e Renderização Visual ---
document.getElementById('btnAnalyze').addEventListener('click', () => {
    const text = editor.innerText;
    document.getElementById('statusIndicator').innerText = `Índice de Legibilidade Global: ${Math.round(calculateFleschScore(text))}`;

    const segmenter = new Intl.Segmenter('pt', { granularity: 'sentence' });
    const segments = segmenter.segment(text);

    let html = "";

    for (const { segment } of segments) {
        const trimmed = segment.trim();
        if (trimmed.length < 3) { html += segment; continue; }

        const score = calculateFleschScore(trimmed);
        let className = "";

        // Critérios de Dificuldade
        if (score < 40) className = "hard";
        else if (score < 60) className = "medium";

        if (className) {
            // Adiciona espaço antes e depois do span para garantir o espaçamento entre blocos
            html += ` <span class="sentence-highlight ${className}" data-original="${trimmed}">${segment.trim()}</span> `;
        } else {
            html += segment;
        }
    }

    editor.innerHTML = html;
});

// --- 3. Menu Contexto ---
let currentTarget = null;

editor.addEventListener('contextmenu', (e) => {
    const target = e.target.closest('.sentence-highlight');
    if (target) {
        e.preventDefault();
        currentTarget = target;

        let x = e.pageX;
        let y = e.pageY + 10;
        if (x + 320 > window.innerWidth) x = window.innerWidth - 330;

        contextMenu.style.left = `${x}px`;
        contextMenu.style.top = `${y}px`;
        contextMenu.classList.add('visible');

        fetchSuggestions(target.getAttribute('data-original'));
    } else {
        contextMenu.classList.remove('visible');
    }
});

document.addEventListener('click', (e) => {
    if (!contextMenu.contains(e.target)) contextMenu.classList.remove('visible');
});

// --- 4. Integração IA (OpenRouter + Pony Alpha) ---
async function fetchSuggestions(sentence) {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
        menuOptions.innerHTML = `<div style="padding:15px; color:red;">⚠️ Insira sua OpenRouter API Key</div>`;
        return;
    }

    menuOptions.innerHTML = `<div class="loading-pulse">Consultando IA (Pony)...</div>`;

    // Prompt robusto para tentar forçar o formato JSON mesmo em modelos alpha
    const prompt = `
    Você é um especialista em Linguagem Simples. Reescreva a frase complexa abaixo para que uma criança de 10 anos entenda.
    
    Frase Original: "${sentence}"
    
    Regras:
    1. Use ordem direta, voz ativa e palavras simples.
    2. Mantenha o sentido original.
    3. Gere exatamente 3 sugestões diferentes.
    
    FORMATO OBRIGATÓRIO:
    Responda APENAS um Array JSON contendo as 3 strings. Não escreva nenhuma introdução ou explicação.
    Exemplo: ["Sugestão simples 1", "Sugestão simples 2", "Sugestão simples 3"]
    `;

    try {
        // Estrutura padrão OpenRouter/OpenAI
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": window.location.href,
            },
            body: JSON.stringify({
                model: MODEL_ID,
                messages: [{ role: "user", content: prompt }],
                temperature: 0.3, // Baixa temperatura para tentar manter o formato
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error?.message || "Erro na API OpenRouter");
        }

        const data = await response.json();
        let content = data.choices[0].message.content;

        // Limpeza e Parsing Robusto
        content = content.replace(/```json/g, "").replace(/```/g, "").trim();

        let suggestions = [];
        try {
            // Tenta parsear como JSON puro
            suggestions = JSON.parse(content);
        } catch (e) {
            console.warn("Falha no JSON puro, tentando regex fallback para modelo alpha.");
            // Fallback: Tenta extrair textos entre aspas se o JSON falhar (comum em modelos alpha)
            const matches = content.match(/"([^"]+)"/g);
            if (matches) {
                suggestions = matches.map(s => s.replace(/"/g, "")).slice(0, 3);
            } else {
                // Último recurso: divide por linhas
                suggestions = content.split('\n').filter(s => s.length > 5).slice(0, 3);
            }
        }

        // Garante que é um array antes de renderizar
        if (!Array.isArray(suggestions)) suggestions = [];

        renderSuggestions(suggestions);

    } catch (error) {
        console.error(error);
        menuOptions.innerHTML = `<div style="padding:15px; color:red;">Erro: ${error.message}</div>`;
    }
}

function renderSuggestions(list) {
    menuOptions.innerHTML = "";

    if (list.length === 0) {
        menuOptions.innerHTML = `<div style="padding:15px;">A IA não retornou sugestões válidas no formato esperado. Tente novamente.</div>`;
        return;
    }

    list.forEach(text => {
        const div = document.createElement('div');
        div.className = 'menu-item';
        div.innerHTML = `<strong>Opção Simples:</strong> ${text}`;

        div.addEventListener('click', () => {
            if (currentTarget) {
                // Substitui o texto e remove o realce
                const newText = document.createTextNode(" " + text + " ");
                currentTarget.parentNode.replaceChild(newText, currentTarget);
                contextMenu.classList.remove('visible');
            }
        });

        menuOptions.appendChild(div);
    });
}