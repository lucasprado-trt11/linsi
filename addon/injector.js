// injector.js - Roda no Mundo Principal (Main World)
// Este ID pertence a uma extensão antiga permitida pelo Google.
// Ao defini-lo, o Docs expõe a camada de texto no DOM.

try {
    Object.defineProperty(window, '_docs_annotate_canvas_by_ext', {
        value: 'npnbdojkgkbcdfdjlfdmplppdphlhhcf', // ID Mágico (Spoofing)
        writable: false,
        configurable: false
    });

    // Variável secundária para garantir (usada em algumas versões do Docs)
    Object.defineProperty(window, '_docs_force_html_by_ext', {
        value: 'npnbdojkgkbcdfdjlfdmplppdphlhhcf',
        writable: false,
        configurable: false
    });

    console.log("[SimplificaAI] Hack de Whitelist INJETADO com sucesso via Main World.");
} catch (e) {
    console.error("[SimplificaAI] Falha ao injetar hack:", e);
}