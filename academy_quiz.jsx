import { useState, useEffect } from "react";
// Put `question_bank.json` next to this file. No API key, fully local question data.
// Scores: if served from the included server (same origin), they save to your Aiven
// MySQL database via /api/scores; otherwise they fall back to this device (localStorage).
import BANK from "./question_bank.json";

const FONT = "-apple-system,'SF Pro Display',BlinkMacSystemFont,system-ui,sans-serif";
const MONO = "'SF Mono','Fira Code','Courier New',monospace";
const IDCOL = "#9a98c9";
const ABC = ["A", "B", "C", "D"];
const PER = BANK.meta.questionsPerSession;
const OFFLINE = typeof location !== "undefined" && location.protocol === "file:";

// ---- score layer (Aiven via server, fallback localStorage) ----
const ls = {
  get(k) { try { return JSON.parse(localStorage.getItem("aq_" + k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem("aq_" + k, JSON.stringify(v)); } catch {} },
};
async function fetchScores(player) {
  if (OFFLINE) return null;
  try {
    const r = await fetch("/api/scores?player=" + encodeURIComponent(player));
    if (r.ok) return await r.json();
  } catch {}
  return null;
}
async function postScore(player, topic, session, score) {
  ls.set(topic + ":" + session, Math.max(score, ls.get(topic + ":" + session) ?? 0));
  if (OFFLINE) return null;
  try {
    const r = await fetch("/api/scores", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player, topic, session, score, total: PER }),
    });
    if (r.ok) return (await r.json()).best;
  } catch {}
  return null;
}

function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function buildAttempt(topic, session) {
  const slice = BANK[topic].slice(session * PER, session * PER + PER);
  return shuffle(slice).map((q, i) => {
    const order = shuffle([0, 1, 2, 3]);
    return {
      id: i + 1, question: q.question, question_id: q.question_id,
      explanation: q.explanation, explanation_id: q.explanation_id,
      options: order.map((k) => q.options[k]),
      options_id: q.options_id ? order.map((k) => q.options_id[k]) : null,
      correct: order.indexOf(q.correct),
    };
  });
}

// ---- text rendering: ```code``` + `inline`; ID line strips code blocks ----
function Txt({ s, noCode, style }) {
  if (!s) return null;
  let blocks = s.split("```");
  if (noCode) blocks = blocks.filter((_, i) => i % 2 === 0);
  return (
    <span style={style}>
      {blocks.map((seg, bi) => {
        const isCode = !noCode && bi % 2 === 1;
        if (isCode)
          return <pre key={bi} style={{ fontFamily: MONO, fontSize: 13, lineHeight: 1.6, background: "rgba(0,0,0,.35)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "13px 15px", margin: "10px 0 0", overflowX: "auto", color: "#e6e6f0", whiteSpace: "pre" }}>{seg.replace(/^\n|\n$/g, "")}</pre>;
        return seg.split("`").map((p, i) => i % 2 === 1
          ? <code key={`${bi}-${i}`} style={{ fontFamily: MONO, fontSize: "0.84em", background: "rgba(255,255,255,0.1)", borderRadius: 4, padding: "1px 5px", color: "#e0e0f0" }}>{p}</code>
          : <span key={`${bi}-${i}`}>{p}</span>);
      })}
    </span>
  );
}

const PAGE = { minHeight: "100vh", background: "linear-gradient(150deg,#06060F 0%,#0D0D20 55%,#07060F 100%)", color: "#F5F5F7", fontFamily: FONT, padding: "24px 20px", boxSizing: "border-box" };

export default function AcademyQuiz() {
  const [screen, setScreen] = useState("home");
  const [topic, setTopic] = useState("logic");
  const [session, setSession] = useState(0);
  const [qs, setQs] = useState([]);
  const [idx, setIdx] = useState(0);
  const [selected, setSel] = useState(null);
  const [score, setScore] = useState(0);
  const [reviewed, setRev] = useState([]);
  const [player, setPlayerState] = useState(ls.get("player") || "me");
  const [remote, setRemote] = useState(null);
  const [sync, setSync] = useState(OFFLINE ? "local" : "connecting");

  useEffect(() => { reload(player); }, []); // eslint-disable-line
  async function reload(p) {
    setSync(OFFLINE ? "local" : "connecting");
    const r = await fetchScores(p);
    if (r) { setRemote(r); setSync("cloud"); } else { setRemote(null); setSync("local"); }
  }
  function setPlayer(v) { const p = (v || "me").trim() || "me"; setPlayerState(p); ls.set("player", p); reload(p); }
  function bestOf(t, s) { const k = t + ":" + s; if (sync === "cloud" && remote && k in remote) return remote[k]; return ls.get(k); }

  const q = qs[idx] ?? null;
  function start(t, s) { setTopic(t); setSession(s); setQs(buildAttempt(t, s)); setIdx(0); setSel(null); setScore(0); setRev([]); setScreen("quiz"); }
  function pick(i) {
    if (selected !== null || !q) return;
    setSel(i); const ok = i === q.correct; if (ok) setScore((s) => s + 1);
    setRev((r) => [...r, { ...q, picked: i, isCorrect: ok }]);
  }
  async function advance() {
    if (idx + 1 >= qs.length) {
      const best = await postScore(player, topic, session, score);
      if (best != null) setRemote((m) => ({ ...(m || {}), [topic + ":" + session]: best }));
      setScreen("results");
    } else { setIdx((i) => i + 1); setSel(null); }
  }

  const syncProps = { cloud: ["☁︎ Cloud (Aiven)", "rgba(50,215,75,.16)", "#32D74B"], local: ["● This device", "rgba(255,159,10,.16)", "#FF9F0A"], connecting: ["… connecting", "rgba(255,255,255,.08)", "#8E8E93"] }[sync];
  const Badge = () => <span style={{ fontSize: 11, borderRadius: 99, padding: "2px 10px", fontWeight: 600, background: syncProps[1], color: syncProps[2] }}>{syncProps[0]}</span>;

  if (screen === "quiz" && q) return <Quiz q={q} num={idx + 1} total={qs.length} selected={selected} score={score} topic={topic} session={session} onPick={pick} onNext={advance} />;
  if (screen === "results") return <Results score={score} total={qs.length} topic={topic} session={session} reviewed={reviewed} Badge={Badge} onRetry={() => start(topic, session)} onHome={() => setScreen("home")} />;
  return <Home topic={topic} setTopic={setTopic} player={player} setPlayer={setPlayer} bestOf={bestOf} Badge={Badge} onStart={start} />;
}

function Home({ topic, setTopic, player, setPlayer, bestOf, Badge, onStart }) {
  const info = BANK.meta.topics[topic];
  const tab = (active, col) => ({ flex: 1, padding: 12, borderRadius: 13, border: `1px solid ${active ? col + "80" : "rgba(255,255,255,.08)"}`, background: active ? col + "2e" : "rgba(255,255,255,.04)", color: active ? "#fff" : "#8E8E93", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FONT });
  return (
    <div style={{ ...PAGE, maxWidth: 500, margin: "0 auto" }}>
      <style>{`@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}.cell:hover{transform:translateY(-2px);background:rgba(255,255,255,.07)!important}`}</style>
      <div style={{ textAlign: "center", margin: "10px 0 18px" }}>
        <div style={{ fontSize: 52, marginBottom: 14, animation: "float 3.8s ease-in-out infinite" }}>🍎</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 6px", letterSpacing: "-.5px" }}>Academy Quiz Prep</h1>
        <p style={{ color: "#636366", margin: "0 0 8px", fontSize: 14 }}>Apple Developer Academy Indonesia</p>
        <span style={{ display: "inline-block", background: "rgba(94,92,230,.18)", color: "#a8a6f8", borderRadius: 99, padding: "2px 12px", fontSize: 12, fontWeight: 600 }}>{info.total} soal · {info.sessions} sesi · EN + ID</span>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: "#636366" }}>Nama / Name:</label>
        <input defaultValue={player} onBlur={(e) => setPlayer(e.target.value)} placeholder="me"
          style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", color: "#F5F5F7", borderRadius: 9, padding: "7px 11px", fontSize: 13, fontFamily: FONT, maxWidth: 150 }} />
        <Badge />
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <button style={tab(topic === "logic", "#5E5CE6")} onClick={() => setTopic("logic")}>🧠 Logic / Logika</button>
        <button style={tab(topic === "programming", "#0071E3")} onClick={() => setTopic("programming")}>💻 Programming</button>
      </div>
      <p style={{ color: "#636366", fontSize: 13, textAlign: "center", margin: "0 0 16px", lineHeight: 1.6 }}>
        {topic === "logic" ? "Sequences · Patterns · Analogies · Syllogisms · Coding · Matrices" : "Swift tracing · OOP · Data structures · Algorithms · Big-O · Debugging"}
        <br /><span style={{ color: IDCOL, fontStyle: "italic" }}>{topic === "logic" ? "Barisan · Pola · Analogi · Silogisme · Sandi · Matriks" : "Telusur kode Swift · OOP · Struktur data · Algoritma · Big-O · Cari bug"}</span>
        <br />Pick a session — 50 questions each · no timer<br /><span style={{ color: IDCOL, fontStyle: "italic" }}>Pilih satu sesi — 50 soal per sesi · tanpa timer</span>
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(80px,1fr))", gap: 10 }}>
        {Array.from({ length: info.sessions }).map((_, s) => {
          const best = bestOf(topic, s); const done = best !== null && best !== undefined;
          const pct = done ? Math.round((best / PER) * 100) : 0;
          const col = pct >= 85 ? "#32D74B" : pct >= 55 ? "#30E3CA" : pct >= 40 ? "#FF9F0A" : "#FF453A";
          return (
            <button key={s} className="cell" onClick={() => onStart(topic, s)} style={{ aspectRatio: "1", borderRadius: 14, background: "rgba(255,255,255,.04)", border: `1px solid ${done ? "rgba(50,215,75,.35)" : "rgba(255,255,255,.08)"}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, cursor: "pointer", color: "#F5F5F7", fontFamily: FONT, transition: ".16s" }}>
              <span style={{ fontSize: 18, fontWeight: 800 }}>{s + 1}</span>
              <span style={{ fontSize: 10, color: "#636366" }}>{done ? "best" : "50 Q"}</span>
              {done && <span style={{ fontSize: 11, fontWeight: 700, color: col }}>{best}/{PER}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Quiz({ q, num, total, selected, score, topic, session, onPick, onNext }) {
  const answered = selected !== null;
  const isRight = selected === q.correct;
  return (
    <div style={{ ...PAGE, maxWidth: 620, margin: "0 auto", display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <style>{`.opt:not(:disabled):hover{background:rgba(255,255,255,.07)!important}`}</style>
      <div style={{ height: 3, background: "rgba(255,255,255,.06)", borderRadius: 2, marginBottom: 18, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${((num - 1) / total) * 100}%`, background: "linear-gradient(90deg,#5E5CE6,#0071E3)", borderRadius: 2, transition: "width .4s ease" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ color: "#636366", fontSize: 13 }}>{topic === "logic" ? "🧠 Logic" : "💻 Programming"} · S{session + 1}</span>
        <span style={{ fontWeight: 700 }}>Q{num} <span style={{ color: "#3A3A3C", fontWeight: 400 }}>/ {total}</span></span>
        <span style={{ background: "rgba(50,215,75,.14)", color: "#32D74B", borderRadius: 99, padding: "3px 12px", fontSize: 13, fontWeight: 700 }}>✓ {score}</span>
      </div>
      <div style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.075)", borderRadius: 16, padding: "16px 18px", marginBottom: 13 }}>
        <div style={{ fontSize: 15, lineHeight: 1.7, whiteSpace: "pre-wrap" }}><Txt s={q.question} /></div>
        <div style={{ fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap", marginTop: 9, paddingTop: 9, borderTop: "1px dashed rgba(255,255,255,.1)", color: IDCOL, fontStyle: "italic" }}><Txt s={q.question_id} noCode /></div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 14 }}>
        {q.options.map((opt, i) => {
          const isMe = selected === i, correct = i === q.correct;
          let bg = "rgba(255,255,255,.038)", bdr = "rgba(255,255,255,.075)", col = "#F5F5F7";
          let badgeBg = "rgba(255,255,255,.09)", badgeCol = "#636366", badge = ABC[i];
          if (answered) {
            if (correct) { bg = "rgba(50,215,75,.1)"; bdr = "rgba(50,215,75,.4)"; badgeBg = "rgba(50,215,75,.22)"; badgeCol = "#32D74B"; badge = "✓"; }
            else if (isMe) { bg = "rgba(255,69,58,.1)"; bdr = "rgba(255,69,58,.4)"; badgeBg = "rgba(255,69,58,.22)"; badgeCol = "#FF453A"; badge = "✗"; }
            else { bg = "rgba(255,255,255,.015)"; bdr = "rgba(255,255,255,.04)"; col = "#3A3A3C"; }
          }
          const oid = q.options_id && q.options_id[i] && q.options_id[i] !== opt;
          return (
            <button key={i} className="opt" onClick={() => onPick(i)} disabled={answered} style={{ background: bg, border: `1px solid ${bdr}`, borderRadius: 13, padding: "12px 14px", display: "flex", alignItems: "flex-start", gap: 11, cursor: answered ? "default" : "pointer", textAlign: "left", color: col, fontFamily: FONT, fontSize: 14, lineHeight: 1.55, width: "100%", transition: ".16s" }}>
              <span style={{ width: 27, height: 27, borderRadius: 7, flexShrink: 0, background: badgeBg, color: badgeCol, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>{badge}</span>
              <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ whiteSpace: "pre-wrap" }}><Txt s={opt} /></span>
                {oid && <span style={{ fontSize: 12.5, color: answered && !correct && !isMe ? "#3A3A3C" : IDCOL, fontStyle: "italic" }}><Txt s={q.options_id[i]} /></span>}
              </span>
            </button>
          );
        })}
      </div>
      {answered && (
        <div style={{ background: isRight ? "rgba(50,215,75,.07)" : "rgba(255,69,58,.07)", border: `1px solid ${isRight ? "rgba(50,215,75,.22)" : "rgba(255,69,58,.22)"}`, borderRadius: 13, padding: "13px 16px", marginBottom: 14 }}>
          <p style={{ margin: "0 0 7px", fontSize: 13, fontWeight: 700, color: isRight ? "#32D74B" : "#FF453A" }}>
            {isRight ? "✓ Correct! / Benar!" : `✗ Incorrect — answer ${ABC[q.correct]} / Salah — jawaban ${ABC[q.correct]}`}
          </p>
          <p style={{ margin: 0, fontSize: 13, color: "#C7C7CC", lineHeight: 1.65 }}><Txt s={q.explanation} /></p>
          <p style={{ margin: "7px 0 0", paddingTop: 7, borderTop: "1px dashed rgba(255,255,255,.12)", fontSize: 13, lineHeight: 1.65, color: IDCOL, fontStyle: "italic" }}><Txt s={q.explanation_id} /></p>
        </div>
      )}
      {answered && (
        <button onClick={onNext} style={{ padding: 13, borderRadius: 13, border: "none", background: "linear-gradient(135deg,#5E5CE6,#0071E3)", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: FONT, marginTop: "auto" }}>
          {num < total ? "Next / Lanjut →" : "See Results / Lihat Hasil 🎯"}
        </button>
      )}
    </div>
  );
}

function Results({ score, total, topic, session, reviewed, Badge, onRetry, onHome }) {
  const pct = Math.round((score / total) * 100);
  const wrong = reviewed.filter((r) => !r.isCorrect);
  const [showWrong, setShowWrong] = useState(false);
  const [grade, col] = pct >= 85 ? ["Outstanding! 🔥", "#32D74B"] : pct >= 70 ? ["Great job! 💪", "#30E3CA"] : pct >= 55 ? ["Good effort! 📚", "#0071E3"] : pct >= 40 ? ["Keep going! 🚀", "#FF9F0A"] : ["Don't give up! 💡", "#FF453A"];
  return (
    <div style={{ ...PAGE, maxWidth: 620, margin: "0 auto" }}>
      <div style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.075)", borderRadius: 20, padding: "26px 22px", textAlign: "center", marginBottom: 14 }}>
        <p style={{ color: "#636366", fontSize: 13, margin: "0 0 18px", display: "flex", gap: 8, justifyContent: "center", alignItems: "center" }}>{topic === "logic" ? "🧠 Logic" : "💻 Programming"} · Session {session + 1} · <Badge /></p>
        <div style={{ width: 100, height: 100, borderRadius: "50%", border: `4px solid ${col}`, margin: "0 auto 18px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 34, fontWeight: 800, color: col, lineHeight: 1 }}>{score}</span>
          <span style={{ fontSize: 12, color: "#636366" }}>/ {total}</span>
        </div>
        <h2 style={{ margin: "0 0 5px", fontSize: 22, fontWeight: 800 }}>{grade}</h2>
        <p style={{ margin: 0, color: "#8E8E93" }}>{pct}% accuracy / akurasi</p>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        {[["Correct / Benar", score, "#32D74B"], ["Wrong / Salah", wrong.length, "#FF453A"], ["Score / Nilai", `${pct}%`, "#5E5CE6"]].map(([l, v, c]) => (
          <div key={l} style={{ flex: 1, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 13, padding: "13px 8px", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: c }}>{v}</div>
            <div style={{ fontSize: 11, color: "#636366", marginTop: 3 }}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 22 }}>
        <button onClick={onHome} style={{ flex: 1, padding: 13, borderRadius: 12, border: "none", background: "rgba(255,255,255,.07)", color: "#F5F5F7", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>← Home</button>
        <button onClick={onRetry} style={{ flex: 2, padding: 13, borderRadius: 12, border: "none", background: "linear-gradient(135deg,#5E5CE6,#0071E3)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>Retry / Ulangi →</button>
      </div>
      {wrong.length > 0 ? (
        <>
          <button onClick={() => setShowWrong((v) => !v)} style={{ width: "100%", padding: "11px 16px", borderRadius: 11, border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.04)", color: "#F5F5F7", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT, marginBottom: 12 }}>
            {showWrong ? "▲ Hide" : "▼ Review"} {wrong.length} wrong / salah
          </button>
          {showWrong && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {wrong.map((r, i) => (
                <div key={i} style={{ background: "rgba(255,69,58,.06)", border: "1px solid rgba(255,69,58,.13)", borderRadius: 13, padding: "13px 15px" }}>
                  <p style={{ margin: "0 0 10px", fontSize: 13, lineHeight: 1.6, fontWeight: 500, whiteSpace: "pre-wrap" }}>
                    <Txt s={r.question} /><br /><span style={{ color: IDCOL, fontStyle: "italic" }}><Txt s={r.question_id} noCode /></span>
                  </p>
                  <p style={{ margin: "0 0 3px", fontSize: 12, color: "#FF453A" }}>✗ You / Kamu: <Txt s={r.options[r.picked]} />{r.options_id && r.options_id[r.picked] !== r.options[r.picked] && <span style={{ color: IDCOL, fontStyle: "italic" }}> (<Txt s={r.options_id[r.picked]} noCode />)</span>}</p>
                  <p style={{ margin: "0 0 9px", fontSize: 12, color: "#32D74B" }}>✓ Correct / Benar: <Txt s={r.options[r.correct]} />{r.options_id && r.options_id[r.correct] !== r.options[r.correct] && <span style={{ color: IDCOL, fontStyle: "italic" }}> (<Txt s={r.options_id[r.correct]} noCode />)</span>}</p>
                  <p style={{ margin: 0, fontSize: 12, color: "#8E8E93", lineHeight: 1.6 }}><Txt s={r.explanation} /><br /><span style={{ color: IDCOL, fontStyle: "italic" }}><Txt s={r.explanation_id} /></span></p>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div style={{ textAlign: "center", padding: 20, color: "#32D74B", fontSize: 14, fontWeight: 600 }}>🎯 Perfect session! / Sesi sempurna!</div>
      )}
    </div>
  );
}
