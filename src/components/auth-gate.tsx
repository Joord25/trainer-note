"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { browserLocalPersistence, GoogleAuthProvider, onAuthStateChanged, setPersistence, signInWithPopup, signOut, type User } from "firebase/auth";
import { getClientAuth } from "../lib/firebase-client";
import { authErrorMessage } from "../lib/auth-errors";

const AuthContext = createContext<User | null>(null);
export function useTrainer() {
  const user = useContext(AuthContext);
  if (!user) throw new Error("Authenticated workspace required");
  return user;
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const pending = useRef(false);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    setLoading(true);
    setReady(false);
    setError("");
    async function connect() {
      try {
        const auth = getClientAuth();
        await setPersistence(auth, browserLocalPersistence);
        if (!active) return;
        unsubscribe = onAuthStateChanged(auth, nextUser => {
          if (!active) return;
          setUser(nextUser);
          setReady(true);
          setLoading(false);
        }, error => {
          if (!active) return;
          setUser(null);
          setReady(false);
          setError(authErrorMessage(error));
          setLoading(false);
        });
      } catch (error) {
        if (active) {
          setError(authErrorMessage(error));
          setLoading(false);
        }
      }
    }
    void connect();
    return () => { active = false; unsubscribe?.(); };
  }, [attempt]);

  async function login() {
    if (pending.current || !ready) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      // Invoke from the click itself; persistence has already been configured.
      await signInWithPopup(getClientAuth(), provider);
    } catch (error) {
      setError(authErrorMessage(error));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  if (loading) return <main className="auth-loading" aria-busy="true"><span className="auth-spinner" aria-hidden="true"/><p role="status">로그인 상태를 확인하고 있어요.</p></main>;
  // A UID change remounts the workspace, clearing the previous user's local state.
  if (user) return <AuthContext.Provider key={user.uid} value={user}>{children}</AuthContext.Provider>;

  return <main className="auth-page">
    <div className="auth-brand">trainer<span>note</span><i/></div>
    <div className="auth-layout">
      <section className="auth-story" aria-labelledby="auth-heading">
        <span className="auth-eyebrow">트레이너의 다음 수업을 위해</span>
        <h1 id="auth-heading">기록이 쌓일수록,<br/>수업의 근거는<br/><em>더 선명하게.</em></h1>
        <p>흩어진 운동 기록을 한곳에서 확인하고,<br/>회원의 변화와 다음 수업을 준비하세요.</p>
        <div className="auth-flow" aria-label="기록 확인, 진행 분석, 수업 준비">
          <span><b>01</b> 기록 확인</span><i aria-hidden="true">→</i><span><b>02</b> 진행 분석</span><i aria-hidden="true">→</i><span><b>03</b> 수업 준비</span>
        </div>
      </section>
      <section className="auth-card" aria-labelledby="login-heading">
        <div className="auth-mark" aria-hidden="true">tn<span>·</span></div>
        <h2 id="login-heading">내 워크스페이스 시작하기</h2>
        <p>Google 계정으로 간편하게 시작하세요.<br/>처음이라면 로그인과 함께 계정이 만들어져요.</p>
        {error && <div className="auth-error" role="alert">{error}</div>}
        {ready ? <button className="auth-google" onClick={() => void login()} disabled={busy}>
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-1.99 3.02v2.51h3.22c1.88-1.73 2.99-4.28 2.99-7.36Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.61-2.41l-3.22-2.51c-.9.6-2.05.96-3.39.96-2.6 0-4.81-1.76-5.6-4.12H3.07v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 13.92a6 6 0 0 1 0-3.84V7.49H3.07a10 10 0 0 0 0 9.02l3.33-2.59Z"/><path fill="#EA4335" d="M12 5.96c1.47 0 2.79.51 3.83 1.51l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.33 2.59C7.19 7.72 9.4 5.96 12 5.96Z"/></svg>
          {busy ? "Google 로그인 진행 중…" : "Google로 계속하기"}
        </button> : <button className="auth-google" onClick={() => setAttempt(value => value + 1)}>연결 다시 시도</button>}
        <p className="auth-session-note">개인 기기에서 로그인 상태가 유지돼요.<br/>공용 기기에서는 사용 후 로그아웃해주세요.</p>
        <div className="auth-preview-note"><span>현재 제공 기능</span>로그인 후 예시 기록으로 작업 화면을 둘러볼 수 있어요. 실제 기록 저장과 AI 분석은 준비 중이에요.</div>
      </section>
    </div>
    <footer className="auth-footer">기록 확인에서 다음 수업 준비까지, 트레이너 노트.</footer>
  </main>;
}

export function AccountControl() {
  const user = useTrainer();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const name = user.displayName || user.email?.split("@")[0] || "트레이너";
  async function logout() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try { await signOut(getClientAuth()); }
    catch { setError("로그아웃하지 못했어요. 다시 시도해주세요."); }
    finally { pending.current = false; setBusy(false); }
  }
  return <section className="trainer-account" aria-label="내 계정">
    <div className="workspace-profile" title={user.email || name}>
      <span className="avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
      <div className="account-copy"><strong>{name}</strong><small>{user.email || "Google 계정"}</small></div>
    </div>
    <button className="account-signout" onClick={() => void logout()} disabled={busy} aria-label={busy ? "로그아웃 중" : "로그아웃"} title="로그아웃">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5H5v14h4M13 8l4 4-4 4M9 12h12"/></svg><span>{busy ? "로그아웃 중…" : "로그아웃"}</span>
    </button>
    {error && <p className="account-error" role="alert">{error}</p>}
  </section>;
}
