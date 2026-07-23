import { useState, useEffect } from "react";

const API = import.meta.env.VITE_API_BASE;

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [todos, setTodos] = useState([]);
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("demo@example.com");
  const [password, setPassword] = useState("Demo!2026");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const call = async (path, opts = {}) => {
    const res = await fetch(`${API}${path}`, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (res.status === 401) {
      logout();
      throw new Error("Session expired");
    }
    if (!res.ok) throw new Error("Request failed");
    return res.status === 204 ? null : res.json();
  };

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setTodos(await call("/todos"));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) load();
  }, [token]);

  const login = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error("Invalid credentials");
      const { token: t } = await res.json();
      localStorage.setItem("token", t);
      setToken(t);
    } catch (e) {
      setError(e.message);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setTodos([]);
  };

  const add = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      await call("/todos", { method: "POST", body: JSON.stringify({ title }) });
      setTitle("");
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const toggle = async (t) => {
    try {
      await call(`/todos/${t.todoId}`, {
        method: "PATCH",
        body: JSON.stringify({ completed: !t.completed }),
      });
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const remove = async (id) => {
    try {
      await call(`/todos/${id}`, { method: "DELETE" });
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const remaining = todos.filter((t) => !t.completed).length;

  return (
    <>
      <style>{css}</style>
      <div className="stage">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />

        {!token ? (
          <div className="card auth-card">
            <div className="logo">✓</div>
            <h1 className="brand">Serverless&nbsp;TODOs</h1>
            <p className="tagline">Lambda · API Gateway · DynamoDB</p>

            <form onSubmit={login} className="stack">
              <input
                className="field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
              />
              <input
                className="field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="Password"
              />
              <button className="btn btn-primary">Log in →</button>
            </form>

            {error && <p className="error">{error}</p>}
            <p className="hint">
              Demo login&nbsp;·&nbsp;<b>demo@example.com</b>&nbsp;/&nbsp;<b>Demo!2026</b>
            </p>
          </div>
        ) : (
          <div className="card app-card">
            <header className="app-head">
              <div>
                <h1 className="brand sm">My TODOs</h1>
                <p className="count">
                  {remaining === 0
                    ? "All caught up 🎉"
                    : `${remaining} thing${remaining > 1 ? "s" : ""} left to do`}
                </p>
              </div>
              <button className="btn btn-ghost" onClick={logout}>
                Log out
              </button>
            </header>

            <form onSubmit={add} className="add-row">
              <input
                className="field"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Add a new task…"
              />
              <button className="btn btn-primary add-btn">+</button>
            </form>

            {error && <p className="error">{error}</p>}

            {loading && <p className="muted">Loading…</p>}

            {!loading && todos.length === 0 && (
              <div className="empty">
                <div className="empty-emoji">🗒️</div>
                <p>Nothing here yet.</p>
                <span>Add your first task above.</span>
              </div>
            )}

            <ul className="list">
              {todos.map((t) => (
                <li key={t.todoId} className={`item ${t.completed ? "done" : ""}`}>
                  <button
                    className={`check ${t.completed ? "on" : ""}`}
                    onClick={() => toggle(t)}
                    aria-label="toggle"
                  >
                    {t.completed && "✓"}
                  </button>
                  <span className="item-title">{t.title}</span>
                  <button
                    className="del"
                    onClick={() => remove(t.todoId)}
                    aria-label="delete"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>

            <footer className="foot">Powered by AWS Lambda · API Gateway · DynamoDB</footer>
          </div>
        )}
      </div>
    </>
  );
}

const css = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; }

.stage {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 45%, #ec4899 100%);
}

.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(70px);
  opacity: 0.55;
  animation: float 14s ease-in-out infinite;
}
.blob-1 { width: 340px; height: 340px; background: #f472b6; top: -80px; left: -60px; }
.blob-2 { width: 300px; height: 300px; background: #38bdf8; bottom: -70px; right: -50px; animation-delay: -4s; }
.blob-3 { width: 260px; height: 260px; background: #a78bfa; top: 40%; left: 55%; animation-delay: -8s; }
@keyframes float {
  0%,100% { transform: translate(0,0) scale(1); }
  50% { transform: translate(20px,-30px) scale(1.1); }
}

.card {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 460px;
  background: rgba(255,255,255,0.82);
  backdrop-filter: blur(22px);
  border: 1px solid rgba(255,255,255,0.6);
  border-radius: 26px;
  padding: 40px 34px;
  box-shadow: 0 24px 60px rgba(30,10,60,0.28);
  animation: pop 0.5s cubic-bezier(.2,.9,.3,1.2);
}
@keyframes pop { from { opacity: 0; transform: translateY(16px) scale(.98); } to { opacity: 1; transform: none; } }

.logo {
  width: 58px; height: 58px; margin: 0 auto 16px;
  display: grid; place-items: center;
  font-size: 28px; font-weight: 800; color: #fff;
  background: linear-gradient(135deg,#6366f1,#ec4899);
  border-radius: 18px;
  box-shadow: 0 10px 24px rgba(99,102,241,0.5);
}

.brand {
  text-align: center;
  font-size: 30px;
  font-weight: 800;
  background: linear-gradient(135deg,#6366f1,#ec4899);
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: -0.5px;
}
.brand.sm { font-size: 26px; text-align: left; }
.tagline { text-align: center; color: #7c7a90; font-size: 13px; margin: 6px 0 26px; font-weight: 500; }

.stack { display: flex; flex-direction: column; gap: 12px; }

.field {
  width: 100%;
  padding: 14px 16px;
  font-size: 15px;
  border: 2px solid #ece9f5;
  border-radius: 14px;
  background: #fff;
  transition: border-color .2s, box-shadow .2s;
  outline: none;
}
.field:focus { border-color: #8b5cf6; box-shadow: 0 0 0 4px rgba(139,92,246,0.15); }

.btn {
  border: none; cursor: pointer;
  font-weight: 700; font-size: 15px;
  border-radius: 14px;
  transition: transform .15s, box-shadow .2s, opacity .2s;
}
.btn:active { transform: scale(.96); }

.btn-primary {
  padding: 14px;
  color: #fff;
  background: linear-gradient(135deg,#6366f1,#8b5cf6 55%,#ec4899);
  box-shadow: 0 10px 22px rgba(124,58,237,0.42);
}
.btn-primary:hover { box-shadow: 0 14px 28px rgba(124,58,237,0.55); }

.btn-ghost {
  padding: 9px 16px;
  color: #6d28d9;
  background: rgba(124,58,237,0.1);
}
.btn-ghost:hover { background: rgba(124,58,237,0.18); }

.error { color: #e11d48; font-size: 14px; text-align: center; margin-top: 14px; font-weight: 600; }
.hint { text-align: center; color: #9995ab; font-size: 12.5px; margin-top: 20px; }
.hint b { color: #6d28d9; }
.muted { color: #9995ab; text-align: center; padding: 12px; }

.app-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 22px; }
.count { color: #8b5cf6; font-size: 13.5px; font-weight: 600; margin-top: 4px; }

.add-row { display: flex; gap: 10px; margin-bottom: 20px; }
.add-btn { width: 52px; font-size: 24px; line-height: 1; flex-shrink: 0; }

.empty { text-align: center; padding: 34px 0 20px; color: #b5b1c5; }
.empty-emoji { font-size: 46px; margin-bottom: 10px; }
.empty p { font-weight: 700; color: #6b6880; }
.empty span { font-size: 13px; }

.list { list-style: none; display: flex; flex-direction: column; gap: 10px; }
.item {
  display: flex; align-items: center; gap: 14px;
  padding: 14px 16px;
  background: #fff;
  border: 1px solid #f0edf7;
  border-radius: 14px;
  animation: slide .35s ease;
  transition: box-shadow .2s, transform .2s;
}
.item:hover { box-shadow: 0 8px 20px rgba(80,40,120,0.1); transform: translateX(2px); }
@keyframes slide { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: none; } }

.check {
  width: 26px; height: 26px; flex-shrink: 0;
  border: 2px solid #cfc9e0; border-radius: 9px;
  background: #fff; cursor: pointer;
  display: grid; place-items: center;
  color: #fff; font-size: 15px; font-weight: 800;
  transition: all .2s;
}
.check.on { background: linear-gradient(135deg,#10b981,#34d399); border-color: #10b981; }

.item-title { flex: 1; font-size: 15.5px; color: #2a2740; font-weight: 500; }
.item.done .item-title { text-decoration: line-through; color: #b3aec6; }

.del {
  width: 30px; height: 30px; flex-shrink: 0;
  border: none; border-radius: 9px;
  background: transparent; color: #cbc6da;
  font-size: 15px; cursor: pointer;
  transition: all .2s;
}
.del:hover { background: #fee2e2; color: #ef4444; }

.foot { text-align: center; color: #b5b1c5; font-size: 12px; margin-top: 24px; }
`;
