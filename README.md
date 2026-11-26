# Damas Evolution

Damas brasileiras no navegador (HTML/CSS/JS puro, sem dependências). Abra `index.html` ou publique a pasta em qualquer hospedagem estática.

## Estrutura
- `index.html` · `style.css` · `script.js`
- `script.js` está em camadas: regras (`legal`, `apply`) → IA (Minimax/Alpha-Beta) → armazenamento/som → partida (`G`, snapshots) → interface.
- `tests/` · `npm test` roda testes de regras/IA/Elo, de estado/animação/navegação (com DOM simulado) e uma checagem estática.

## Modos
Ranqueada contra IA (Elo local), contra o computador (4 níveis), com amigo (mesmo aparelho), relógio opcional, voltar jogada, revisão de lances e histórico.

## Limitações conhecidas
- Rating, perfil e histórico ficam no `localStorage`: não são uma conta online e podem ser editados pelo usuário.
- Ranqueada online, ranking global, Wi-Fi/WebRTC, Bluetooth e PWA **não estão implementados** (a interface marca "EM BREVE").
- A aparência das animações e o layout em celulares ainda precisam ser conferidos em navegadores reais.
