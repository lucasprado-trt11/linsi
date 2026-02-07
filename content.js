// content.js - Leitura do DOM Exposto pelo Hack

const CONFIG = {
    debounceTime: 1000,
    minTextLength: 5,
    selectors: {
        // Seletores que aparecem quando o Hack de Whitelist funciona:

        // 1. Texto em SVG (Renderização vetorial exposta)
        svgText: 'div.kix-canvas-tile-content svg g rect[aria-label]',

        // 2. Linhas de HTML (Renderização HTML forçada)
        htmlLine: '.kix-lineview-content',

        // 3. Fallback Genérico
        genericEditor: '[contenteditable="true"], textarea, body[contenteditable="true"]'
    }
};

let overlayLayer = null;
let currentEditor = null;
let analysisTimeout = null;

// --- 1. Overlay System (Camada Visual) ---

function getOverlay(doc) {
    let overlay = doc.getElementById('sai-doc-overlay');
    if (!overlay) {
        overlay = doc.createElement('div');
        overlay.id = 'sai-doc-overlay';
        overlay.className = 'sai-overlay-container';
        doc.body.appendChild(overlay);
    }
    return overlay;
}

function drawHighlight(rect, type, doc, text) {
    const overlay = getOverlay(doc);
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    const line = doc.createElement('div');
    line.className = `sai-highlight-line sai-${type}`;

    // Ajuste fino de coordenadas
    line.style.left = `${rect.left + scrollX}px`;
    line.style.top = `${rect.bottom + scrollY - 2}px`;
    line.style.width = `${rect.width}px`;

    line.dataset.text = text;

    line.addEventListener('click', (e) => {
        e.stopPropagation();
        alert(`Texto lido com sucesso:\n"${text}"\n\n(Aqui viria a correção da IA)`);
    });

    overlay.appendChild(line);
}

// --- 2. Scanner Docs (Modo Hack Ativado) ---

function scanGoogleDocs(editor) {
    const doc = document;
    const overlay = getOverlay(doc);
    overlay.innerHTML = ''; // Limpa

    // TENTA LER VIA HACK SVG (Prioridade)
    const svgRects = document.querySelectorAll(CONFIG.selectors.svgText);

    if (svgRects.length > 0) {
        // console.log(`[SimplificaAI] Hack SVG funcionou! Encontrados ${svgRects.length} elementos.`);
        svgRects.forEach(rectNode => {
            const text = rectNode.getAttribute('aria-label');
            processNode(rectNode, text, doc);
        });
        return;
    }

    // TENTA LER VIA DOM HTML (HTML Forçado)
    const htmlLines = document.querySelectorAll(CONFIG.selectors.htmlLine);
    if (htmlLines.length > 0) {
        // console.log(`[SimplificaAI] Hack HTML funcionou! Encontradas ${htmlLines.length} linhas.`);
        htmlLines.forEach(lineNode => {
            const text = lineNode.innerText;
            processNode(lineNode, text, doc);
        });
    }
}

function processNode(node, text, doc) {
    if (!text || text.trim().length < CONFIG.minTextLength) return;

    // Cálculo Simples de Complexidade (Flesch)
    const complexity = Utils.calculateComplexity(text);

    if (complexity) {
        const rect = node.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            drawHighlight(rect, complexity, doc, text);
        }
    }
}

// --- 3. Scanner Genérico (Gmail, etc) ---

function scanGenericEditor(editor) {
    const doc = editor.ownerDocument;
    getOverlay(doc).innerHTML = '';

    const text = editor.innerText;
    if (!text) return;

    // Lógica simplificada de frases
    const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
    sentences.forEach(sentence => {
        const clean = sentence.trim();
        const complexity = Utils.calculateComplexity(clean);
        if (complexity) {
            try {
                const range = findTextRange(editor, clean);
                if (range) {
                    const rects = range.getClientRects();
                    for (const rect of rects) drawHighlight(rect, complexity, doc, clean);
                }
            } catch (e) { }
        }
    });
}

function findTextRange(root, pattern) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while (node = walker.nextNode()) {
        const index = node.nodeValue.indexOf(pattern);
        if (index !== -1) {
            const range = document.createRange();
            range.setStart(node, index);
            range.setEnd(node, index + pattern.length);
            return range;
        }
    }
    return null;
}

// --- 4. Loop Principal ---

function runAnalysis() {
    // Detecta Google Docs
    const docsApp = document.querySelector('.kix-appview-editor');
    if (docsApp) {
        scanGoogleDocs(docsApp);
    }
    // Detecta Genérico
    else if (currentEditor) {
        scanGenericEditor(currentEditor);
    }
}

function handleInput() {
    if (analysisTimeout) clearTimeout(analysisTimeout);
    analysisTimeout = setTimeout(runAnalysis, CONFIG.debounceTime);
}

// Inicialização
setInterval(() => {
    // Verifica Docs
    const docsApp = document.querySelector('.kix-appview-editor');
    if (docsApp) {
        if (currentEditor !== docsApp) {
            currentEditor = docsApp;
            console.log("[SimplificaAI] Google Docs detectado via Whitelist Hack.");
            // Listeners globais para Docs
            window.addEventListener('scroll', runAnalysis, true);
            window.addEventListener('resize', runAnalysis);
            document.addEventListener('keyup', handleInput);
            document.addEventListener('mouseup', handleInput); // Clique muda seleção
            runAnalysis();
        }
    }
    // Verifica Genérico
    else {
        const active = document.activeElement;
        if (active && active.isContentEditable && active !== currentEditor) {
            currentEditor = active;
            active.addEventListener('input', handleInput);
            runAnalysis();
        }
    }
}, 2000);