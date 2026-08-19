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
        <div className="corner-tag">AWS · SERVERLESS</div>

        {!token ? (
          <div className="panel auth-panel">
            <div className="panel-head">
              <span className="mark">::</span>
              <div>
                <h1 className="title">todo-service</h1>
                <p className="subtitle">lambda / api-gateway / dynamodb</p>
              </div>
            </div>

            <form onSubmit={login} className="stack">
              <label className="field-label">Email</label>
              <input
                className="field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
              <label className="field-label">Password</label>
              <input
                className="field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="••••••••"
              />
              <button className="btn btn-primary">Sign in</button>
            </form>

            {error && <p className="error">⚠ {error}</p>}
            <div className="hint-box">
              <span className="hint-label">Demo credentials</span>
              <code>demo@example.com / Demo!2026</code>
            </div>
          </div>
        ) : (
          <div className="panel app-panel">
            <header className="app-head">
              <div className="panel-head">
                <span className="mark">::</span>
                <div>
                  <h1 className="title">my-tasks</h1>
                  <p className="subtitle">
                    {remaining === 0
                      ? "queue clear"
                      : `${remaining} pending item${remaining > 1 ? "s" : ""}`}
                  </p>
                </div>
              </div>
              <button className="btn btn-outline" onClick={logout}>
                Sign out
              </button>
            </header>

            <form onSubmit={add} className="add-row">
              <input
                className="field"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="New task…"
              />
              <button className="btn btn-primary add-btn">Add</button>
            </form>

            {error && <p className="error">⚠ {error}</p>}
            {loading && <p className="muted">loading…</p>}

            {!loading && todos.length === 0 && (
              <div className="empty">
                <span className="empty-mark">[ ]</span>
                <p>Queue is empty</p>
                <span className="muted">Add a task to get started</span>
              </div>
            )}

            <ul className="list">
              {todos.map((t, i) => (
                <li key={t.todoId} className={`item ${t.completed ? "done" : ""}`}>
                  <span className="idx">{String(i + 1).padStart(2, "0")}</span>
                  <button
                    className={`check ${t.completed ? "on" : ""}`}
                    onClick={() => toggle(t)}
                    aria-label="toggle"
                  >
                    {t.completed && "×"}
                  </button>
                  <span className="item-title">{t.title}</span>
                  <button className="del" onClick={() => remove(t.todoId)} aria-label="delete">
                    remove
                  </button>
                </li>
              ))}
            </ul>

            <footer className="foot">AWS Lambda · API Gateway · DynamoDB · Lambda Authorizer</footer>
          </div>
        )}
      </div>
    </>
  );
}

const css = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
}

.stage {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  position: relative;
  background-color: #f2ede3;
  background-image:
    linear-gradient(#00000009 1px, transparent 1px),
    linear-gradient(90deg, #00000009 1px, transparent 1px);
  background-size: 28px 28px;
}

.corner-tag {
  position: absolute;
  top: 24px;
  right: 28px;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 11px;
  letter-spacing: 1.5px;
  color: #8a8370;
  border: 1px solid #c9c2ac;
  padding: 5px 10px;
  border-radius: 4px;
  background: #f9f6ef;
}

.panel {
  position: relative;
  width: 100%;
  max-width: 440px;
  background: #fffdf8;
  border: 2px solid #24211a;
  border-radius: 4px;
  padding: 36px 32px;
  box-shadow: 8px 8px 0 #24211a;
}

.panel-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 28px;
}
.mark {
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 22px;
  font-weight: 700;
  color: #b5502a;
  background: #f6e4d8;
  border: 2px solid #24211a;
  width: 42px; height: 42px;
  flex-shrink: 0;
  display: grid; place-items: center;
  border-radius: 4px;
}
.title {
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 21px;
  font-weight: 700;
  color: #24211a;
  letter-spacing: -0.3px;
}
.subtitle {
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 12px;
  color: #8a8370;
  margin-top: 2px;
}

.stack { display: flex; flex-direction: column; gap: 6px; }
.field-label {
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #8a8370;
  margin-top: 10px;
}
.field-label:first-of-type { margin-top: 0; }

.field {
  width: 100%;
  padding: 12px 14px;
  font-size: 14.5px;
  font-family: 'Consolas', 'Courier New', monospace;
  border: 2px solid #24211a;
  border-radius: 4px;
  background: #fffdf8;
  color: #24211a;
  outline: none;
  transition: box-shadow .15s, transform .15s;
}
.field:focus { box-shadow: 3px 3px 0 #b5502a; transform: translate(-1px,-1px); }

.btn {
  border: 2px solid #24211a;
  cursor: pointer;
  font-weight: 700;
  font-size: 14px;
  font-family: 'Consolas', 'Courier New', monospace;
  border-radius: 4px;
  transition: transform .12s, box-shadow .12s;
}
.btn:active { transform: translate(2px,2px); box-shadow: none !important; }

.btn-primary {
  margin-top: 16px;
  padding: 13px;
  color: #fffdf8;
  background: #b5502a;
  box-shadow: 4px 4px 0 #24211a;
}
.btn-primary:hover { box-shadow: 5px 5px 0 #24211a; }

.btn-outline {
  padding: 9px 16px;
  color: #24211a;
  background: #fffdf8;
  box-shadow: 3px 3px 0 #24211a;
}
.btn-outline:hover { background: #f2ede3; }

.error {
  color: #a3271a;
  font-size: 13px;
  margin-top: 16px;
  font-weight: 600;
  font-family: 'Consolas', 'Courier New', monospace;
}

.hint-box {
  margin-top: 24px;
  padding: 12px 14px;
  background: #f2ede3;
  border: 1px dashed #c9c2ac;
  border-radius: 4px;
}
.hint-label {
  display: block;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #8a8370;
  margin-bottom: 4px;
}
.hint-box code {
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 12.5px;
  color: #b5502a;
  font-weight: 700;
}

.app-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }

.add-row { display: flex; gap: 10px; margin-bottom: 22px; }
.add-btn { flex-shrink: 0; padding: 0 18px; box-shadow: 4px 4px 0 #24211a; }
.add-btn:hover { box-shadow: 5px 5px 0 #24211a; }

.muted { color: #a39c86; font-family: 'Consolas', 'Courier New', monospace; font-size: 12.5px; }

.empty { text-align: center; padding: 30px 0 16px; }
.empty-mark {
  display: inline-block;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 24px;
  color: #c9c2ac;
  margin-bottom: 10px;
}
.empty p { font-weight: 700; color: #5c5745; font-family: 'Consolas', 'Courier New', monospace; margin-bottom: 4px; }

.list { list-style: none; display: flex; flex-direction: column; gap: 8px; }
.item {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 14px;
  background: #fffdf8;
  border: 1.5px solid #24211a;
  border-radius: 4px;
  transition: transform .12s;
}
.item:hover { transform: translateX(2px); }

.idx {
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 11px;
  color: #c9c2ac;
  flex-shrink: 0;
  width: 18px;
}

.check {
  width: 22px; height: 22px; flex-shrink: 0;
  border: 2px solid #24211a; border-radius: 3px;
  background: #fffdf8; cursor: pointer;
  display: grid; place-items: center;
  color: #fffdf8; font-size: 15px; font-weight: 800;
  font-family: 'Consolas', 'Courier New', monospace;
  transition: all .15s;
}
.check.on { background: #b5502a; }

.item-title {
  flex: 1;
  font-size: 14.5px;
  color: #24211a;
  font-weight: 500;
  font-family: 'Consolas', 'Courier New', monospace;
}
.item.done .item-title { text-decoration: line-through; color: #a39c86; }

.del {
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: #c9c2ac;
  font-size: 11px;
  font-family: 'Consolas', 'Courier New', monospace;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  cursor: pointer;
  padding: 4px 6px;
  transition: color .15s;
}
.del:hover { color: #a3271a; }

.foot {
  text-align: center;
  color: #a39c86;
  font-size: 10.5px;
  margin-top: 26px;
  font-family: 'Consolas', 'Courier New', monospace;
  letter-spacing: 0.3px;
}
`;
