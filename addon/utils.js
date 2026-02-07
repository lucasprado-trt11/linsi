// utils.js - Funções utilitárias da extensão SimplificaAI

const Utils = {
    // Configurações
    CONFIG: {
        minTextLength: 5,
        minWords: 3,
        debounceTime: 1200,
        apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
        modelId: 'google/gemini-2.5-flash-lite'
    },

    /**
     * Conta sílabas em português de forma mais precisa
     * Usa regras básicas de separação silábica
     */
    countSyllablesPortuguese: function(word) {
        if (!word || word.length === 0) return 0;

        word = word.toLowerCase().trim();

        // Palavras muito curtas
        if (word.length <= 2) return 1;

        // Vogais acentuadas e clusters vocálicos
        const vowels = /[aeiouáàãâéêíóõôúü]/gi;
        const matches = word.match(vowels);

        if (!matches) return 1;

        let count = matches.length;

        // Ajusta para ditongos e tritongos (contam como 1 sílaba)
        const diphthongs = /[aeiou][aeiou]/gi;
        const diphMatches = word.match(diphthongs);
        if (diphMatches) {
            count -= diphMatches.length;
        }

        // Palavras terminadas em 's' plural podem ter sílaba extra
        if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) {
            // Verifica se é plural (terminação com vogal + s)
            const beforeS = word[word.length - 2];
            if (/[aeiou]/.test(beforeS)) {
                // Já está contado na vogal
            }
        }

        return Math.max(1, count);
    },

    /**
     * Calcula o Índice Flesch-Kincaid adaptado para português
     * Fórmula original: 206.835 - (1.015 × ASL) - (84.6 × ASW)
     * Adaptação para PT: ajustes nos coeficientes
     */
    calculateFleschScore: function(text) {
        if (!text) return null;

        text = text.trim();
        if (text.length < this.CONFIG.minTextLength) return null;

        // Limpa o texto
        const cleanText = text.replace(/[^\w\sÀ-ÿ]/g, " ");
        const words = cleanText.split(/\s+/).filter(w => w.length > 0);

        if (words.length < this.CONFIG.minWords) return null;

        // Conta sentenças (usando pontuação ou quebras de linha)
        const sentenceDelimiters = /[.!?]+/;
        const sentences = text.split(sentenceDelimiters).filter(s => s.trim().length > 0);
        const sentenceCount = Math.max(1, sentences.length);

        // Conta sílabas totais
        let totalSyllables = 0;
        words.forEach(word => {
            totalSyllables += this.countSyllablesPortuguese(word);
        });

        // Calcula médias
        const ASL = words.length / sentenceCount; // Average Sentence Length
        const ASW = totalSyllables / words.length; // Average Syllables per Word

        // Fórmula Flesch-Kincaid adaptada para português
        // Coeficientes ajustados empiricamente para a língua portuguesa
        let score = 248.835 - (1.015 * ASL) - (84.6 * ASW);

        // Normaliza entre 0 e 100
        score = Math.min(100, Math.max(0, score));

        return {
            score: score,
            level: this.getComplexityLevel(score),
            words: words.length,
            sentences: sentenceCount,
            syllables: totalSyllables,
            asl: ASL,
            asw: ASW
        };
    },

    /**
     * Retorna o nível de complexidade baseado no score
     */
    getComplexityLevel: function(score) {
        if (score < 30) return { level: 'hard', label: 'Muito Complexo', color: '#EF4444' };
        if (score < 50) return { level: 'hard', label: 'Complexo', color: '#EF4444' };
        if (score < 60) return { level: 'medium', label: 'Moderado', color: '#F59E0B' };
        if (score < 70) return { level: 'medium', label: 'Relativamente Simples', color: '#F59E0B' };
        return { level: 'easy', label: 'Muito Simples', color: '#10B981' };
    },

    /**
     * Segmenta texto em sentenças usando Intl.Segmenter (moderno) ou fallback
     */
    segmentSentences: function(text) {
        if (!text) return [];

        // Tenta usar Intl.Segmenter (API moderna)
        if (typeof Intl !== 'undefined' && Intl.Segmenter) {
            try {
                const segmenter = new Intl.Segmenter('pt-BR', { granularity: 'sentence' });
                return Array.from(segmenter.segment(text)).map(s => s.segment);
            } catch (e) {
                // Fallback
            }
        }

        // Fallback: regex simples
        return text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
    },

    /**
     * Gera prompt para a LLM
     */
    generatePrompt: function(sentence, targetScore = 70) {
        return `TASK: Reescrever a seguinte sentença em Linguagem Simples (Plain Language), garantindo alta legibilidade no Índice Flesch-Kincaid (target: ${targetScore}+).

REGRAS:
1. Use palavras curtas e comuns do cotidiano
2. Prefira frases diretas e objetivas
3. Evite jargões técnicos ou termos rebuscados
4. Use voz ativa quando possível
5. Mantenha o significado original
6. Público-alvo: Ensino Fundamental completo
7. O resultado DEVE ter score Flesch superior a ${targetScore}

INPUT: "${sentence}"

OUTPUT FORMAT: JSON Array com exatamente 3 alternativas diferentes. Cada alternativa deve ser uma string completa.
Exemplo: ["Alternativa 1 simples", "Alternativa 2 direta", "Alternativa 3 objetiva"]

RESPONDA APENAS COM O JSON, sem explicações adicionais.`;
    },

    /**
     * Faz chamada à API da OpenRouter
     */
    async callOpenRouter(apiKey, sentence) {
        const prompt = this.generatePrompt(sentence);

        try {
            const response = await fetch(this.CONFIG.apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': typeof window !== 'undefined' ? window.location.href : 'https://simplifica.ai'
                },
                body: JSON.stringify({
                    model: this.CONFIG.modelId,
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.3,
                    max_tokens: 500
                })
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`API Error: ${response.status} - ${error}`);
            }

            const data = await response.json();
            return data.choices[0].message.content;
        } catch (error) {
            console.error('[SimplificaAI] Erro na API:', error);
            throw error;
        }
    },

    /**
     * Parseia resposta da LLM
     */
    parseSuggestions: function(content) {
        if (!content) return [];

        // Limpa markdown
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();

        try {
            // Tenta parsear como JSON
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) {
                return parsed.slice(0, 3).map(s => String(s).trim());
            }
        } catch (e) {
            // Fallback: extrai strings entre aspas
            const matches = content.match(/"([^"]+)"/g);
            if (matches) {
                return matches.map(s => s.replace(/"/g, '').trim()).slice(0, 3);
            }

            // Último fallback: divide por linhas
            return content.split('\n')
                .map(s => s.trim())
                .filter(s => s.length > 5)
                .slice(0, 3);
        }

        return [];
    },

    /**
     * Verifica se um elemento é um editor de texto editável
     */
    isEditableElement: function(element) {
        if (!element) return false;

        // Verifica contenteditable
        if (element.isContentEditable) return true;

        // Verifica se é textarea
        if (element.tagName === 'TEXTAREA') return true;

        // Verifica se é input de texto
        if (element.tagName === 'INPUT' && 
            (element.type === 'text' || element.type === 'search')) return true;

        // Verifica atributo contenteditable
        const editable = element.getAttribute('contenteditable');
        if (editable === 'true' || editable === '') return true;

        return false;
    },

    /**
     * Debounce utility
     */
    debounce: function(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Gera ID único
     */
    generateId: function() {
        return 'sai-' + Math.random().toString(36).substr(2, 9);
    }
};