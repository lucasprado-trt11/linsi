const API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL_ID = "tngtech/tng-r1t-chimera:free";

const editor = document.getElementById('editor');
const contextMenu = document.getElementById('contextMenu');
const menuOptions = document.getElementById('menuOptions');
const apiKeyInput = document.getElementById('apiKey');

// --- 1. Algoritmo de Legibilidade (Flesch PT-BR) ---

function countSyllables(word) {
    word = word.toLowerCase();
    if (word.length <= 3) return 1;
    // Heurística simplificada para PT-BR: conta grupos vocálicos
    const vowels = word.match(/[aáàãâeéêiíoóõôuúü]+/gi);
    return vowels ? vowels.length : 1;
}

function calculateFleschScore(text) {
    // Limpeza básica
    const cleanText = text.replace(/[^\w\sÀ-ÿ]/g, "");
    const words = cleanText.split(/\s+/).filter(w => w.length > 0);
    const numWords = words.length;

    if (numWords === 0) return 100;

    // Segmentação de Sentenças (API nativa moderna do navegador)
    const segmenter = new Intl.Segmenter('pt', { granularity: 'sentence' });
    const sentences = [...segmenter.segment(text)].map(s => s.segment);
    const numSentences = sentences.length;

    let numSyllables = 0;
    words.forEach(w => numSyllables += countSyllables(w));

    // Fórmula Adaptada para PT (Martins et al / Flesch Reading Ease)
    // Score = 248.835 - (1.015 * ASL) - (84.6 * ASW)
    // ASL = Average Sentence Length (Palavras / Frases)
    // ASW = Average Syllables per Word (Sílabas / Palavras)

    const ASL = numWords / numSentences;
    const ASW = numSyllables / numWords;

    let score = 248.835 - (1.015 * ASL) - (84.6 * ASW);

    // Normalizar para 0-100 (aproximado para facilitar UI)
    return Math.min(100, Math.max(0, score));
}

// --- 2. Análise e Highlight ---

document.getElementById('btnAnalyze').addEventListener('click', analyzeText);

function analyzeText() {
    const text = editor.innerText; // Pega texto puro
    const overallScore = calculateFleschScore(text);

    // Atualiza Painel Lateral
    const display = document.getElementById('scoreDisplay');
    display.innerText = Math.round(overallScore);
    display.style.color = overallScore < 50 ? '#EF4444' : (overallScore < 75 ? '#F59E0B' : '#10B981');
    document.getElementById('scoreText').innerText = getScoreLabel(overallScore);

    // Processa Highlights por Frase
    const segmenter = new Intl.Segmenter('pt', { granularity: 'sentence' });
    const sentences = [...segmenter.segment(text)];

    let newHTML = "";

    sentences.forEach(({ segment }) => {
        const score = calculateFleschScore(segment);
        const trimmed = segment.trim();

        if (trimmed.length < 5) {
            newHTML += segment; // Ignora frases muito curtas
            return;
        }

        let className = "";
        if (score < 40) className = "hard";       // Vermelho
        else if (score < 60) className = "medium"; // Amarelo

        if (className) {
            // Envolvemos em SPAN com classe e ID para substituição
            newHTML += `<span class="sentence-highlight ${className}" data-original="${trimmed}">${segment}</span>`;
        } else {
            newHTML += segment;
        }
    });

    editor.innerHTML = newHTML;
}

function getScoreLabel(score) {
    if (score < 50) return "Texto Muito Difícil (Universitário)";
    if (score < 75) return "Texto Médio (Ensino Médio)";
    return "Texto Fácil (Ensino Fundamental)";
}

// --- 3. Menu de Contexto (Right Click) ---

let currentTargetSpan = null; // Armazena qual frase estamos editando

editor.addEventListener('contextmenu', (e) => {
    // Verifica se clicou em um highlight
    if (e.target.classList.contains('sentence-highlight')) {
        e.preventDefault(); // Bloqueia menu nativo

        currentTargetSpan = e.target;
        const originalText = e.target.getAttribute('data-original');

        // Posiciona o menu
        contextMenu.style.top = `${e.pageY}px`;
        contextMenu.style.left = `${e.pageX}px`;
        contextMenu.classList.remove('hidden');

        // Chama IA
        fetchSimplifications(originalText);
    } else {
        contextMenu.classList.add('hidden');
    }
});

// Fecha menu ao clicar fora
document.addEventListener('click', (e) => {
    if (!contextMenu.contains(e.target)) {
        contextMenu.classList.add('hidden');
    }
});

// --- 4. Integração com IA (OpenRouter) ---

async function fetchSimplifications(sentence) {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        menuOptions.innerHTML = `<div class="menu-loading" style="color:red;">Insira sua API Key no topo.</div>`;
        return;
    }

    menuOptions.innerHTML = `<div class="menu-loading">Gerando opções com IA...</div>`;

    const prompt = `
    A frase a seguir é muito complexa: "${sentence}".
    Gere 3 alternativas reescritas em Linguagem Simples (nível fundamental).
    As frases devem ser curtas, diretas e manter o sentido original.
    Responda APENAS com as 3 frases separadas por quebra de linha, sem numeração ou introdução.
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
                messages: [{ role: "user", content: prompt }]
            })
        });

        const data = await response.json();
        const content = data.choices[0].message.content;

        // Processa resposta (remove numeração se a IA colocar)
        const options = content.split('\n').filter(line => line.trim().length > 0);

        renderMenuOptions(options);

    } catch (error) {
        menuOptions.innerHTML = `<div class="menu-loading" style="color:red;">Erro: ${error.message}</div>`;
    }
}

function renderMenuOptions(options) {
    menuOptions.innerHTML = "";

    options.forEach(opt => {
        // Limpa marcadores que a IA possa ter colocado (1. , -, etc)
        const cleanOpt = opt.replace(/^[\d\-\.\)]+\s*/, "").trim();

        const div = document.createElement('div');
        div.className = 'menu-item';
        div.innerText = cleanOpt;

        // Clique na opção substitui o texto
        div.addEventListener('click', () => {
            if (currentTargetSpan) {
                // Substitui o SPAN pelo texto novo (remove o highlight)
                const textNode = document.createTextNode(cleanOpt + " "); // Adiciona espaço de segurança
                currentTargetSpan.parentNode.replaceChild(textNode, currentTargetSpan);

                // Esconde menu
                contextMenu.classList.add('hidden');

                // Recalcula score global (opcional, para atualizar a métrica)
                // calculateFleschScore(editor.innerText); 
            }
        });

        menuOptions.appendChild(div);
    });
}