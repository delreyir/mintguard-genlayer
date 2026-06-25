"use client";
import { useState, useEffect, useCallback } from "react";
import { CONTRACT_ADDRESS, connectWallet, readClient, shortAddr, type WalletState } from "@/lib/genlayer";
import { TransactionStatus } from "genlayer-js/types";

type Check = { id: string; requester: string; image_url: string; title: string; creator_claim: string; fee: string; status: number; report: string; };
const catColor = (c: string) => ({ original: "#1a7d4f", derivative: "#b8860b", copy: "#a8324a", ai_generated: "#6b4ba8", suspicious: "#c2410c" }[c] || "#8a7a5a");
const catLabel = (c: string) => ({ original: "Original", derivative: "Derivative", copy: "Copy", ai_generated: "AI Generated", suspicious: "Suspicious" }[c] || c);

export default function Home() {
  const [wallet, setWallet] = useState<WalletState>({ address: null, client: null });
  const [checks, setChecks] = useState<Check[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<"none" | "submit" | "how">("none");
  const [selected, setSelected] = useState<Check | null>(null);
  const [form, setForm] = useState({ url: "", title: "", creator: "", fee: "1" });
  const [tx, setTx] = useState("");

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
    setTx("Connecting wallet…");
    try {
      const w = await connectWallet();
      setWallet(w);
      setTx("");
    } catch (e: any) {
      setTx(e.message);
    }
  }

  async function send(fn: string, args: any[], value?: bigint) {
    if (!wallet.client) { setTx("Connect your wallet first"); return; }
    setLoading(true); setTx("Submitting transaction…");
    try {
      const hash = await wallet.client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: fn,
        args,
        value: value ?? BigInt(0),
      });
      setTx("Waiting for consensus…");
      const receipt = await wallet.client.waitForTransactionReceipt({
        hash,
        status: TransactionStatus.ACCEPTED,
      });
      // Check if the transaction was canceled (consensus failure)
      if (receipt && (receipt as any).status === TransactionStatus.CANCELED) {
        setTx("⚠ Consensus failed: The AI validators independently analyzed the work but could not agree on a verdict. This can happen with ambiguous or complex content. Please try again.");
        setLoading(false);
        return;
      }
      setTx("✓ Transaction accepted!");
      await load();
      setTimeout(() => setTx(""), 3000);
      setSelected(null);
      setModal("none");
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (/consensus/i.test(msg) || /abort/i.test(msg) || /canceled/i.test(msg) || /timeout/i.test(msg) || /CANCELED/i.test(msg)) {
        setTx("⚠ Verification failed: The AI panel could not reach consensus. Validators independently analyzed the work but disagreed on the result. This can happen with ambiguous content. Please try again.");
      } else if (/insufficient funds/i.test(msg)) {
        setTx("⚠ Insufficient balance. Get testnet GEN from the faucet: https://testnet-faucet.genlayer.foundation/");
      } else if (/user rejected/i.test(msg) || /rejected/i.test(msg)) {
        setTx("Transaction rejected by user.");
      } else if (/revert/i.test(msg) || /UserError/i.test(msg)) {
        setTx(`Contract error: ${msg}`);
      } else {
        setTx(`Transaction failed: ${msg}`);
      }
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f4efe4", color: "#2b2419", fontFamily: "Georgia, 'Times New Roman', serif" }}>
      {/* Top bar */}
      <div style={{ borderBottom: "1px solid #c9bfa3", background: "#efe8d8" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto", padding: "14px 28px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ letterSpacing: 4, fontSize: 12, color: "#8a7a5a", textTransform: "uppercase" }}>MintGuard · Deployed on GenLayer Testnet Bradbury</span>
          {wallet.address ? (
            <span style={{ fontSize: 13, color: "#7a3b2e", fontStyle: "italic" }}>◉ {shortAddr(wallet.address)}</span>
          ) : (
            <button onClick={handleConnect} style={{ width: 120, height: 40, borderRadius: 999, border: "2px solid #7a3b2e", background: "radial-gradient(circle,#9b4a3a,#7a3b2e)", color: "#f4efe4", cursor: "pointer", fontFamily: "Georgia,serif", fontSize: 12, letterSpacing: 1, boxShadow: "0 2px 6px rgba(122,59,46,0.4)" }}>CONNECT</button>
          )}
        </div>
      </div>

      {/* Header */}
      <header style={{ textAlign: "center", padding: "54px 20px 30px" }}>
        <h1 style={{ margin: 0, fontSize: 56, fontWeight: 400, letterSpacing: 2 }}>MintGuard</h1>
        <div style={{ width: 80, height: 1, background: "#7a3b2e", margin: "18px auto" }} />
        <p style={{ fontStyle: "italic", color: "#6a5d42", fontSize: 17, maxWidth: 600, margin: "0 auto" }}>
          Decentralized NFT authenticity verification powered by GenLayer AI consensus. Multiple AI validators independently analyze artwork to detect copies, fakes, and undisclosed AI generation.
        </p>
        <div style={{ marginTop: 26, display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={() => setModal("submit")} style={headerBtn}>Submit a Work</button>
          <button onClick={() => setModal("how")} style={{ ...headerBtn, background: "transparent", color: "#2b2419", border: "1px solid #2b2419" }}>How It Works</button>
        </div>
      </header>

      {tx && <p style={{ textAlign: "center", color: "#7a3b2e", fontStyle: "italic", padding: "0 20px", maxWidth: 700, margin: "10px auto" }}>{tx}</p>}

      {/* Technical details section */}
      <section style={{ maxWidth: 800, margin: "10px auto 0", padding: "0 20px" }}>
        <div style={{ background: "#fffdf8", border: "1px solid #d8cdb0", borderTop: "4px solid #7a3b2e", padding: "26px 30px" }}>
          <h2 style={{ fontWeight: 400, fontSize: 22, marginTop: 0 }}>About MintGuard</h2>
          <p style={{ color: "#4a4234", lineHeight: 1.7, fontSize: 15 }}>
            MintGuard is an on-chain authenticity registry for digital art and NFTs built on <strong>GenLayer</strong>. It leverages GenLayer&apos;s <em>Optimistic Democracy</em> consensus mechanism where multiple independent AI validators analyze each submitted work.
          </p>

          <h3 style={{ fontWeight: 400, fontSize: 18, color: "#7a3b2e", marginBottom: 8 }}>How AI Consensus Works</h3>
          <p style={{ color: "#4a4234", lineHeight: 1.7, fontSize: 15 }}>
            When you submit a work for verification, the contract triggers a non-deterministic operation. A <strong>leader validator</strong> fetches the artwork page, runs an LLM analysis, and produces a structured report. Then independent <strong>validator nodes</strong> repeat the same analysis and compare their results. If the validators agree on the core verdict (originality, category, and confidence within ±2), the result is accepted on-chain. If they disagree, the transaction is canceled — ensuring only high-confidence verdicts are recorded.
          </p>

          <h3 style={{ fontWeight: 400, fontSize: 18, color: "#7a3b2e", marginBottom: 8 }}>Technical Stack</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginTop: 10 }}>
            {[
              ["Intelligent Contract", "Python on GenVM with non-deterministic LLM calls and web access"],
              ["Consensus", "Custom validator function (run_nondet_unsafe) with normalized output comparison"],
              ["Frontend", "Next.js + GenLayer JS SDK (genlayer-js)"],
              ["Network", "GenLayer Testnet Bradbury (real AI workloads)"],
              ["Wallet", "MetaMask / Rabby via client.connect()"],
            ].map(([label, desc]) => (
              <div key={label} style={{ padding: "12px 14px", background: "#faf6ec", border: "1px solid #e8e0cc", borderRadius: 4 }}>
                <div style={{ fontSize: 12, color: "#7a3b2e", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>{label}</div>
                <div style={{ fontSize: 13, color: "#4a4234", marginTop: 4 }}>{desc}</div>
              </div>
            ))}
          </div>

          <h3 style={{ fontWeight: 400, fontSize: 18, color: "#7a3b2e", marginBottom: 8, marginTop: 20 }}>Contract Address</h3>
          <p style={{ fontFamily: "monospace", fontSize: 13, color: "#4a4234", background: "#faf6ec", padding: "8px 12px", border: "1px solid #e8e0cc", borderRadius: 4, wordBreak: "break-all" }}>
            {CONTRACT_ADDRESS}
          </p>
        </div>
      </section>

      {/* Gallery */}
      <main style={{ maxWidth: 800, margin: "0 auto", padding: "30px 20px 90px" }}>
        <h2 style={{ fontWeight: 400, fontSize: 24, textAlign: "center", color: "#2b2419" }}>Verification Registry</h2>
        {checks.length === 0 && <p style={{ textAlign: "center", color: "#9a8e72", fontStyle: "italic" }}>No works submitted yet. Be the first to request an authenticity check.</p>}
        {checks.map(c => {
          const r = c.report ? JSON.parse(c.report) : null;
          return (
            <article key={c.id} onClick={() => setSelected(c)} style={{ background: "#fffdf8", border: "1px solid #d8cdb0", borderRadius: 2, padding: "28px 30px", marginBottom: 20, cursor: "pointer", boxShadow: "0 4px 12px rgba(43,36,25,0.06)", position: "relative", transition: "box-shadow 0.2s" }}>
              <div style={{ position: "absolute", top: -1, left: 30, right: 30, height: 4, background: "#7a3b2e" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: 12, letterSpacing: 2, color: "#9a8e72" }}>ENTRY №{String(c.id).padStart(3, "0")}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: c.status === 0 ? "#9a8e72" : catColor(r?.category || ""), textTransform: "uppercase", letterSpacing: 1 }}>
                  {c.status === 0 ? "⏳ Pending Review" : r ? catLabel(r.category) : ""}
                </span>
              </div>
              <h2 style={{ fontWeight: 400, fontSize: 24, margin: "10px 0 6px" }}>{c.title}</h2>
              <p style={{ fontStyle: "italic", color: "#6a5d42", margin: 0, fontSize: 14 }}>Creator claim: {c.creator_claim}</p>
              {r && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: "flex", gap: 16, fontSize: 13, color: "#6a5d42" }}>
                    <span>Confidence: <strong>{r.confidence}/10</strong></span>
                    <span>{r.is_original ? "✦ Authenticated" : "✕ Disputed"}</span>
                  </div>
                  <p style={{ marginTop: 8, color: "#4a4234", lineHeight: 1.6, fontSize: 14 }}>{r.reasoning}</p>
                </div>
              )}
            </article>
          );
        })}
      </main>

      {/* Modals */}
      {(selected || modal === "submit" || modal === "how") && (
        <div onClick={() => { setSelected(null); setModal("none"); }} style={{ position: "fixed", inset: 0, background: "rgba(43,36,25,0.55)", display: "grid", placeItems: "center", padding: 20, zIndex: 100 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fffdf8", maxWidth: 600, width: "100%", padding: "34px 38px", borderRadius: 4, borderTop: "5px solid #7a3b2e", maxHeight: "85vh", overflowY: "auto" }}>

            {modal === "how" ? (
              <>
                <h2 style={{ fontWeight: 400, marginTop: 0 }}>How MintGuard Works</h2>
                <ol style={{ margin: "14px 0 0", paddingLeft: 0, listStyle: "none", counterReset: "s" }}>
                  {[
                    "Connect your EVM wallet (MetaMask, Rabby). The app switches your wallet to GenLayer Testnet Bradbury automatically.",
                    "Submit a work: provide the artwork URL, title, claimed creator, and a small appraisal fee (in GEN tokens).",
                    "Click 'Verify' to convene the AI panel. This triggers a non-deterministic transaction where multiple AI validators independently analyze the work.",
                    "The leader validator fetches the artwork page, sends it to an LLM with a strict JSON-only prompt, and produces a normalized report.",
                    "Independent validators repeat the analysis. If they agree on is_original, category, and confidence (±2), the verdict is recorded on-chain.",
                    "If validators disagree (consensus failure), the transaction is canceled and you receive a descriptive error message — not a stuck 'Under review' state.",
                    "View the on-chain verdict: Original, Derivative, Copy, AI Generated, or Suspicious — with confidence score and reasoning.",
                  ].map((t, i) => (
                    <li key={i} style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: i < 6 ? "1px dotted #d8cdb0" : "none" }}>
                      <span style={{ fontFamily: "Georgia,serif", color: "#7a3b2e", fontWeight: 700, minWidth: 22 }}>{i + 1}.</span>
                      <span style={{ color: "#4a4234", fontSize: 14, lineHeight: 1.6 }}>{t}</span>
                    </li>
                  ))}
                </ol>
                <div style={{ marginTop: 20, padding: "14px 16px", background: "#faf6ec", border: "1px solid #e8e0cc", borderRadius: 4 }}>
                  <div style={{ fontSize: 12, color: "#7a3b2e", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Get Testnet Tokens</div>
                  <p style={{ fontSize: 13, color: "#4a4234", margin: 0 }}>
                    You need GEN tokens to pay for verification. Get free testnet tokens from the <a href="https://testnet-faucet.genlayer.foundation/" target="_blank" rel="noopener" style={{ color: "#7a3b2e" }}>GenLayer Faucet</a>.
                  </p>
                </div>
              </>
            ) : modal === "submit" ? (
              <form onSubmit={e => { e.preventDefault(); send("request_check", [form.url, form.title, form.creator], BigInt(form.fee || "0") * BigInt(10 ** 18)); }}>
                <h2 style={{ fontWeight: 400, marginTop: 0 }}>Submit a Work for Verification</h2>
                <p style={{ fontSize: 14, color: "#6a5d42", fontStyle: "italic" }}>Provide the artwork details below. A fee in GEN tokens is required to fund the AI verification.</p>
                <label style={labelStyle}>Artwork URL</label>
                <input placeholder="https://opensea.io/assets/..." value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} required style={inp} />
                <label style={labelStyle}>Title</label>
                <input placeholder="Name of the artwork" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required style={inp} />
                <label style={labelStyle}>Creator Claim</label>
                <input placeholder="Who claims to be the creator" value={form.creator} onChange={e => setForm({ ...form, creator: e.target.value })} required style={inp} />
                <label style={labelStyle}>Appraisal Fee (GEN)</label>
                <input placeholder="1" type="number" min="1" value={form.fee} onChange={e => setForm({ ...form, fee: e.target.value })} required style={inp} />
                <button disabled={loading} style={modalBtn}>{loading ? "Processing…" : "Submit for Verification"}</button>
              </form>
            ) : selected && (() => {
              const r = selected.report ? JSON.parse(selected.report) : null;
              return (
                <>
                  <span style={{ fontSize: 12, letterSpacing: 2, color: "#9a8e72" }}>ENTRY №{String(selected.id).padStart(3, "0")}</span>
                  <h2 style={{ fontWeight: 400, margin: "8px 0" }}>{selected.title}</h2>
                  <p style={{ fontStyle: "italic", color: "#6a5d42" }}>Creator claim: {selected.creator_claim}</p>
                  <p style={{ fontSize: 13 }}><a href={selected.image_url} target="_blank" rel="noopener" style={{ color: "#7a3b2e", wordBreak: "break-all" }}>{selected.image_url}</a></p>
                  <p style={{ fontSize: 12, color: "#9a8e72" }}>Requester: {shortAddr(selected.requester)}</p>
                  {r ? (
                    <div style={{ marginTop: 16, borderTop: "1px solid #d8cdb0", paddingTop: 16 }}>
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{ padding: "4px 12px", background: catColor(r.category), color: "#fff", borderRadius: 3, fontSize: 12, letterSpacing: 1, textTransform: "uppercase" }}>
                          {r.is_original ? "✦ Authenticated" : "✕ Disputed"} · {catLabel(r.category)}
                        </span>
                        <span style={{ fontSize: 13, color: "#6a5d42" }}>Confidence: {r.confidence}/10</span>
                      </div>
                      <p style={{ lineHeight: 1.7, color: "#4a4234", marginTop: 12 }}>{r.reasoning}</p>
                      {r.red_flags?.length > 0 && (
                        <div style={{ marginTop: 8, padding: "8px 12px", background: "#fef2f0", border: "1px solid #f5c6c0", borderRadius: 4 }}>
                          <span style={{ fontSize: 12, color: "#c2410c", fontWeight: 700 }}>⚑ Red Flags:</span>
                          <span style={{ fontSize: 13, color: "#c2410c", marginLeft: 8 }}>{r.red_flags.join(" · ")}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ marginTop: 16, borderTop: "1px solid #d8cdb0", paddingTop: 16 }}>
                      <p style={{ fontSize: 14, color: "#6a5d42", fontStyle: "italic" }}>This work has not been verified yet. Click below to convene the AI panel.</p>
                      <button onClick={() => send("verify_originality", [selected.id])} disabled={loading} style={modalBtn}>
                        {loading ? "Verifying… (waiting for AI consensus)" : "Convene AI Panel for Verification"}
                      </button>
                    </div>
                  )}
                </>
              );
            })()}
            <button onClick={() => { setSelected(null); setModal("none"); }} style={{ marginTop: 16, background: "none", border: "none", color: "#9a8e72", cursor: "pointer", fontStyle: "italic", fontFamily: "Georgia,serif", fontSize: 14 }}>close</button>
          </div>
        </div>
      )}

      <footer style={{ textAlign: "center", color: "#9a8e72", fontSize: 12, padding: "0 0 40px", fontStyle: "italic" }}>
        Built on GenLayer · AI Consensus Verification · <a href="https://docs.genlayer.com" target="_blank" rel="noopener" style={{ color: "#7a3b2e" }}>Documentation</a>
      </footer>
      <style>{`body{margin:0} a:hover{opacity:0.8}`}</style>
    </div>
  );
}

const headerBtn: React.CSSProperties = { padding: "12px 30px", background: "#2b2419", color: "#f4efe4", border: "none", letterSpacing: 2, fontSize: 13, cursor: "pointer", fontFamily: "Georgia,serif", textTransform: "uppercase", borderRadius: 2 };
const inp: React.CSSProperties = { padding: 12, border: "1px solid #d8cdb0", background: "#faf6ec", color: "#2b2419", fontSize: 14, width: "100%", boxSizing: "border-box", marginBottom: 12, fontFamily: "Georgia,serif", borderRadius: 2 };
const modalBtn: React.CSSProperties = { padding: "12px 22px", background: "#2b2419", color: "#f4efe4", border: "none", letterSpacing: 1, cursor: "pointer", fontFamily: "Georgia,serif", textTransform: "uppercase", fontSize: 13, marginTop: 8, borderRadius: 2, width: "100%" };
const labelStyle: React.CSSProperties = { fontSize: 12, color: "#7a3b2e", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 4 };
