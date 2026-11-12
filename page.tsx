"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

type User = { id: number; username: string };
type Message = { id: string; body: string; senderId: number; username: string; createdAt: string };
type Mode = "login" | "register" | "reset";
type Preferences = { notificationsEnabled: boolean; browserNotificationsEnabled: boolean };

async function api(path: string, options?: RequestInit) {
  const response = await fetch(path, { ...options, headers: { "Content-Type": "application/json", ...options?.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recovery, setRecovery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState<Preferences>({ notificationsEnabled: true, browserNotificationsEnabled: false });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"profile" | "notifications">("profile");
  const [profileName, setProfileName] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [toast, setToast] = useState<Message | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const lastMessageId = useRef<string | null>(null);
  const messagesInitialized = useRef(false);

  useEffect(() => {
    api("/api/auth/me").then((data) => setUser(data.user)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    lastMessageId.current = null;
    messagesInitialized.current = false;
    if (!user) return;
    setProfileName(user.username);
    api("/api/settings").then((data) => setPrefs(data.settings)).catch(() => {});
  }, [user]);

  const loadMessages = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api("/api/messages");
      const nextMessages: Message[] = data.messages;
      const latestId = nextMessages.at(-1)?.id ?? null;
      if (!messagesInitialized.current) {
        messagesInitialized.current = true;
        lastMessageId.current = latestId;
      } else {
        const fresh = lastMessageId.current
          ? nextMessages.filter((message) => BigInt(message.id) > BigInt(lastMessageId.current!))
          : nextMessages;
        if (latestId && (!lastMessageId.current || BigInt(latestId) > BigInt(lastMessageId.current))) lastMessageId.current = latestId;
        const incoming = fresh.filter((message) => message.senderId !== user.id);
        if (incoming.length && prefs.notificationsEnabled) {
          const newest = incoming[incoming.length - 1];
          setToast(newest);
          window.setTimeout(() => setToast((current) => current?.id === newest.id ? null : current), 5000);
          if (prefs.browserNotificationsEnabled && "Notification" in window && Notification.permission === "granted") {
            incoming.forEach((message) => new Notification(`${message.username} sent a message`, { body: message.body, tag: `duo-${message.id}` }));
          }
        }
      }
      setMessages(nextMessages);
    } catch { /* a later poll can recover */ }
  }, [user, prefs]);

  useEffect(() => {
    if (!user) return;
    loadMessages();
    const timer = window.setInterval(loadMessages, 2500);
    return () => window.clearInterval(timer);
  }, [user, loadMessages]);

  useEffect(() => {
    if (nearBottom.current) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    try {
      const endpoint = mode === "register" ? "/api/auth/register" : mode === "reset" ? "/api/auth/reset" : "/api/auth/login";
      const data = await api(endpoint, { method: "POST", body: JSON.stringify(payload) });
      if (mode === "reset") {
        setRecovery(data.recoveryCode);
        setMode("login");
        event.currentTarget.reset();
      } else {
        setUser(data.user);
        if (data.recoveryCode) setRecovery(data.recoveryCode);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Please try again."); }
    finally { setBusy(false); }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true); setError("");
    try { await api("/api/messages", { method: "POST", body: JSON.stringify({ body }) }); setText(""); await loadMessages(); }
    catch (e) { setError(e instanceof Error ? e.message : "Message failed."); }
    finally { setBusy(false); }
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    setUser(null); setMessages([]); setRecovery("");
  }

  function copyRecovery() {
    navigator.clipboard?.writeText(recovery);
  }

  async function savePreferences(next: Preferences) {
    setSettingsError(""); setSettingsMessage("");
    try {
      const data = await api("/api/settings", { method: "PUT", body: JSON.stringify(next) });
      setPrefs(data.settings); setSettingsMessage("Your notification settings are saved.");
    } catch (e) { setSettingsError(e instanceof Error ? e.message : "Could not save settings."); }
  }

  async function toggleBrowserNotifications() {
    const enabled = !prefs.browserNotificationsEnabled;
    if (enabled) {
      if (!("Notification" in window)) { setSettingsError("This browser does not support desktop notifications."); return; }
      let permission = Notification.permission;
      if (permission === "default") permission = await Notification.requestPermission();
      if (permission !== "granted") { setSettingsError("Allow notifications in your browser to turn this on."); return; }
    }
    await savePreferences({ ...prefs, browserNotificationsEnabled: enabled });
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSettingsError(""); setSettingsMessage("");
    try {
      const data = await api("/api/profile", { method: "PATCH", body: JSON.stringify({ username: profileName }) });
      setUser(data.user); setProfileName(data.user.username); setSettingsMessage("Username updated.");
    } catch (e) { setSettingsError(e instanceof Error ? e.message : "Could not update username."); }
  }

  if (loading) return <main className="loading"><span className="orb"/> CONNECTING TO LOBBY...</main>;

  return <main className="shell">
    <div className="ambient ambient-a"/><div className="ambient ambient-b"/>
    <header className="topbar">
      <a className="brand" href="#"><span className="brand-mark">✦</span><span>DUO<span className="brand-dim">LOBBY</span></span></a>
      <div className="status"><i/> PRIVATE SERVER <span className="status-sep">/</span> 2 PLAYER MAX</div>
      {user ? <div className="user-actions"><button className="profile-button" onClick={() => {setSettingsOpen(true);setSettingsTab("profile");setProfileName(user.username);setSettingsError("");setSettingsMessage("");}}><span className="chip-avatar">{user.username.slice(0,1).toUpperCase()}</span><span>PROFILE &amp; SETTINGS</span></button><button className="logout" onClick={logout}>LOG OUT <span>↗</span></button></div> : <div className="top-tag">PLAYER ONE + PLAYER TWO</div>}
    </header>

    {!user ? <section className="welcome-layout">
      <div className="hero-copy">
        <div className="eyebrow"><span className="eyebrow-line"/> YOUR CORNER OF THE INTERNET</div>
        <h1>Two players.<br/><span>One little</span><br/>universe<span className="accent">.</span></h1>
        <p className="hero-intro">A private place for your favorite teammate. No email, no noise—just you two, checking in and keeping the conversation going.</p>
        <div className="feature-row"><span>◈ PRIVATE CHAT</span><span>◉ NO EMAIL NEEDED</span><span>⌁ JUST TWO OF YOU</span></div>
        <div className="pixel-art" aria-hidden="true"><div className="pixel-sun"/><div className="pixel-stars">✦　·　✧　　·　✦</div><div className="pixel-mountain m1"/><div className="pixel-mountain m2"/><div className="pixel-ground"/><div className="pixel-figure">◢</div><div className="pixel-caption">A SMALL WORLD, JUST YOURS</div></div>
      </div>
      <div className="auth-card">
        <div className="card-topline"><span>LOBBY ACCESS</span><span className="card-code">NO. 02</span></div>
        <div className="card-icon">{mode === "reset" ? "⌑" : mode === "register" ? "✧" : "⌁"}</div>
        <h2>{mode === "register" ? "Create your player" : mode === "reset" ? "Recover access" : "Welcome back"}</h2>
        <p className="card-sub">{mode === "register" ? "Claim your username and join the lobby." : mode === "reset" ? "Use the recovery code you saved at signup." : "Your friend’s probably already waiting."}</p>
        <div className="mode-tabs"><button className={mode !== "register" ? "active" : ""} onClick={() => {setMode("login");setError("");}}>SIGN IN</button><button className={mode === "register" ? "active" : ""} onClick={() => {setMode("register");setError("");}}>NEW PLAYER</button></div>
        <form onSubmit={handleAuth} className="auth-form">
          <label>USERNAME<input name="username" placeholder="e.g. starlight_7" autoComplete="username" minLength={3} maxLength={20} required/></label>
          {mode === "reset" && <label>RECOVERY CODE<input name="recoveryCode" placeholder="Your saved 24-character code" autoComplete="off" required/></label>}
          <label>{mode === "reset" ? "NEW PASSWORD" : "PASSWORD"}<input name={mode === "reset" ? "newPassword" : "password"} type="password" placeholder={mode === "reset" ? "At least 10 characters" : "••••••••••"} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={10} maxLength={72} required/></label>
          {mode === "register" && process.env.NEXT_PUBLIC_JOIN_CODE_ENABLED === "true" && <label>INVITE CODE<input name="inviteCode" placeholder="Ask your friend" required/></label>}
          {error && <div className="error-box">{error}</div>}
          <button className="primary-button" disabled={busy}>{busy ? "PLEASE WAIT..." : mode === "register" ? "CREATE ACCOUNT  →" : mode === "reset" ? "RESET PASSWORD  →" : "ENTER THE LOBBY  →"}</button>
        </form>
        {mode === "login" && <button className="text-button" onClick={() => {setMode("reset");setError("");}}>Forgot password? <span>Use your recovery code</span></button>}
        {mode === "reset" && <button className="text-button" onClick={() => {setMode("login");setError("");}}>← Back to sign in</button>}
        <div className="card-footer"><span className="mini-shield">◇</span> Passwords are encrypted. Your recovery code is yours to keep.</div>
      </div>
    </section> : <section className="chat-layout">
      <aside className="room-panel"><div className="room-label">YOUR SPACE</div><div className="room-avatar">✦</div><h2>little-universe</h2><p>A private corner for two.</p><div className="room-rule"/><div className="online-line"><i/> YOU’RE IN THE LOBBY</div><div className="room-bottom"><span>✧</span> KEEP IT KIND. KEEP IT YOURS.</div></aside>
      <div className="chat-panel">
        <div className="chat-head"><div><div className="room-label">LIVE ROOM <span className="live-dot"/></div><h2>Lobby chat</h2></div><div className="head-right"><span className="head-count">02 <small>PLAYER SLOTS</small></span><div className="user-chip"><span className="chip-avatar">{user.username.slice(0,1).toUpperCase()}</span>{user.username}</div></div></div>
        <div className="chat-messages" onScroll={(e) => {const el=e.currentTarget;nearBottom.current=el.scrollHeight-el.scrollTop-el.clientHeight<100;}}>
          {messages.length === 0 ? <div className="empty-state"><div className="empty-icon">✧</div><h3>Quiet in here… for now.</h3><p>Drop the first message and start your little universe.</p></div> : messages.map((m) => <article key={m.id} className={`message ${m.senderId === user.id ? "mine" : "theirs"}`}><div className="message-meta"><span className="message-avatar">{m.username.slice(0,1).toUpperCase()}</span><b>{m.senderId === user.id ? "YOU" : m.username.toUpperCase()}</b><time>{new Date(m.createdAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</time></div><div className="bubble">{m.body}</div></article>)}
          <div ref={bottomRef}/>
        </div>
        <form className="composer" onSubmit={sendMessage}><div className="composer-inner"><span className="composer-star">✧</span><input value={text} onChange={(e)=>setText(e.target.value)} placeholder="Say something nice..." maxLength={1000} aria-label="Message"/><span className="char-count">{text.length}/1000</span><button disabled={!text.trim()||busy} aria-label="Send message">➤</button></div><div className="composer-hint">ENTER TO SEND <span>•</span> YOUR MESSAGES STAY BETWEEN YOU TWO</div></form>
      </div>
    </section>}
    {settingsOpen && user && <div className="settings-overlay" onClick={() => setSettingsOpen(false)}><section className="settings-modal" onClick={(event) => event.stopPropagation()}><header className="settings-header"><div><div className="room-label">ACCOUNT CENTER</div><h2>Profile &amp; settings</h2></div><button className="modal-close" onClick={() => setSettingsOpen(false)} aria-label="Close settings">×</button></header><div className="settings-tabs"><button className={settingsTab === "profile" ? "selected" : ""} onClick={() => {setSettingsTab("profile");setSettingsError("");setSettingsMessage("");}}>PROFILE</button><button className={settingsTab === "notifications" ? "selected" : ""} onClick={() => {setSettingsTab("notifications");setSettingsError("");setSettingsMessage("");}}>NOTIFICATIONS</button></div>{settingsTab === "profile" ? <form className="settings-content" onSubmit={saveProfile}><div className="profile-preview"><span className="profile-avatar">{user.username.slice(0,1).toUpperCase()}</span><div><strong>{user.username}</strong><small>DUO LOBBY PLAYER</small></div></div><label className="settings-label">USERNAME<input value={profileName} onChange={(event)=>setProfileName(event.target.value)} minLength={3} maxLength={20} required/><small>3–20 characters; letters, numbers, and underscores.</small></label><button className="primary-button settings-save">SAVE PROFILE</button>{settingsError && <div className="error-box">{settingsError}</div>}{settingsMessage && <div className="success-box">{settingsMessage}</div>}</form> : <div className="settings-content"><div className="setting-row"><div><strong>In-app message alerts</strong><p>Show a pop-up when your friend sends a message.</p></div><button className={`toggle-switch ${prefs.notificationsEnabled ? "on" : ""}`} role="switch" aria-checked={prefs.notificationsEnabled} onClick={()=>savePreferences({...prefs,notificationsEnabled:!prefs.notificationsEnabled})}><span/></button></div><div className="setting-row"><div><strong>Browser notifications</strong><p>Show system notifications while this site is open, even in another tab. Browser permission is required.</p></div><button className={`toggle-switch ${prefs.browserNotificationsEnabled ? "on" : ""}`} role="switch" aria-checked={prefs.browserNotificationsEnabled} disabled={!prefs.notificationsEnabled} onClick={toggleBrowserNotifications}><span/></button></div><div className="settings-note">If the browser asks, choose <b>Allow</b>. These alerts work while the site is open; push notifications after closing the site need extra service setup.</div>{settingsError && <div className="error-box">{settingsError}</div>}{settingsMessage && <div className="success-box">{settingsMessage}</div>}</div>}</section></div>}
    {toast && prefs.notificationsEnabled && user && <button className="message-toast" onClick={()=>{setToast(null);bottomRef.current?.scrollIntoView({behavior:"smooth"});}}><span className="toast-avatar">{toast.username.slice(0,1).toUpperCase()}</span><span><b>{toast.username} sent a message</b><small>{toast.body}</small></span><span className="toast-close">×</span></button>}
    {recovery && <div className="recovery-overlay"><div className="recovery-modal"><div className="eyebrow"><span className="eyebrow-line"/> IMPORTANT — SAVE THIS</div><h2>Your recovery key</h2><p>This is the only way to reset your password without email. We can’t show it again. Save it somewhere safe and private.</p><code>{recovery}</code><button className="primary-button" onClick={copyRecovery}>COPY RECOVERY KEY</button><button className="text-button" onClick={()=>setRecovery("")}>I’VE SAVED IT — CONTINUE</button></div></div>}
    <footer className="site-footer"><span>DUO LOBBY <span className="footer-dim">© 2026</span></span><span>MADE FOR TWO, NOT THE FEED <b>✦</b></span></footer>
  </main>;
}
