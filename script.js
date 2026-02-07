// --- CONFIGURAÇÃO ---
const API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL_ID = "openrouter/pony-alpha"; // Modelo rápido e capaz

const editor = document.getElementById('editor');
const contextMenu = document.getElementById('contextMenu');
const menuOptions = document.getElementById('menuOptions');
const apiKeyInput = document.getElementById('apiKey');

// --- 1. Tempo Real (Debounce) ---
let typingTimer;
const doneTypingInterval = 1500;

editor.addEventListener('input', () => {
    clearTimeout(typingTimer);
    // Atualiza número imediatamente
    const currentScore = Math.round(calculateFleschScore(editor.innerText));
    updateGauge(currentScore);

    typingTimer = setTimeout(analyzeAndFormat, doneTypingInterval);
});

window.addEventListener('load', analyzeAndFormat);

// --- 2. Algoritmo Flesch ---
function calculateFleschScore(text) {
    const cleanText = text.replace(/[^\w\sÀ-ÿ]/g, "");
    const words = cleanText.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return 0;

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

    const ASL = words.length / (sentences.length || 1);
    const ASW = numSyllables / words.length;

    let score = 248.835 - (1.015 * ASL) - (84.6 * ASW);
    return Math.min(100, Math.max(0, score));
}

// --- 3. UI Updates (Novo Gauge) ---
function updateGauge(score) {
    const marker = document.getElementById('gaugeMarker');
    const display = document.getElementById('scoreDisplay');
    const status = document.getElementById('statusText');

    // Limita entre 0 e 100
    const safeScore = Math.min(100, Math.max(0, score));

    // Move o marcador (0% = esquerda, 100% = direita)
    marker.style.left = `${safeScore}%`;
    display.innerText = Math.round(safeScore);

    // Textos de status
    if (score < 40) {
        status.innerText = "Texto Muito Complexo";
        status.style.color = "#EF4444";
    } else if (score < 70) {
        status.innerText = "Texto Técnico / Difícil";
        status.style.color = "#F97316";
    } else {
        status.innerText = "Texto Acessível (Linguagem Simples)";
        status.style.color = "#10B981";
    }
}

// --- 4. Formatação e Realce ---
function analyzeAndFormat() {
    // Salva posição cursor
    const selection = window.getSelection();
    const isFocused = (document.activeElement === editor);

    const text = editor.innerText;
    const score = calculateFleschScore(text);
    updateGauge(score);

    const segmenter = new Intl.Segmenter('pt', { granularity: 'sentence' });
    const segments = segmenter.segment(text);

    let html = "";

    for (const { segment } of segments) {
        const trimmed = segment.trim();
        // Ignora pontuação solta ou espaços
        if (trimmed.length < 3) { html += segment; continue; }

        const sentenceScore = calculateFleschScore(trimmed);
        let className = "";

        if (sentenceScore < 40) className = "hard";
        else if (sentenceScore < 60) className = "medium";

        if (className) {
            // AQUI ESTÁ O FIX DE ESPAÇAMENTO:
            // Adicionamos o span e um espaço em branco FORA do span se necessário
            html += `<span class="sentence-highlight ${className}" data-original="${trimmed}">${segment.trim()}</span> `;
        } else {
            html += segment;
        }
    }

    // Só atualiza se mudou algo para evitar pulos
    if (editor.innerHTML !== html) {
        editor.innerHTML = html;
        if (isFocused) placeCaretAtEnd(editor);
    }
}

function placeCaretAtEnd(el) {
    el.focus();
    if (typeof window.getSelection != "undefined" && typeof document.createRange != "undefined") {
        var range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }
}

// --- 5. Menu e IA ---
let currentTarget = null;

editor.addEventListener('contextmenu', (e) => {
    const target = e.target.closest('.sentence-highlight');
    if (target) {
        e.preventDefault();
        currentTarget = target;

        let x = e.pageX;
        let y = e.pageY + 10;
        if (x + 360 > window.innerWidth) x = window.innerWidth - 370;

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

async function fetchSuggestions(sentence) {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
        menuOptions.innerHTML = `<div style="padding:20px; text-align:center; color:#EF4444;">Insira sua API Key acima ☝️</div>`;
        return;
    }

    menuOptions.innerHTML = `<div class="loader-pulse">O Pony Alpha está pensando...</div>`;

    const prompt = `
    TASK: Reescrever em Linguagem Simples (Plain Language).
    TARGET: Público leigo (Ensino Fundamental).
    INPUT: "${sentence}"
    OUTPUT FORMAT: JSON Array com 3 strings. Ex: ["Opção 1", "Opção 2", "Opção 3"]
    `;

    try {
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
                temperature: 0.3,
            })
        });

        if (!response.ok) throw new Error("Erro na API");

        const data = await response.json();
        let content = data.choices[0].message.content;

        // Limpeza Pony
        content = content.replace(/```json/g, "").replace(/```/g, "").trim();

        let suggestions = [];
        try {
            suggestions = JSON.parse(content);
        } catch (e) {
            // Regex Fallback
            const matches = content.match(/"([^"]+)"/g);
            if (matches) suggestions = matches.map(s => s.replace(/"/g, "")).slice(0, 3);
            else suggestions = content.split('\n').filter(s => s.length > 5).slice(0, 3);
        }

        renderSuggestions(suggestions);

    } catch (error) {
        console.error(error);
        menuOptions.innerHTML = `<div style="padding:15px; color:red; text-align:center;">Erro: ${error.message}</div>`;
    }
}

function renderSuggestions(list) {
    menuOptions.innerHTML = "";

    if (!list || list.length === 0) {
        menuOptions.innerHTML = `<div style="padding:15px;">Sem sugestões válidas.</div>`;
        return;
    }

    list.forEach(text => {
        const div = document.createElement('div');
        div.className = 'menu-item';
        div.innerHTML = `<strong>Opção:</strong> ${text}`;

        div.addEventListener('click', () => {
            if (currentTarget) {
                // Substitui com espaço seguro
                const newText = document.createTextNode(" " + text + " ");
                currentTarget.parentNode.replaceChild(newText, currentTarget);
                contextMenu.classList.remove('visible');
                // Re-analisa
                setTimeout(analyzeAndFormat, 800);
            }
        });

        menuOptions.appendChild(div);
    });
}