// content.js - Script principal da extensão SimplificaAI - V3 (Restaurado + Correções)

(function() {
    'use strict';

    // Estado global - ESTRUTURA ORIGINAL
    const State = {
        currentEditor: null,
        editorType: null,
        overlayLayer: null,
        highlights: new Map(),
        isAnalyzing: false,
        apiKey: null,
        contextMenu: null,
        analysisTimeout: null,
        lastAnalyzedText: ''
    };

    // Seletores - ESTRUTURA ORIGINAL com expansão para Gmail
    const EditorSelectors = {
        gdocs: {
            container: '.kix-appview-editor',
            svgText: 'div.kix-canvas-tile-content svg g rect[aria-label]',
            htmlLine: '.kix-lineview-content'
        },
        gmail: {
            compose: 'div[role="dialog"] div[contenteditable="true"][role="textbox"]'
        },
        cke4: { editor: '.cke_editable' },
        cke5: { editor: '.ck-editor__editable' }
    };

    // ==========================================
    // INICIALIZAÇÃO - ORIGINAL
    // ==========================================

    function init() {
        console.log('[SimplificaAI] V3 Inicializando...');
        loadApiKey();
        createOverlay();
        createContextMenu();
        startEditorDetection();
        chrome.runtime.onMessage.addListener(handleMessages);
    }

    function loadApiKey() {
        chrome.storage.sync.get(['apiKey'], (result) => {
            State.apiKey = result.apiKey || null;
        });
    }

    function createOverlay() {
        State.overlayLayer = document.createElement('div');
        State.overlayLayer.id = 'sai-overlay-container';
        State.overlayLayer.className = 'sai-overlay-container';
        document.body.appendChild(State.overlayLayer);
    }

    function createContextMenu() {
        State.contextMenu = document.createElement('div');
        State.contextMenu.id = 'sai-context-menu';
        State.contextMenu.className = 'sai-context-menu';
        State.contextMenu.innerHTML = `
            <div class="sai-menu-header">
                <span>SimplificaAI</span>
                <span class="sai-badge">IA</span>
            </div>
            <div class="sai-menu-content"></div>
        `;
        document.body.appendChild(State.contextMenu);
    }

    // ==========================================
    // DETECÇÃO - ORIGINAL com melhoria para Gmail
    // ==========================================

    function startEditorDetection() {
        detectEditor();
        setInterval(detectEditor, 1500);
        document.addEventListener('focusin', handleFocusIn, true);
        document.addEventListener('click', handleClick, true);
    }

    function detectEditor() {
        const url = window.location.href;

        // Google Docs - ORIGINAL
        if (url.includes('docs.google.com')) {
            const docsContainer = document.querySelector(EditorSelectors.gdocs.container);
            if (docsContainer && State.currentEditor !== docsContainer) {
                setupGoogleDocs(docsContainer);
            }
            return;
        }

        // Gmail - MELHORADO: múltiplos seletores
        if (url.includes('mail.google.com')) {
            const selectors = [
                'div[role="dialog"] div[contenteditable="true"][role="textbox"]',
                'div[role="dialog"] div[contenteditable="true"][g_editable="true"]',
                'div.Am.Al.editable',
                'div[aria-label*="mensagem"]',
                'div[aria-label*="Message"]',
                'div[contenteditable="true"][aria-label*="Corpo"]'
            ];

            selectors.forEach(selector => {
                document.querySelectorAll(selector).forEach(editor => {
                    if (!editor.dataset.saiAttached && isVisible(editor)) {
                        setupGmail(editor);
                    }
                });
            });
            return;
        }

        // Genéricos - ORIGINAL
        document.querySelectorAll('[contenteditable="true"], textarea').forEach(editor => {
            if (!editor.dataset.saiAttached && isVisible(editor)) {
                setupGenericEditor(editor);
            }
        });
    }

    function isVisible(el) {
        return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    }

    function handleFocusIn(e) {
        const target = e.target;
        if (Utils.isEditableElement(target) && !target.dataset.saiAttached) {
            setupGenericEditor(target);
        }
    }

    function handleClick(e) {
        if (State.contextMenu && !State.contextMenu.contains(e.target)) {
            hideContextMenu();
        }

        const bgHighlight = e.target.closest('.sai-highlight-bg');
        if (bgHighlight) {
            e.preventDefault();
            e.stopPropagation();
            showContextMenu(e, bgHighlight.dataset.text);
            return;
        }

        const lineHighlight = e.target.closest('.sai-highlight-line');
        if (lineHighlight) {
            e.preventDefault();
            e.stopPropagation();
            showContextMenu(e, lineHighlight.dataset.text);
        }
    }

    // ==========================================
    // SETUP - ORIGINAL
    // ==========================================

    function setupGoogleDocs(container) {
        console.log('[SimplificaAI] Google Docs detectado');
        State.currentEditor = container;
        State.editorType = 'gdocs';

        window.addEventListener('scroll', debouncedAnalysis, true);
        window.addEventListener('resize', debouncedAnalysis);
        document.addEventListener('selectionchange', debouncedAnalysis);

        setTimeout(analyzeGoogleDocs, 1000);
    }

    function setupGmail(editor) {
        console.log('[SimplificaAI] Gmail detectado');
        editor.dataset.saiAttached = 'true';

        const wrapper = {
            element: editor,
            type: 'gmail',
            getText: () => editor.innerText || '',
            setText: (oldText, newText) => replaceInGmail(editor, oldText, newText)
        };

        attachEditorListeners(wrapper);
    }

    function setupGenericEditor(editor) {
        console.log('[SimplificaAI] Editor genérico:', editor.tagName);
        editor.dataset.saiAttached = 'true';

        const wrapper = {
            element: editor,
            type: 'generic',
            getText: () => editor.value || editor.innerText || '',
            setText: (oldText, newText) => replaceInGeneric(editor, oldText, newText)
        };

        attachEditorListeners(wrapper);
    }

    function attachEditorListeners(wrapper) {
        const { element } = wrapper;

        ['input', 'keyup', 'paste'].forEach(event => {
            element.addEventListener(event, () => scheduleAnalysis(wrapper));
        });

        scheduleAnalysis(wrapper);
    }

    // ==========================================
    // ANÁLISE - ORIGINAL
    // ==========================================

    function scheduleAnalysis(wrapper) {
        if (State.analysisTimeout) clearTimeout(State.analysisTimeout);
        State.analysisTimeout = setTimeout(() => analyzeEditor(wrapper), Utils.CONFIG.debounceTime);
    }

    const debouncedAnalysis = Utils.debounce(() => {
        if (State.editorType === 'gdocs') analyzeGoogleDocs();
    }, 500);

    function analyzeEditor(wrapper) {
        const text = wrapper.getText();
        if (!text || text === State.lastAnalyzedText) return;

        State.lastAnalyzedText = text;
        clearHighlights();

        const sentences = Utils.segmentSentences(text);

        sentences.forEach(sentence => {
            const trimmed = sentence.trim();
            if (trimmed.length < Utils.CONFIG.minTextLength) return;

            const analysis = Utils.calculateFleschScore(trimmed);
            if (!analysis || analysis.level === 'easy') return;

            highlightText(wrapper, trimmed, analysis);
        });
    }

    function analyzeGoogleDocs() {
        if (!State.currentEditor) return;

        clearHighlights();

        // SVG - ORIGINAL
        const svgRects = document.querySelectorAll(EditorSelectors.gdocs.svgText);
        if (svgRects.length > 0) {
            svgRects.forEach(rect => {
                const text = rect.getAttribute('aria-label');
                if (!text) return;

                const analysis = Utils.calculateFleschScore(text);
                if (!analysis || analysis.level === 'easy') return;

                // CORREÇÃO 1: Usa fundo colorido
                drawBackgroundHighlight(rect.getBoundingClientRect(), analysis.level, text);
            });
            return;
        }

        // HTML fallback - ORIGINAL
        const htmlLines = document.querySelectorAll(EditorSelectors.gdocs.htmlLine);
        htmlLines.forEach(line => {
            const text = line.innerText;
            if (!text) return;

            const sentences = Utils.segmentSentences(text);
            sentences.forEach(sentence => {
                const analysis = Utils.calculateFleschScore(sentence.trim());
                if (!analysis || analysis.level === 'easy') return;

                const range = findTextRange(line, sentence.trim());
                if (range) {
                    const rects = range.getClientRects();
                    for (const rect of rects) {
                        drawBackgroundHighlight(rect, analysis.level, sentence.trim());
                    }
                }
            });
        });
    }

    function highlightText(wrapper, text, analysis) {
        const { element } = wrapper;

        if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') return;

        const range = findTextRange(element, text);
        if (!range) return;

        const rects = range.getClientRects();
        for (const rect of rects) {
            drawBackgroundHighlight(rect, analysis.level, text);
        }
    }

    function findTextRange(root, text) {
        if (!root || !text) return null;

        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while (node = walker.nextNode()) {
            const index = node.nodeValue.indexOf(text);
            if (index !== -1) {
                const range = document.createRange();
                range.setStart(node, index);
                range.setEnd(node, index + text.length);
                return range;
            }
        }
        return null;
    }

    // ==========================================
    // VISUALIZAÇÃO - CORREÇÃO 1: FUNDO COLORIDO
    // ==========================================

    function drawBackgroundHighlight(rect, type, text) {
        if (!rect || rect.width < 5 || rect.height < 5) return;

        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;

        const highlight = document.createElement('div');
        highlight.className = `sai-highlight-bg sai-${type}`;
        highlight.style.left = `${rect.left + scrollX}px`;
        highlight.style.top = `${rect.top + scrollY}px`;
        highlight.style.width = `${rect.width}px`;
        highlight.style.height = `${rect.height}px`;
        highlight.dataset.text = text;
        highlight.dataset.id = Utils.generateId();

        highlight.addEventListener('click', (e) => {
            e.stopPropagation();
            showContextMenu(e, text);
        });

        highlight.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showContextMenu(e, text);
        });

        State.overlayLayer.appendChild(highlight);
        State.highlights.set(highlight.dataset.id, { element: highlight, text });
    }

    function clearHighlights() {
        if (State.overlayLayer) State.overlayLayer.innerHTML = '';
        State.highlights.clear();
    }

    // ==========================================
    // MENU E IA - CORREÇÃO 3: WRAPPER
    // ==========================================

    function showContextMenu(event, text) {
        if (!State.contextMenu) return;

        const menu = State.contextMenu;
        const content = menu.querySelector('.sai-menu-content');

        let x = event.pageX || event.clientX + window.scrollX;
        let y = event.pageY || event.clientY + window.scrollY;

        if (x + 360 > window.innerWidth + window.scrollX) {
            x = window.innerWidth + window.scrollX - 370;
        }
        if (y + 300 > window.innerHeight + window.scrollY) {
            y = window.innerHeight + window.scrollY - 310;
        }

        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.classList.add('visible');

        if (!State.apiKey) {
            content.innerHTML = '<div class="sai-error"><p>API Key não configurada</p></div>';
            return;
        }

        content.innerHTML = '<div class="sai-loading">Consultando IA...</div>';

        Utils.callOpenRouter(State.apiKey, text)
            .then(response => Utils.parseSuggestions(response))
            .then(suggestions => renderSuggestions(content, suggestions, text))
            .catch(error => {
                content.innerHTML = `<div class="sai-error"><p>Erro: ${error.message}</p></div>`;
            });
    }

    function hideContextMenu() {
        if (State.contextMenu) State.contextMenu.classList.remove('visible');
    }

    function renderSuggestions(container, suggestions, originalText) {
        if (!suggestions || suggestions.length === 0) {
            container.innerHTML = '<div class="sai-empty">Nenhuma sugestão</div>';
            return;
        }

        let html = '<div class="sai-suggestions-list">';

        suggestions.forEach(suggestion => {
            const analysis = Utils.calculateFleschScore(suggestion);
            const score = analysis ? Math.round(analysis.score) : '--';
            const level = analysis ? analysis.level : 'unknown';

            html += `<div class="sai-suggestion-item">
                <div class="sai-suggestion-text">${escapeHtml(suggestion)}</div>
                <div class="sai-suggestion-meta">
                    <span class="sai-score sai-score-${level}">Flesch: ${score}</span>
                    <button class="sai-apply-btn" data-text="${escapeHtml(suggestion)}">Aplicar</button>
                </div>
            </div>`;
        });

        html += '</div>';
        html += `<div class="sai-original"><strong>Original:</strong> ${escapeHtml(originalText)}</div>`;

        container.innerHTML = html;

        container.querySelectorAll('.sai-apply-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                applySuggestion(originalText, btn.dataset.text);
                hideContextMenu();
            });
        });
    }

    // CORREÇÃO 3: applySuggestion corrigida
    function applySuggestion(oldText, newText) {
        console.log('[SimplificaAI] Aplicando:', oldText.slice(0, 30));

        // Estratégia 1: Elemento ativo
        const active = document.activeElement;
        if (active && Utils.isEditableElement(active)) {
            if (tryReplace(active, oldText, newText)) return;
        }

        // Estratégia 2: Busca em todos os editores
        const editors = document.querySelectorAll('[contenteditable="true"], textarea, input');
        for (const editor of editors) {
            const text = editor.value || editor.innerText || '';
            if (text.includes(oldText)) {
                if (tryReplace(editor, oldText, newText)) {
                    console.log('[SimplificaAI] Substituído com sucesso');
                    return;
                }
            }
        }

        console.error('[SimplificaAI] Wrapper não encontrado');
        alert('Texto não encontrado. Clique no editor antes de aplicar.');
    }

    function tryReplace(element, oldText, newText) {
        try {
            if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
                const start = element.value.indexOf(oldText);
                if (start === -1) return false;
                element.value = element.value.substring(0, start) + newText + 
                               element.value.substring(start + oldText.length);
                triggerEvents(element);
                return true;
            }

            // Range API
            const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
            let node;
            while (node = walker.nextNode()) {
                const index = node.nodeValue.indexOf(oldText);
                if (index !== -1) {
                    const range = document.createRange();
                    range.setStart(node, index);
                    range.setEnd(node, index + oldText.length);
                    range.deleteContents();
                    range.insertNode(document.createTextNode(newText));
                    triggerEvents(element);
                    return true;
                }
            }

            // innerHTML fallback
            if (element.innerText && element.innerText.includes(oldText)) {
                const temp = document.createElement('div');
                temp.textContent = oldText;
                const escapedOld = temp.innerHTML;
                temp.textContent = newText;
                const escapedNew = temp.innerHTML;

                if (element.innerHTML.includes(escapedOld)) {
                    element.innerHTML = element.innerHTML.replace(escapedOld, escapedNew);
                    triggerEvents(element);
                    return true;
                }
            }

            return false;
        } catch (e) {
            console.error('[SimplificaAI] Erro:', e);
            return false;
        }
    }

    function triggerEvents(element) {
        ['input', 'change', 'keyup'].forEach(type => {
            element.dispatchEvent(new Event(type, { bubbles: true }));
        });
    }

    function replaceInGmail(editor, oldText, newText) {
        tryReplace(editor, oldText, newText);
    }

    function replaceInGeneric(editor, oldText, newText) {
        tryReplace(editor, oldText, newText);
    }

    // ==========================================
    // UTILITÁRIOS
    // ==========================================

    function handleMessages(request, sender, sendResponse) {
        if (request.action === 'updateApiKey') {
            State.apiKey = request.apiKey;
            sendResponse({ success: true });
        }
        return true;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();