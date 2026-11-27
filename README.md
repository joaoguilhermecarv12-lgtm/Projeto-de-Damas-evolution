# Damas Evolution

Damas brasileiras no navegador (HTML/CSS/JS puro, sem dependências). Abra `index.html` ou publique a pasta em qualquer hospedagem estática.

## Estrutura
- `index.html` · `style.css` · `script.js`
- `script.js` está em camadas: regras (`legal`, `apply`) → IA (Minimax/Alpha-Beta) → armazenamento/som → partida (`G`, snapshots) → interface.
- `tests/` · `npm test` roda testes de regras/IA/Elo, de estado/animação/navegação (com DOM simulado) e uma checagem estática.

## Modos
Ranqueada contra IA (Elo local), contra o computador (4 níveis), com amigo (mesmo aparelho), relógio opcional, voltar jogada, revisão de lances e histórico.

## Online (Supabase)
1. No SQL Editor rode, em ordem, `supabase/001_auth_profiles.sql` e `supabase/002_matches_elo.sql`.
2. Authentication → URL Configuration: coloque o domínio da Vercel em *Site URL* e em *Redirect URLs*. Para testar rápido, desligue "Confirm email".
3. `supabase.js` usa só a chave *publishable* (pública). Nunca use `service_role`/`sb_secret_` no navegador.
4. Teste com dois aparelhos (ou duas janelas anônimas) em contas diferentes: **Partida ranqueada → Ranqueada online** nos dois. A fila pareia por Elo (janela começa em ±100 e cresce 15 pts/s).
- Lances: Broadcast (rápido) + gravação em `matches.board_state` via RPC (fonte da verdade, usada para reconectar).
- Elo: calculado no servidor (`report_result`). O resultado só vale com os dois de acordo, ou desistência, ou 60 s sem sinal do adversário; partidas com menos de 6 lances ou o 6º jogo do mesmo par em 24 h não pontuam.
- O servidor confere vez, ordem e formato dos lances, **não a legalidade das damas** (as regras estão no JS). Para blindar isso seria preciso portar as regras para uma Edge Function.

## Limitações conhecidas
- Rating, perfil e histórico ficam no `localStorage`: não são uma conta online e podem ser editados pelo usuário.
- Wi-Fi/WebRTC, Bluetooth, temporadas e PWA **não estão implementados**. Partidas online não têm relógio.
- A aparência das animações e o layout em celulares ainda precisam ser conferidos em navegadores reais.
