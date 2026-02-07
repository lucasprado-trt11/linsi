// content.js - Script principal da extensão SimplificaAI
// Responsável por detectar editores, analisar texto e gerenciar UI

(function() {
    'use strict';

    // Estado global
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

    // Seletores por tipo de editor
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

    function init() {
        console.log('[SimplificaAI] Inicializando...');
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

    function startEditorDetection() {
        detectEditor();
        setInterval(detectEditor, 1500);
        document.addEventListener('focusin', handleFocusIn, true);
        document.addEventListener('click', handleClick, true);
    }

    function detectEditor() {
        const url = window.location.href;

        if (url.includes('docs.google.com')) {
            const container = document.querySelector(EditorSelectors.gdocs.container);
            if (container && State.currentEditor !== container) {
                setupGoogleDocs(container);
            }
            return;
        }

        if (url.includes('mail.google.com')) {
            document.querySelectorAll(EditorSelectors.gmail.compose).forEach(editor => {
                if (!editor.dataset.saiAttached) setupGmail(editor);
            });
        }

        document.querySelectorAll('[contenteditable="true"], textarea').forEach(editor => {
            if (!editor.dataset.saiAttached && isVisible(editor)) {
                setupGenericEditor(editor);
            }
        });
    }

    function handleFocusIn(e) {
        if (Utils.isEditableElement(e.target) && !e.target.dataset.saiAttached) {
            setupGenericEditor(e.target);
        }
    }

    function handleClick(e) {
        if (State.contextMenu && !State.contextMenu.contains(e.target)) {
            hideContextMenu();
        }
        if (e.target.closest('.sai-highlight-line')) {
            const highlight = e.target.closest('.sai-highlight-line');
            showContextMenu(e, highlight.dataset.text);
        }
    }

    function isVisible(el) {
        return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    }

    function setupGoogleDocs(container) {
        console.log('[SimplificaAI] Google Docs detectado');
        State.currentEditor = container;
        State.editorType = 'gdocs';
        window.addEventListener('scroll', debouncedAnalysis, true);
        window.addEventListener('resize', debouncedAnalysis);
        setTimeout(analyzeGoogleDocs, 1000);
    }

    function setupGmail(editor) {
        console.log('[SimplificaAI] Gmail detectado');
        editor.dataset.saiAttached = 'true';
        attachEditorListeners({
            element: editor,
            type: 'gmail',
            getText: () => editor.innerText || '',
            setText: (oldText, newText) => replaceTextInElement(editor, oldText, newText)
        });
    }

    function setupGenericEditor(editor) {
        console.log('[SimplificaAI] Editor genérico detectado');
        editor.dataset.saiAttached = 'true';
        attachEditorListeners({
            element: editor,
            type: 'generic',
            getText: () => editor.value || editor.innerText || '',
            setText: (oldText, newText) => replaceTextInElement(editor, oldText, newText)
        });
    }

    function attachEditorListeners(wrapper) {
        ['input', 'keyup', 'paste'].forEach(event => {
            wrapper.element.addEventListener(event, () => scheduleAnalysis(wrapper));
        });
        scheduleAnalysis(wrapper);
    }

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

        Utils.segmentSentences(text).forEach(sentence => {
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

        const svgRects = document.querySelectorAll(EditorSelectors.gdocs.svgText);
        if (svgRects.length > 0) {
            svgRects.forEach(rect => {
                const text = rect.getAttribute('aria-label');
                if (!text) return;
                const analysis = Utils.calculateFleschScore(text);
                if (!analysis || analysis.level === 'easy') return;
                drawHighlight(rect.getBoundingClientRect(), analysis.level, text);
            });
            return;
        }

        document.querySelectorAll(EditorSelectors.gdocs.htmlLine).forEach(line => {
            const text = line.innerText;
            if (!text) return;
            Utils.segmentSentences(text).forEach(sentence => {
                const analysis = Utils.calculateFleschScore(sentence.trim());
                if (!analysis || analysis.level === 'easy') return;
                const range = findTextRange(line, sentence.trim());
                if (range) {
                    Array.from(range.getClientRects()).forEach(rect => {
                        drawHighlight(rect, analysis.level, sentence.trim());
                    });
                }
            });
        });
    }

    function highlightText(wrapper, text, analysis) {
        if (wrapper.element.tagName === 'TEXTAREA' || wrapper.element.tagName === 'INPUT') return;
        const range = findTextRange(wrapper.element, text);
        if (!range) return;
        Array.from(range.getClientRects()).forEach(rect => {
            drawHighlight(rect, analysis.level, text);
        });
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

    function drawHighlight(rect, type, text) {
        if (!rect || rect.width === 0 || rect.height === 0) return;
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;

        const line = document.createElement('div');
        line.className = `sai-highlight-line sai-${type}`;
        line.style.left = `${rect.left + scrollX}px`;
        line.style.top = `${rect.bottom + scrollY - 3}px`;
        line.style.width = `${rect.width}px`;
        line.dataset.text = text;
        line.dataset.id = Utils.generateId();

        line.addEventListener('click', (e) => {
            e.stopPropagation();
            showContextMenu(e, text);
        });

        line.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showContextMenu(e, text);
        });

        State.overlayLayer.appendChild(line);
        State.highlights.set(line.dataset.id, { element: line, text });
    }

    function clearHighlights() {
        if (State.overlayLayer) State.overlayLayer.innerHTML = '';
        State.highlights.clear();
    }

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
            content.innerHTML = '<div class="sai-error"><p>API Key não configurada</p><p>Clique no ícone da extensão</p></div>';
            return;
        }

        content.innerHTML = '<div class="sai-loading">Consultando IA...</div>';

        fetchSuggestions(text).then(suggestions => {
            renderSuggestions(content, suggestions, text);
        }).catch(error => {
            content.innerHTML = `<div class="sai-error"><p>Erro: ${error.message}</p></div>`;
        });
    }

    function hideContextMenu() {
        if (State.contextMenu) State.contextMenu.classList.remove('visible');
    }

    async function fetchSuggestions(text) {
        const response = await Utils.callOpenRouter(State.apiKey, text);
        return Utils.parseSuggestions(response);
    }

    function renderSuggestions(container, suggestions, originalText) {
        if (!suggestions || suggestions.length === 0) {
            container.innerHTML = '<div class="sai-empty">Nenhuma sugestão</div>';
            return;
        }

        let html = '<div class="sai-suggestions-list">';
        suggestions.forEach((suggestion, index) => {
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

    function applySuggestion(oldText, newText) {
        const activeElement = document.activeElement;
        if (Utils.isEditableElement(activeElement)) {
            replaceTextInElement(activeElement, oldText, newText);
        } else {
            State.highlights.forEach((data) => {
                if (data.text === oldText) {
                    const editor = findParentEditor(data.element);
                    if (editor) replaceTextInElement(editor, oldText, newText);
                }
            });
        }
        setTimeout(() => {
            if (State.editorType === 'gdocs') analyzeGoogleDocs();
            else detectEditor();
        }, 500);
    }

    function findParentEditor(element) {
        let parent = element.parentElement;
        while (parent) {
            if (Utils.isEditableElement(parent)) return parent;
            parent = parent.parentElement;
        }
        return null;
    }

    function replaceTextInElement(element, oldText, newText) {
        if (!element || !oldText || !newText) return;
        try {
            if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
                const start = element.value.indexOf(oldText);
                if (start !== -1) {
                    element.value = element.value.substring(0, start) + newText + 
                                   element.value.substring(start + oldText.length);
                    element.dispatchEvent(new Event('input', { bubbles: true }));
                    element.dispatchEvent(new Event('change', { bubbles: true }));
                }
            } else {
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
                        element.dispatchEvent(new Event('input', { bubbles: true }));
                        break;
                    }
                }
            }
        } catch (e) {
            console.error('[SimplificaAI] Erro ao substituir:', e);
        }
    }

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