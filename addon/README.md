# SimplificaAI - Extensão Chrome

Extensão para Chrome que transforma textos complexos em linguagem simples usando IA (Gemini 2.5 Flash Lite via OpenRouter).

## Funcionalidades

✅ **Análise em tempo real** de textos em editores web  
✅ **Compatibilidade** com Gmail, Google Docs, PJe, CKEditor e editores genéricos  
✅ **Realce visual** de frases complexas (vermelho = muito complexo, amarelo = moderado)  
✅ **Sugestões de IA** via menu de contexto (clique direito)  
✅ **Índice Flesch-Kincaid** adaptado para português  
✅ **Substituição direta** no editor de origem  

## Instalação

### Método 1: Modo Desenvolvedor (Recomendado para testes)

1. Abra o Chrome e vá para `chrome://extensions/`
2. Ative o **Modo do desenvolvedor** (canto superior direito)
3. Clique em **Carregar sem compactação**
4. Selecione a pasta `simplifica-ai-extension`
5. A extensão aparecerá na barra de ferramentas

### Método 2: Empacotado (Para distribuição)

1. Vá para `chrome://extensions/`
2. Clique em **Empacotar extensão**
3. Selecione a pasta do projeto
4. Serão gerados arquivos `.crx` e `.pem`

## Configuração

1. Clique no ícone da extensão na barra do Chrome
2. Insira sua API Key da OpenRouter (começa com `sk-or-`)
3. Clique em **Salvar Configuração**

### Como obter API Key gratuita:

1. Acesse [openrouter.ai](https://openrouter.ai)
2. Crie uma conta (pode usar GitHub ou Google)
3. Vá em "Keys" no menu lateral
4. Clique em "Create Key"
5. Copie a chave gerada

> **Nota:** A OpenRouter oferece créditos gratuitos para testes. O modelo `google/gemini-2.5-flash-lite` é econômico e rápido.

## Uso

1. **Abra qualquer editor de texto web** (Gmail, Google Docs, etc.)
2. **Digite ou cole** seu texto
3. **Aguarde 1-2 segundos** para a análise automática
4. **Observe as linhas coloridas** abaixo das frases complexas:
   - 🔴 **Vermelho**: Texto muito complexo (Flesch < 50)
   - 🟡 **Amarelo**: Texto moderado (Flesch 50-70)
5. **Clique com botão direito** sobre a linha colorida
6. **Selecione uma sugestão** da IA
7. **Clique em "Aplicar"** para substituir o texto

## Estrutura do Projeto

```
simplifica-ai-extension/
├── manifest.json      # Configuração da extensão
├── background.js      # Service worker
├── content.js         # Script principal (injetado nas páginas)
├── utils.js           # Funções utilitárias (Flesch, API)
├── injector.js        # Hack de whitelist para Google Docs
├── styles.css         # Estilos da UI
├── popup.html         # Interface de configuração
├── popup.js           # Lógica do popup
└── icon.svg           # Ícone (converter para PNG)
```

## Tecnologias

- **Manifest V3**: Padrão moderno de extensões Chrome
- **Intl.Segmenter**: Segmentação de sentenças em português
- **Flesch-Kincaid**: Algoritmo adaptado para PT-BR
- **OpenRouter API**: Gateway para modelos de IA (Gemini)
- **Google Docs Hack**: `_docs_annotate_canvas_by_ext` para acesso ao DOM

## Compatibilidade

| Plataforma | Status | Notas |
|------------|--------|-------|
| Google Docs | ✅ Funcional | Requer hack de whitelist |
| Gmail | ✅ Funcional | Detecta compose automaticamente |
| CKEditor 4/5 | ✅ Funcional | Suporte nativo |
| PJe | ✅ Funcional | Via detecção genérica |
| Textareas | ✅ Funcional | Suporte básico |
| ContentEditable | ✅ Funcional | Detecta automaticamente |

## Solução de Problemas

### "API Key não configurada"
- Clique no ícone da extensão e insira sua chave OpenRouter

### Google Docs não mostra realces
- Recarregue a página (F5)
- Verifique se o console mostra "Hack de whitelist injetado"
- Algumas contas Google corporativas podem bloquear extensões

### Sugestões não aparecem
- Verifique sua conexão com internet
- Confirme se a API Key é válida em openrouter.ai
- Verifique o console (F12) por erros de CORS

### Texto não é substituído
- Clique no editor antes de aplicar a sugestão
- Alguns editores rich text podem requerer atualização manual

## Privacidade e Segurança

- 🔒 **API Key** armazenada apenas no `chrome.storage.sync` (criptografado pelo Chrome)
- 📝 **Textos** são enviados apenas para a OpenRouter quando você solicita sugestões
- 🚫 **Nenhum dado** é coletado ou armazenado em servidores próprios
- 🔍 **Código aberto**: Você pode auditar todo o código-fonte

## Limitações Conhecidas

1. **Google Docs Canvas**: O hack de whitelist pode parar de funcionar se o Google atualizar
2. **CKEditor em iframes**: Pode haver restrições de cross-origin
3. **Performance**: Análise de textos muito longos (>5000 palavras) pode causar lag
4. **Mobile**: Não testado extensivamente em dispositivos móveis

## Contribuição

Contribuições são bem-vindas! Áreas de melhoria:

- [ ] Suporte a mais editores (TinyMCE, Quill, etc.)
- [ ] Cache de sugestões para economizar tokens
- [ ] Configurações de sensibilidade do Flesch
- [ ] Modo "escrita assistida" (sugestões em tempo real)
- [ ] Tradução para outros idiomas

## Licença

MIT License - Livre para uso pessoal e comercial.

## Contato

Para suporte ou sugestões, abra uma issue no repositório.

---

**Desenvolvido com ❤️ para tornar a comunicação mais acessível.**