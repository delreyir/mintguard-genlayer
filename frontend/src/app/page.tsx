"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { CONTRACT_ADDRESS, connectWallet, disconnectWallet, readClient, shortAddr, hasWallet, type WalletState } from "@/lib/genlayer";
import { TransactionStatus } from "genlayer-js/types";

type Check = { id: string; requester: string; image_url: string; title: string; creator_claim: string; fee: string; status: number; report: string; };
type Tab = "registry" | "about" | "how";

const catColor = (c: string) => ({ original: "#10b981", derivative: "#f59e0b", copy: "#ef4444", ai_generated: "#8b5cf6", suspicious: "#f97316" }[c] || "#6b7280");
const catLabel = (c: string) => ({ original: "Original", derivative: "Derivative", copy: "Copy", ai_generated: "AI Generated", suspicious: "Suspicious" }[c] || c);

export default function Home() {
  const [wallet, setWallet] = useState<WalletState>({ address: null, client: null });
  const [checks, setChecks] = useState<Check[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<"none" | "submit">("none");
  const [selected, setSelected] = useState<Check | null>(null);
  const [form, setForm] = useState({ url: "", title: "", creator: "", fee: "1" });
  const [tx, setTx] = useState("");
  const [tab, setTab] = useState<Tab>("registry");
  const [walletOpen, setWalletOpen] = useState(false);
  const walletRef = useRef<HTMLDivElement>(null);

  // Close wallet dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (walletRef.current && !walletRef.current.contains(e.target as Node)) setWalletOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const load = useCallback(async () => {
    try {
      const rc = readClient();
      const count = Number(await rc.readContract({ address: CONTRACT_ADDRESS, functionName: "get_check_count", args: [] }));
      const out: Check[] = [];
      for (let i = 1; i <= count; i++) {
        const raw = await rc.readContract({ address: CONTRACT_ADDRESS, functionName: "get_check", args: [String(i)] });
        out.push(JSON.parse(raw as string));
      }
      setChecks(out.reverse());
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleConnect() {
    setTx("Connecting…");
    try {
      const w = await connectWallet();
      setWallet(w);
      setTx("");
      setWalletOpen(false);
    } catch (e: any) { setTx(e.message); }
  }

  function handleDisconnect() {
    setWallet(disconnectWallet());
    setWalletOpen(false);
    setTx("");
  }

  async function send(fn: string, args: any[], value?: bigint) {
    if (!wallet.client) { setTx("Connect your wallet first"); return; }
    setLoading(true); setTx("Submitting transaction…");
    try {
      const hash = await wallet.client.writeContract({
        address: CONTRACT_ADDRESS, functionName: fn, args, value: value ?? BigInt(0),
      });
      setTx("Waiting for AI consensus…");
      const receipt = await wallet.client.waitForTransactionReceipt({ hash, status: TransactionStatus.ACCEPTED });
      if (receipt && (receipt as any).status === TransactionStatus.CANCELED) {
        setTx("⚠ Consensus failed — validators disagreed. Try again.");
        setLoading(false);
        return;
      }
      setTx("✓ Accepted!");
      await load();
      setTimeout(() => setTx(""), 3000);
      setSelected(null); setModal("none");
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (/consensus|abort|canceled|timeout/i.test(msg)) {
        setTx("⚠ AI panel could not reach consensus. Validators disagreed. Please retry.");
      } else if (/insufficient funds/i.test(msg)) {
        setTx("⚠ Insufficient GEN. Use the faucet to get tokens.");
      } else if (/user rejected|rejected/i.test(msg)) {
        setTx("Rejected by user.");
      } else {
        setTx(`Error: ${msg.slice(0, 120)}`);
      }
    }
    setLoading(false);
  }

  return (
    <div className="app">
      {/* Navigation */}
      <nav className="nav">
        <div className="nav-inner">
          <div className="nav-left">
            <div className="logo">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="13" stroke="#10b981" strokeWidth="2"/><path d="M9 14l3 3 7-7" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span className="logo-text">MintGuard</span>
            </div>
            <div className="nav-tabs">
              <button className={`nav-tab ${tab === "registry" ? "active" : ""}`} onClick={() => setTab("registry")}>Registry</button>
              <button className={`nav-tab ${tab === "about" ? "active" : ""}`} onClick={() => setTab("about")}>About</button>
              <button className={`nav-tab ${tab === "how" ? "active" : ""}`} onClick={() => setTab("how")}>How It Works</button>
            </div>
          </div>
          <div className="nav-right" ref={walletRef}>
            {wallet.address ? (
              <div className="wallet-connected">
                <button className="wallet-btn connected" onClick={() => setWalletOpen(!walletOpen)}>
                  <span className="wallet-dot" />
                  {shortAddr(wallet.address)}
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </button>
                {walletOpen && (
                  <div className="wallet-dropdown">
                    <div className="wallet-dropdown-addr">{wallet.address}</div>
                    <div className="wallet-dropdown-net">GenLayer Studionet</div>
                    <button className="wallet-disconnect" onClick={handleDisconnect}>Disconnect</button>
                  </div>
                )}
              </div>
            ) : (
              <button className="wallet-btn" onClick={handleConnect}>Connect Wallet</button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="hero">
        <div className="hero-badge">Powered by GenLayer AI Consensus</div>
        <h1 className="hero-title">NFT Authenticity<br/>Verification Protocol</h1>
        <p className="hero-desc">
          Submit any digital artwork. Independent AI validators analyze it for originality, detecting copies, derivatives, and undisclosed AI generation. Verdicts are recorded permanently on-chain.
        </p>
        <div className="hero-actions">
          <button className="btn-primary" onClick={() => setModal("submit")}>Submit Artwork</button>
          <a href="https://testnet-faucet.genlayer.foundation/" target="_blank" rel="noopener" className="btn-secondary">Get Testnet GEN</a>
        </div>
        <div className="hero-stats">
          <div className="stat"><span className="stat-num">{checks.length}</span><span className="stat-label">Works Submitted</span></div>
          <div className="stat"><span className="stat-num">{checks.filter(c => c.status !== 0).length}</span><span className="stat-label">Verified</span></div>
          <div className="stat"><span className="stat-num">{checks.filter(c => { const r = c.report ? JSON.parse(c.report) : null; return r?.is_original; }).length}</span><span className="stat-label">Authenticated</span></div>
        </div>
      </header>

      {tx && <div className="toast">{tx}</div>}

      {/* Main Content */}
      <main className="main">
        {tab === "registry" && (
          <section className="registry">
            <h2 className="section-title">Verification Registry</h2>
            {checks.length === 0 && <p className="empty">No works submitted yet. Be the first to request verification.</p>}
            <div className="grid">
              {checks.map(c => {
                const r = c.report ? JSON.parse(c.report) : null;
                return (
                  <article key={c.id} className="card" onClick={() => setSelected(c)}>
                    <div className="card-header">
                      <span className="card-id">#{String(c.id).padStart(3, "0")}</span>
                      <span className="card-status" style={{ color: c.status === 0 ? "#6b7280" : catColor(r?.category || ""), background: c.status === 0 ? "#1f2937" : `${catColor(r?.category || "")}15` }}>
                        {c.status === 0 ? "Pending" : catLabel(r?.category || "")}
                      </span>
                    </div>
                    <h3 className="card-title">{c.title}</h3>
                    <p className="card-creator">by {c.creator_claim}</p>
                    {r && (
                      <div className="card-result">
                        <div className="confidence-bar">
                          <div className="confidence-fill" style={{ width: `${r.confidence * 10}%`, background: catColor(r.category) }} />
                        </div>
                        <span className="confidence-label">{r.confidence}/10 confidence</span>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {tab === "about" && (
          <section className="about">
            <h2 className="section-title">About MintGuard</h2>
            <div className="about-grid">
              <div className="about-card">
                <h3>What is MintGuard?</h3>
                <p>MintGuard is a decentralized authenticity registry for digital art and NFTs built on GenLayer. It uses AI-powered consensus to verify whether artwork is original, derivative, copied, or AI-generated — recording permanent verdicts on-chain.</p>
              </div>
              <div className="about-card">
                <h3>Why GenLayer?</h3>
                <p>GenLayer&apos;s Intelligent Contracts can call LLMs and access web data inside a consensus mechanism. Multiple independent validators run AI analysis and must agree before a verdict is recorded. This ensures no single AI can produce a biased result.</p>
              </div>
              <div className="about-card">
                <h3>Consensus Mechanism</h3>
                <p>Uses <code>gl.vm.run_nondet_unsafe()</code> with custom validator functions. The leader fetches content and runs LLM analysis. Validators repeat independently. Results are normalized (bool cast, int clamp, lowercase) to prevent formatting disagreements.</p>
              </div>
              <div className="about-card">
                <h3>Failure Handling</h3>
                <p>If validators disagree, the transaction is canceled (not stuck). The frontend detects <code>TransactionStatus.CANCELED</code> and shows a descriptive message. Users can retry — no &quot;Under review&quot; limbo.</p>
              </div>
            </div>
            <div className="tech-stack">
              <h3>Technical Stack</h3>
              <div className="stack-grid">
                {[
                  ["Contract", "Python Intelligent Contract on GenVM"],
                  ["AI", "Non-deterministic LLM calls via gl.nondet.exec_prompt()"],
                  ["Web", "On-chain web access via gl.nondet.web.get()"],
                  ["Frontend", "Next.js 14 + GenLayer JS SDK"],
                  ["Network", "GenLayer Studionet"],
                  ["Wallet", "EVM wallets via client.connect()"],
                ].map(([k, v]) => (
                  <div key={k} className="stack-item"><span className="stack-key">{k}</span><span className="stack-val">{v}</span></div>
                ))}
              </div>
            </div>
            <div className="contract-info">
              <span className="contract-label">Contract Address</span>
              <code className="contract-addr">{CONTRACT_ADDRESS}</code>
            </div>
          </section>
        )}

        {tab === "how" && (
          <section className="how">
            <h2 className="section-title">How It Works</h2>
            <div className="steps">
              {[
                { num: "01", title: "Connect Wallet", desc: "Connect any EVM wallet (MetaMask, Rabby). The app automatically switches to the GenLayer network." },
                { num: "02", title: "Submit Artwork", desc: "Provide the artwork URL, title, creator claim, and a small GEN fee to fund AI verification." },
                { num: "03", title: "AI Analysis", desc: "A leader validator fetches the page, runs LLM analysis with a strict JSON-only prompt, and produces a normalized report." },
                { num: "04", title: "Validator Consensus", desc: "Independent validators repeat the analysis. They compare: is_original (bool), category (string), confidence (±2 tolerance)." },
                { num: "05", title: "On-Chain Verdict", desc: "If validators agree → verdict recorded on-chain. If they disagree → transaction canceled with clear error message." },
                { num: "06", title: "View Results", desc: "Browse the registry to see authenticated works, disputed pieces, confidence scores, and reasoning." },
              ].map(s => (
                <div key={s.num} className="step">
                  <div className="step-num">{s.num}</div>
                  <div className="step-content">
                    <h4>{s.title}</h4>
                    <p>{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="faucet-box">
              <h4>Need Testnet Tokens?</h4>
              <p>Get free GEN tokens from the <a href="https://testnet-faucet.genlayer.foundation/" target="_blank" rel="noopener">GenLayer Faucet</a> to start verifying artwork.</p>
            </div>
          </section>
        )}
      </main>

      {/* Submit Modal */}
      {modal === "submit" && (
        <div className="overlay" onClick={() => setModal("none")}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Submit Artwork for Verification</h2>
              <button className="modal-close" onClick={() => setModal("none")}>✕</button>
            </div>
            <p className="modal-desc">Provide artwork details. A GEN fee is required to fund the AI verification process.</p>
            <form onSubmit={e => { e.preventDefault(); send("request_check", [form.url, form.title, form.creator], BigInt(form.fee || "0") * BigInt(10 ** 18)); }}>
              <div className="field">
                <label>Artwork URL</label>
                <input placeholder="https://opensea.io/assets/..." value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} required />
              </div>
              <div className="field">
                <label>Title</label>
                <input placeholder="Name of the artwork" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
              </div>
              <div className="field">
                <label>Creator Claim</label>
                <input placeholder="Who claims to be the creator" value={form.creator} onChange={e => setForm({ ...form, creator: e.target.value })} required />
              </div>
              <div className="field">
                <label>Verification Fee (GEN)</label>
                <input type="number" min="1" placeholder="1" value={form.fee} onChange={e => setForm({ ...form, fee: e.target.value })} required />
              </div>
              <button type="submit" className="btn-primary full" disabled={loading}>{loading ? "Processing…" : "Submit for Verification"}</button>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selected.title}</h2>
              <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="detail-meta">
              <span className="detail-id">#{String(selected.id).padStart(3, "0")}</span>
              <span className="detail-requester">by {shortAddr(selected.requester)}</span>
            </div>
            <p className="detail-creator">Creator claim: <strong>{selected.creator_claim}</strong></p>
            <a href={selected.image_url} target="_blank" rel="noopener" className="detail-url">{selected.image_url}</a>
            {(() => {
              const r = selected.report ? JSON.parse(selected.report) : null;
              if (r) return (
                <div className="detail-report">
                  <div className="detail-verdict" style={{ borderColor: catColor(r.category) }}>
                    <div className="verdict-badge" style={{ background: catColor(r.category) }}>
                      {r.is_original ? "✦ Authenticated" : "✕ Disputed"} — {catLabel(r.category)}
                    </div>
                    <div className="verdict-confidence">
                      <div className="confidence-bar lg"><div className="confidence-fill" style={{ width: `${r.confidence * 10}%`, background: catColor(r.category) }} /></div>
                      <span>{r.confidence}/10</span>
                    </div>
                  </div>
                  <p className="detail-reasoning">{r.reasoning}</p>
                  {r.red_flags?.length > 0 && (
                    <div className="red-flags">
                      <span className="rf-label">⚑ Red Flags</span>
                      {r.red_flags.map((f: string, i: number) => <span key={i} className="rf-item">{f}</span>)}
                    </div>
                  )}
                </div>
              );
              return (
                <div className="detail-pending">
                  <p>This work hasn&apos;t been verified yet. Convene the AI panel to analyze it.</p>
                  <button className="btn-primary full" onClick={() => send("verify_originality", [selected.id])} disabled={loading}>
                    {loading ? "Analyzing… (waiting for consensus)" : "Verify Authenticity"}
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="footer">
        <div className="footer-inner">
          <span>Built on <a href="https://docs.genlayer.com" target="_blank" rel="noopener">GenLayer</a></span>
          <span>·</span>
          <span>AI Consensus Verification</span>
          <span>·</span>
          <a href="https://github.com/delreyir/mintguard-genlayer" target="_blank" rel="noopener">GitHub</a>
        </div>
      </footer>

      <style>{styles}</style>
    </div>
  );
}

const styles = `
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #0a0f1a; color: #e2e8f0; font-family: 'Inter', -apple-system, sans-serif; }
a { color: #10b981; text-decoration: none; }
a:hover { text-decoration: underline; }
code { font-family: 'JetBrains Mono', monospace; font-size: 0.85em; background: #1e293b; padding: 2px 6px; border-radius: 4px; }

.app { min-height: 100vh; display: flex; flex-direction: column; }

/* Nav */
.nav { position: sticky; top: 0; z-index: 50; background: rgba(10,15,26,0.92); backdrop-filter: blur(12px); border-bottom: 1px solid #1e293b; }
.nav-inner { max-width: 1200px; margin: 0 auto; padding: 0 24px; height: 64px; display: flex; align-items: center; justify-content: space-between; }
.nav-left { display: flex; align-items: center; gap: 32px; }
.logo { display: flex; align-items: center; gap: 10px; }
.logo-text { font-size: 18px; font-weight: 600; color: #f1f5f9; letter-spacing: -0.5px; }
.nav-tabs { display: flex; gap: 4px; }
.nav-tab { background: none; border: none; color: #94a3b8; font-size: 14px; font-weight: 500; padding: 8px 16px; border-radius: 8px; cursor: pointer; transition: all 0.2s; }
.nav-tab:hover { color: #e2e8f0; background: #1e293b; }
.nav-tab.active { color: #10b981; background: #10b98115; }
.nav-right { position: relative; }

/* Wallet */
.wallet-btn { background: #10b981; color: #0a0f1a; border: none; padding: 10px 20px; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
.wallet-btn:hover { background: #059669; transform: translateY(-1px); }
.wallet-btn.connected { background: #1e293b; color: #e2e8f0; border: 1px solid #334155; display: flex; align-items: center; gap: 8px; }
.wallet-btn.connected:hover { border-color: #475569; }
.wallet-dot { width: 8px; height: 8px; border-radius: 50%; background: #10b981; }
.wallet-connected { position: relative; }
.wallet-dropdown { position: absolute; top: calc(100% + 8px); right: 0; background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 16px; width: 280px; box-shadow: 0 20px 40px rgba(0,0,0,0.4); }
.wallet-dropdown-addr { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #94a3b8; word-break: break-all; margin-bottom: 8px; }
.wallet-dropdown-net { font-size: 12px; color: #10b981; margin-bottom: 12px; padding: 4px 8px; background: #10b98115; border-radius: 4px; display: inline-block; }
.wallet-disconnect { width: 100%; background: #ef444420; color: #ef4444; border: 1px solid #ef444440; padding: 8px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
.wallet-disconnect:hover { background: #ef444430; }

/* Hero */
.hero { text-align: center; padding: 80px 24px 60px; max-width: 800px; margin: 0 auto; }
.hero-badge { display: inline-block; padding: 6px 14px; background: #10b98115; border: 1px solid #10b98130; border-radius: 20px; font-size: 12px; font-weight: 500; color: #10b981; letter-spacing: 0.5px; margin-bottom: 24px; }
.hero-title { font-size: clamp(36px, 5vw, 56px); font-weight: 700; line-height: 1.1; letter-spacing: -1.5px; background: linear-gradient(135deg, #f1f5f9, #94a3b8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 20px; }
.hero-desc { font-size: 16px; color: #94a3b8; line-height: 1.7; max-width: 600px; margin: 0 auto 32px; }
.hero-actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-bottom: 48px; }

.hero-stats { display: flex; justify-content: center; gap: 48px; }
.stat { display: flex; flex-direction: column; align-items: center; }
.stat-num { font-size: 28px; font-weight: 700; color: #f1f5f9; }
.stat-label { font-size: 12px; color: #64748b; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px; }

/* Buttons */
.btn-primary { background: #10b981; color: #0a0f1a; border: none; padding: 12px 28px; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
.btn-primary:hover { background: #059669; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(16,185,129,0.3); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
.btn-primary.full { width: 100%; }
.btn-secondary { padding: 12px 28px; border-radius: 10px; font-size: 14px; font-weight: 500; border: 1px solid #334155; color: #e2e8f0; transition: all 0.2s; display: inline-block; }
.btn-secondary:hover { border-color: #475569; background: #1e293b; text-decoration: none; }

/* Toast */
.toast { text-align: center; padding: 12px 20px; margin: 0 auto; max-width: 700px; font-size: 14px; color: #fbbf24; background: #78350f20; border: 1px solid #78350f40; border-radius: 8px; }

/* Main */
.main { flex: 1; max-width: 1000px; margin: 0 auto; padding: 40px 24px 80px; width: 100%; }
.section-title { font-size: 24px; font-weight: 600; margin-bottom: 24px; letter-spacing: -0.5px; }
.empty { color: #64748b; text-align: center; padding: 40px; }

/* Registry Grid */
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
.card { background: #111827; border: 1px solid #1e293b; border-radius: 12px; padding: 20px; cursor: pointer; transition: all 0.2s; }
.card:hover { border-color: #334155; transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.card-id { font-size: 12px; color: #64748b; font-family: 'JetBrains Mono', monospace; }
.card-status { font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
.card-title { font-size: 16px; font-weight: 600; color: #f1f5f9; margin-bottom: 4px; }
.card-creator { font-size: 13px; color: #64748b; }
.card-result { margin-top: 12px; }
.confidence-bar { height: 4px; background: #1e293b; border-radius: 2px; overflow: hidden; margin-bottom: 4px; }
.confidence-bar.lg { height: 6px; }
.confidence-fill { height: 100%; border-radius: 2px; transition: width 0.3s; }
.confidence-label { font-size: 11px; color: #64748b; }

/* About */
.about-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 32px; }
.about-card { background: #111827; border: 1px solid #1e293b; border-radius: 12px; padding: 24px; }
.about-card h3 { font-size: 15px; font-weight: 600; color: #f1f5f9; margin-bottom: 8px; }
.about-card p { font-size: 14px; color: #94a3b8; line-height: 1.6; }
.tech-stack { background: #111827; border: 1px solid #1e293b; border-radius: 12px; padding: 24px; margin-bottom: 16px; }
.tech-stack h3 { font-size: 15px; font-weight: 600; color: #f1f5f9; margin-bottom: 16px; }
.stack-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
.stack-item { display: flex; flex-direction: column; gap: 2px; }
.stack-key { font-size: 11px; font-weight: 600; color: #10b981; text-transform: uppercase; letter-spacing: 0.5px; }
.stack-val { font-size: 13px; color: #94a3b8; }
.contract-info { background: #111827; border: 1px solid #1e293b; border-radius: 12px; padding: 16px 24px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.contract-label { font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
.contract-addr { font-size: 12px; color: #94a3b8; word-break: break-all; }

/* How it works */
.steps { display: flex; flex-direction: column; gap: 0; }
.step { display: flex; gap: 20px; padding: 24px 0; border-bottom: 1px solid #1e293b; }
.step:last-child { border-bottom: none; }
.step-num { font-size: 32px; font-weight: 700; color: #10b981; opacity: 0.5; min-width: 48px; }
.step-content h4 { font-size: 16px; font-weight: 600; color: #f1f5f9; margin-bottom: 6px; }
.step-content p { font-size: 14px; color: #94a3b8; line-height: 1.6; }
.faucet-box { margin-top: 24px; background: #10b98110; border: 1px solid #10b98130; border-radius: 12px; padding: 20px 24px; }
.faucet-box h4 { font-size: 15px; font-weight: 600; color: #10b981; margin-bottom: 6px; }
.faucet-box p { font-size: 14px; color: #94a3b8; }

/* Overlay & Modal */
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); display: grid; place-items: center; padding: 20px; z-index: 100; }
.modal { background: #111827; border: 1px solid #1e293b; border-radius: 16px; padding: 32px; max-width: 520px; width: 100%; max-height: 85vh; overflow-y: auto; }
.modal-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
.modal-header h2 { font-size: 20px; font-weight: 600; color: #f1f5f9; }
.modal-close { background: none; border: none; color: #64748b; font-size: 20px; cursor: pointer; padding: 4px 8px; border-radius: 6px; }
.modal-close:hover { background: #1e293b; color: #e2e8f0; }
.modal-desc { font-size: 14px; color: #94a3b8; margin-bottom: 20px; }
.field { margin-bottom: 16px; }
.field label { display: block; font-size: 12px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
.field input { width: 100%; padding: 12px 14px; background: #0a0f1a; border: 1px solid #334155; border-radius: 8px; color: #e2e8f0; font-size: 14px; transition: border-color 0.2s; outline: none; }
.field input:focus { border-color: #10b981; }
.field input::placeholder { color: #475569; }

/* Detail Modal */
.detail-meta { display: flex; gap: 12px; align-items: center; margin-bottom: 8px; }
.detail-id { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #64748b; }
.detail-requester { font-size: 12px; color: #64748b; }
.detail-creator { font-size: 14px; color: #94a3b8; margin-bottom: 8px; }
.detail-url { font-size: 13px; color: #10b981; word-break: break-all; display: block; margin-bottom: 16px; }
.detail-report { border-top: 1px solid #1e293b; padding-top: 16px; }
.detail-verdict { border: 1px solid; border-radius: 10px; padding: 16px; margin-bottom: 12px; }
.verdict-badge { display: inline-block; padding: 4px 12px; border-radius: 6px; color: #fff; font-size: 12px; font-weight: 600; letter-spacing: 0.5px; margin-bottom: 10px; }
.verdict-confidence { display: flex; align-items: center; gap: 12px; }
.verdict-confidence span { font-size: 13px; color: #94a3b8; white-space: nowrap; }
.detail-reasoning { font-size: 14px; color: #cbd5e1; line-height: 1.7; }
.red-flags { margin-top: 12px; background: #ef444410; border: 1px solid #ef444430; border-radius: 8px; padding: 12px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.rf-label { font-size: 12px; font-weight: 600; color: #ef4444; }
.rf-item { font-size: 12px; color: #fca5a5; background: #ef444420; padding: 2px 8px; border-radius: 4px; }
.detail-pending { border-top: 1px solid #1e293b; padding-top: 16px; }
.detail-pending p { font-size: 14px; color: #94a3b8; margin-bottom: 16px; }

/* Footer */
.footer { border-top: 1px solid #1e293b; padding: 24px; }
.footer-inner { max-width: 1200px; margin: 0 auto; display: flex; justify-content: center; gap: 12px; font-size: 13px; color: #64748b; flex-wrap: wrap; }

/* Responsive */
@media (max-width: 768px) {
  .nav-tabs { display: none; }
  .hero { padding: 48px 16px 40px; }
  .hero-stats { gap: 24px; }
  .grid { grid-template-columns: 1fr; }
  .about-grid { grid-template-columns: 1fr; }
  .modal { padding: 24px; margin: 12px; }
}
`;
