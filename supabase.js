/* Camada de acesso ao Supabase (autenticação e perfil).
   A chave publishable é pública por projeto: a segurança vem das policies RLS (supabase/001_auth_profiles.sql).
   NUNCA coloque a chave service_role aqui. Exposto como o global `Net`. */
const Net = (() => {
  const URL = "https://ruayqbbenlmjjbnafnay.supabase.co";
  const KEY = "sb_publishable_N-XJz0PMCEJKYnEiGw0NKw_ZvuTNF5W";
  const NAME = /^[\p{L}\p{N}_-]{3,16}$/u;
  let sb = null, user = null, profile = null;
  const subs = new Set();
  const emit = () => subs.forEach(f => { try { f(); } catch (e) { console.error(e); } });
  const MSG = [
    [/invalid login/i, "E-mail ou senha incorretos."],
    [/already registered|already been registered/i, "Este e-mail já está cadastrado."],
    [/at least \d+ char/i, "A senha precisa ter pelo menos 6 caracteres."],
    [/valid email|invalid format|unable to validate email/i, "E-mail inválido."],
    [/email not confirmed/i, "Confirme seu e-mail antes de entrar."],
    [/saving new user|duplicate|23505|unique/i, "Nome de usuário ou e-mail já em uso."],
    [/rate limit|too many/i, "Muitas tentativas. Aguarde um pouco."],
    [/fetch|network/i, "Sem conexão com o servidor."],
  ];
  const tr = e => { const t = String((e && e.message) || e || ""); const m = MSG.find(([r]) => r.test(t)); return m ? m[1] : "Erro inesperado: " + t; };
  const fail = error => ({ ok: false, error });

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
  async function signUp({ email, password, username }) {
    if (!sb) return fail("Serviço online indisponível.");
    if (!NAME.test(username || "")) return fail("Nome de usuário: 3 a 16 letras, números, _ ou -.");
    if (!email || !password) return fail("Informe e-mail e senha.");
    const av = await sb.rpc("username_available", { u: username });
    if (!av.error && av.data === false) return fail("Nome de usuário já em uso.");
    const { data, error } = await sb.auth.signUp({ email, password, options: { data: { username } } });
    if (error) return fail(tr(error));
    if (data.user && data.user.identities && data.user.identities.length === 0) return fail("Este e-mail já está cadastrado.");
    return { ok: true, needsConfirm: !data.session };
  }
  async function signIn({ email, password }) {
    if (!sb) return fail("Serviço online indisponível.");
    const { error } = await sb.auth.signInWithPassword({ email, password });
    return error ? fail(tr(error)) : { ok: true };
  }
  async function signOut() { if (sb) await sb.auth.signOut(); }
  return {
    init, signUp, signIn, signOut, tr,
    ready: () => !!sb, user: () => user, profile: () => profile, client: () => sb,
    onChange: f => { subs.add(f); return () => subs.delete(f); },
  };
})();
