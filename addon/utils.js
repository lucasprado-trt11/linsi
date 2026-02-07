const Utils = {
    calculateComplexity: (text) => {
        if (!text) return null;
        text = text.trim();
        if (text.length < 5) return null;

        // Simulação rápida de Flesch
        const words = text.split(/\s+/).length;
        if (words < 4) return null;
        const syllables = text.length / 2.5;
        const score = 206.835 - (1.015 * words) - (84.6 * (syllables / words));

        if (score < 40) return 'hard';
        if (score < 60) return 'medium';
        return null;
    }
};