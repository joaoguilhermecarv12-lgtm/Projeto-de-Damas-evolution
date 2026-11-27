/* Camada de acesso ao Supabase (autenticação e perfil) + proteções anti-spam do cliente.
   A chave publishable é pública por projeto: a segurança real vem das policies RLS e das funções SQL
   (supabase/002_security_matches_elo.sql) e dos limites do painel. NUNCA coloque service_role/sb_secret_ aqui.
   Exposto como o global `Net`. */
const Net = (() => {
  const URL = "https://ruayqbbenlmjjbnafnay.supabase.co";
  const KEY = "sb_publishable_N-XJz0PMCEJKYnEiGw0NKw_ZvuTNF5W";
  const NAME = /^[A-Za-z0-9_-]{3,16}$/;                       // ASCII: evita nomes parecidos com letras "enganosas"
  const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
  const LK = "damasAuthLock";
  let sb = null, user = null, profile = null, fails = 0, until = 0;
  const subs = new Set();
  try { const s = JSON.parse(localStorage.getItem(LK)); if (s) { fails = s.f | 0; until = s.u | 0; } } catch (e) { /* storage indisponível */ }
  const persist = () => { try { localStorage.setItem(LK, JSON.stringify({ f: fails, u: until })); } catch (e) { /* ignora */ } };
  const wait = () => Math.max(0, until - Date.now());
  // Cooldown progressivo: 3 erros seguidos do servidor => 10 s; depois dobra (20, 40, ... até 300 s).
  const bad = () => { fails++; if (fails >= 3) until = Date.now() + Math.min(300, 10 * 2 ** (fails - 3)) * 1000; persist(); };
  const good = () => { fails = 0; until = 0; persist(); };
  const emit = () => subs.forEach(f => { try { f(); } catch (e) { console.error(e); } });
  const MSG = [
    [/invalid login/i, "E-mail ou senha incorretos."],
    [/already registered|already been registered/i, "Este e-mail já está cadastrado."],
    [/at least \d+ char|password.*(short|weak)/i, "Senha fraca ou curta demais."],
    [/valid email|invalid format|unable to validate email/i, "E-mail inválido."],
    [/email not confirmed/i, "Confirme seu e-mail antes de entrar."],
    [/saving new user|duplicate|23505|unique/i, "Nome de usuário ou e-mail já em uso."],
    [/rate limit|too many|over_.*rate/i, "Muitas tentativas. Aguarde um pouco."],
    [/captcha/i, "Verificação anti-robô necessária."],
    [/fetch|network/i, "Sem conexão com o servidor."],
  ];
  const tr = e => { const t = String((e && e.message) || e || ""); const m = MSG.find(([r]) => r.test(t)); return m ? m[1] : "Erro inesperado: " + t; };
  const fail = error => ({ ok: false, error });
  const locked = () => (wait() > 0 ? fail(`Muitas tentativas. Aguarde ${Math.ceil(wait() / 1000)}s.`) : null);

  function init() {
    if (sb) return true;
    if (typeof window === "undefined" || !window.supabase || !window.supabase.createClient) return false;
    sb = window.supabase.createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true } });
    // Não chame o Supabase de dentro do callback (risco de deadlock): adia com setTimeout.
    sb.auth.onAuthStateChange((_ev, session) => setTimeout(() => sync(session), 0));
    return true;
  }
  async function ensureProfile(u) {
    const sel = await sb.from("profiles").select("*").eq("id", u.id).maybeSingle();
    if (sel.error) throw sel.error;
    if (sel.data) return sel.data;
    const ins = await sb.from("profiles").insert({ id: u.id, username: u.user_metadata && u.user_metadata.username }).select().single();
    if (ins.error) throw ins.error;
    return ins.data;
  }
  async function sync(session) {
    user = session ? session.user : null; profile = null;
    if (user) { try { profile = await ensureProfile(user); } catch (e) { console.error("perfil:", e); } }
    emit();
  }
  async function signUp({ email, password, username, hp, captchaToken }) {
    if (hp) return { ok: true, needsConfirm: true };           // honeypot preenchido = robô: falso sucesso, nada é enviado
    const lk = locked(); if (lk) return lk;
    if (!sb) return fail("Serviço online indisponível.");
    email = String(email || "").trim(); username = String(username || "").trim(); password = String(password || "");
    if (!EMAIL.test(email)) return fail("Informe um e-mail válido.");
    if (!NAME.test(username)) return fail("Nome de usuário: 3 a 16 letras, números, _ ou -.");
    if (password.length < 8 || password.length > 72) return fail("A senha precisa ter de 8 a 72 caracteres.");
    const av = await sb.rpc("username_available", { u: username });
    if (!av.error && av.data === false) return fail("Nome de usuário já em uso.");
    const options = { data: { username } }; if (captchaToken) options.captchaToken = captchaToken;
    const { data, error } = await sb.auth.signUp({ email, password, options });
    if (error) { bad(); return fail(tr(error)); }
    if (data.user && data.user.identities && data.user.identities.length === 0) { bad(); return fail("Este e-mail já está cadastrado."); }
    good(); return { ok: true, needsConfirm: !data.session };
  }
  async function signIn({ email, password, captchaToken }) {
    const lk = locked(); if (lk) return lk;
    if (!sb) return fail("Serviço online indisponível.");
    email = String(email || "").trim(); password = String(password || "");
    if (!EMAIL.test(email)) return fail("Informe um e-mail válido.");
    if (!password) return fail("Informe a senha.");
    const cred = { email, password }; if (captchaToken) cred.options = { captchaToken };
    const { error } = await sb.auth.signInWithPassword(cred);
    if (error) { bad(); return fail(tr(error)); }
    good(); return { ok: true };
  }
  async function signOut() { if (sb) await sb.auth.signOut(); }
  return {
    init, signUp, signIn, signOut, tr, cooldown: wait,
    ready: () => !!sb, user: () => user, profile: () => profile, client: () => sb,
    onChange: f => { subs.add(f); return () => subs.delete(f); },
  };
})();
