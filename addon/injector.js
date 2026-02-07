// injector.js - Roda no Mundo Principal (Main World)
// Força o Google Docs a expor a camada de texto no DOM para anotações

(function() {
    'use strict';

    // IDs de extensões whitelistadas (oficiais do Google ou extensões populares)
    // Usamos múltiplos IDs para aumentar chance de funcionar
    const WHITELISTED_IDS = [
        'ghbmnnjooekpmoecnnnilnnbdlolhkhi', // Google Docs Offline (oficial)
        'aohghmighlieiainnegkcijnfilokake', // Google Docs (oficial)
        'npnbdojkgkbcdfdjlfdmplppdphlhhcf', // ID legado comumente usado
        'pjkljhegncpnkpknbcohdijeoejaedia', // Google Mail (oficial)
        'apdfllckaahabafndbhieahigkjlhalf'  // Google Drive (oficial)
    ];

    // Tenta definir a variável global antes do Google Docs carregar
    function injectWhitelistId() {
        try {
            // Tenta cada ID na lista
            for (const extId of WHITELISTED_IDS) {
                try {
                    // Define a variável principal
                    Object.defineProperty(window, '_docs_annotate_canvas_by_ext', {
                        value: extId,
                        writable: false,
                        configurable: false
                    });

                    // Variável secundária para compatibilidade
                    Object.defineProperty(window, '_docs_force_html_by_ext', {
                        value: extId,
                        writable: false,
                        configurable: false
                    });

                    console.log('[SimplificaAI] Hack de whitelist injetado com ID:', extId);
                    return true;
                } catch (e) {
                    continue;
                }
            }
            return false;
        } catch (e) {
            console.error('[SimplificaAI] Falha ao injetar hack:', e);
            return false;
        }
    }

    // Injeta imediatamente
    injectWhitelistId();

    // Também tenta injetar no DOMContentLoaded caso o script tenha carregado tarde
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectWhitelistId);
    }

    // E tenta periodicamente para garantir (caso o Docs limpe a variável)
    setInterval(injectWhitelistId, 1000);
})();