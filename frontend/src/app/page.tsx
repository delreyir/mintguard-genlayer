"use client";
import { useState, useEffect, useCallback } from "react";
import { CONTRACT_ADDRESS, connectWallet, readClient, shortAddr, type WalletState } from "@/lib/genlayer";
import { TransactionStatus } from "genlayer-js/types";

type Check = { id: string; requester: string; image_url: string; title: string; creator_claim: string; fee: string; status: number; report: string; };
const catColor = (c: string) => ({ original: "#1a7d4f", derivative: "#b8860b", copy: "#a8324a", ai_generated: "#6b4ba8", suspicious: "#c2410c" }[c] || "#8a7a5a");

export default function Home() {
  const [wallet, setWallet] = useState<WalletState>({ address: null, client: null });
  const [checks, setChecks] = useState<Check[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<"none" | "submit">("none");
  const [selected, setSelected] = useState<Check | null>(null);
  const [form, setForm] = useState({ url: "", title: "", creator: "", fee: "1" });
  const [tx, setTx] = useState("");

  const load = useCallback(async () => {
    try {
      const rc = readClient();
      const count = Number(await rc.readContract({ address: CONTRACT_ADDRESS, functionName: "get_check_count", args: [] }));
      const out: Check[] = [];
      for (let i = 1; i <= count; i++) { const raw = await rc.readContract({ address: CONTRACT_ADDRESS, functionName: "get_check", args: [String(i)] }); out.push(JSON.parse(raw as string)); }
      setChecks(out.reverse());
    } catch (e) { console.error(e); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function handleConnect() {
    setTx("Connecting…");
    try { const w = await connectWallet(); setWallet(w); setTx(""); } catch (e: any) { setTx(e.message); }
  }
  async function send(fn: string, args: any[], value?: bigint) {
    if (!wallet.client) { setTx("Connect your wallet first"); return; }
    setLoading(true); setTx("Submitting to the panel…");
    try {
      const hash = await wallet.client.writeContract({ address: CONTRACT_ADDRESS, functionName: fn, args, value: value ?? BigInt(0) });
      const receipt = await wallet.client.waitForTransactionReceipt({ hash, status: TransactionStatus.ACCEPTED });
      // Check if the transaction was finalized successfully
      if (receipt && (receipt as any).status === TransactionStatus.CANCELED) {
        setTx("Transaction was canceled. The AI panel could not reach consensus — validators disagreed on the analysis. Please try again later.");
        setLoading(false);
        return;
      }
      setTx(""); await load(); setSelected(null); setModal("none");
    } catch (e: any) {
      // Handle consensus failure / transaction abort specifically
      const msg = e?.message || String(e);
      if (/consensus/i.test(msg) || /abort/i.test(msg) || /canceled/i.test(msg) || /timeout/i.test(msg)) {
        setTx("Verification failed: The AI panel could not reach consensus. Validators independently analyzed the work but disagreed on the result. This can happen with ambiguous content. Please try again.");
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
      {/* Top brass bar */}
      <div style={{ borderBottom: "1px solid #c9bfa3", background: "#efe8d8" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto", padding: "14px 28px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ letterSpacing: 4, fontSize: 12, color: "#8a7a5a", textTransform: "uppercase" }}>Est. on GenLayer · The Authenticity Authority</span>
          {/* Wax-seal style connect */}
          {wallet.address ? (
            <span style={{ fontSize: 13, color: "#7a3b2e", fontStyle: "italic" }}>◉ Patron {shortAddr(wallet.address)}</span>
          ) : (
            <button onClick={handleConnect} style={{ width: 96, height: 40, borderRadius: 999, border: "2px solid #7a3b2e", background: "radial-gradient(circle,#9b4a3a,#7a3b2e)", color: "#f4efe4", cursor: "pointer", fontFamily: "Georgia,serif", fontSize: 12, letterSpacing: 1, boxShadow: "0 2px 6px rgba(122,59,46,0.4)" }}>SEAL IN</button>
          )}
        </div>
      </div>

      {/* Masthead */}
      <header style={{ textAlign: "center", padding: "54px 20px 30px" }}>
        <h1 style={{ margin: 0, fontSize: 56, fontWeight: 400, letterSpacing: 2 }}>MintGuard</h1>
        <div style={{ width: 80, height: 1, background: "#7a3b2e", margin: "18px auto" }} />
        <p style={{ fontStyle: "italic", color: "#6a5d42", fontSize: 17, maxWidth: 540, margin: "0 auto" }}>A curated registry of verified digital works, each authenticated by an independent panel of AI examiners.</p>
        <button onClick={() => setModal("submit")} style={{ marginTop: 26, padding: "12px 30px", background: "#2b2419", color: "#f4efe4", border: "none", letterSpacing: 2, fontSize: 13, cursor: "pointer", fontFamily: "Georgia,serif", textTransform: "uppercase" }}>Submit a Work</button>
      </header>

      {tx && <p style={{ textAlign: "center", color: "#7a3b2e", fontStyle: "italic" }}>{tx}</p>}

      {/* About + how it works */}
      <section style={{ maxWidth: 720, margin: "10px auto 0", padding: "0 20px" }}>
        <div style={{ background: "#fffdf8", border: "1px solid #d8cdb0", borderTop: "4px solid #7a3b2e", padding: "26px 30px" }}>
          <h2 style={{ fontWeight: 400, fontSize: 24, marginTop: 0 }}>What MintGuard does</h2>
          <p style={{ fontStyle: "italic", color: "#6a5d42", lineHeight: 1.7 }}>MintGuard is an authenticity registry for digital art and NFTs. Submit any artwork and a panel of independent AI examiners inspects it for originality — distinguishing genuine pieces from copies, derivatives, and undisclosed AI generation — then records the verdict permanently on-chain.</p>
          <ol style={{ margin: "14px 0 0", paddingLeft: 0, listStyle: "none", counterReset: "s" }}>
            {["Connect your wallet (top right).", "Submit a work — its URL, title, and the claimed creator, with a small appraisal fee.", "Convene the AI panel to examine the piece.", "Receive an on-chain verdict: authentic, derivative, copy, or AI-generated — with confidence and reasoning."].map((t, i) => (
              <li key={i} style={{ display: "flex", gap: 12, padding: "7px 0", borderBottom: i < 3 ? "1px dotted #d8cdb0" : "none" }}>
                <span style={{ fontFamily: "Georgia,serif", color: "#7a3b2e", fontWeight: 700, minWidth: 22 }}>{i + 1}.</span>
                <span style={{ color: "#4a4234", fontSize: 15 }}>{t}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Gallery wall — centered single column of framed placards */}
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "20px 20px 90px" }}>
        {checks.length === 0 && <p style={{ textAlign: "center", color: "#9a8e72", fontStyle: "italic" }}>The gallery awaits its first acquisition.</p>}
        {checks.map(c => {
          const r = c.report ? JSON.parse(c.report) : null;
          return (
            <article key={c.id} onClick={() => setSelected(c)} style={{ background: "#fffdf8", border: "1px solid #d8cdb0", borderRadius: 2, padding: "28px 30px", marginBottom: 26, cursor: "pointer", boxShadow: "0 6px 18px rgba(43,36,25,0.06)", position: "relative" }}>
              <div style={{ position: "absolute", top: -1, left: 30, right: 30, height: 4, background: "#7a3b2e" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: 12, letterSpacing: 2, color: "#9a8e72" }}>CAT. №{String(c.id).padStart(3, "0")}</span>
                <span style={{ fontSize: 12, color: c.status === 0 ? "#9a8e72" : catColor(r?.category || "") }}>{c.status === 0 ? "Under review" : r ? r.category.replace("_", " ") : ""}</span>
              </div>
              <h2 style={{ fontWeight: 400, fontSize: 26, margin: "10px 0 6px" }}>{c.title}</h2>
              <p style={{ fontStyle: "italic", color: "#6a5d42", margin: 0 }}>attributed to {c.creator_claim}</p>
              {r && <p style={{ marginTop: 14, color: "#4a4234", lineHeight: 1.7 }}>{r.is_original ? "✦ " : "✕ "}{r.reasoning}</p>}
            </article>
          );
        })}
      </main>

      {/* Detail / submit modal */}
      {(selected || modal === "submit") && (
        <div onClick={() => { setSelected(null); setModal("none"); }} style={{ position: "fixed", inset: 0, background: "rgba(43,36,25,0.55)", display: "grid", placeItems: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fffdf8", maxWidth: 560, width: "100%", padding: "34px 38px", borderRadius: 2, borderTop: "5px solid #7a3b2e", maxHeight: "85vh", overflowY: "auto" }}>
            {modal === "submit" ? (
              <form onSubmit={e => { e.preventDefault(); send("request_check", [form.url, form.title, form.creator], BigInt(form.fee || "0") * BigInt(10 ** 18)); }}>
                <h2 style={{ fontWeight: 400, marginTop: 0 }}>Submit a Work for Appraisal</h2>
                <input placeholder="Artwork URL" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} required style={inp} />
                <input placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required style={inp} />
                <input placeholder="Creator claim" value={form.creator} onChange={e => setForm({ ...form, creator: e.target.value })} required style={inp} />
                <input placeholder="Appraisal fee (GEN)" type="number" min="1" value={form.fee} onChange={e => setForm({ ...form, fee: e.target.value })} required style={inp} />
                <button disabled={loading} style={modalBtn}>Submit for Verification</button>
              </form>
            ) : selected && (() => {
              const r = selected.report ? JSON.parse(selected.report) : null;
              return (
                <>
                  <span style={{ fontSize: 12, letterSpacing: 2, color: "#9a8e72" }}>CATALOGUE №{String(selected.id).padStart(3, "0")}</span>
                  <h2 style={{ fontWeight: 400, margin: "8px 0" }}>{selected.title}</h2>
                  <p style={{ fontStyle: "italic", color: "#6a5d42" }}>attributed to {selected.creator_claim}</p>
                  <p style={{ fontSize: 13 }}><a href={selected.image_url} style={{ color: "#7a3b2e" }}>{selected.image_url}</a></p>
                  {r ? (
                    <div style={{ marginTop: 16, borderTop: "1px solid #d8cdb0", paddingTop: 16 }}>
                      <div style={{ fontSize: 13, color: catColor(r.category), letterSpacing: 1, textTransform: "uppercase" }}>{r.is_original ? "✦ Authenticated" : "✕ Disputed"} · {r.category.replace("_", " ")} · {r.confidence}/10</div>
                      <p style={{ lineHeight: 1.7, color: "#4a4234" }}>{r.reasoning}</p>
                      {r.red_flags?.length > 0 && <p style={{ color: "#c2410c", fontSize: 13 }}>⚑ {r.red_flags.join(" · ")}</p>}
                    </div>
                  ) : <button onClick={() => send("verify_originality", [selected.id])} disabled={loading} style={modalBtn}>Convene the AI Panel</button>}
                </>
              );
            })()}
            <button onClick={() => { setSelected(null); setModal("none"); }} style={{ marginTop: 14, background: "none", border: "none", color: "#9a8e72", cursor: "pointer", fontStyle: "italic", fontFamily: "Georgia,serif" }}>close</button>
          </div>
        </div>
      )}

      <footer style={{ textAlign: "center", color: "#9a8e72", fontSize: 12, padding: "0 0 40px", fontStyle: "italic" }}>Verified by GenLayer AI consensus · {shortAddr(CONTRACT_ADDRESS)}</footer>
      <style>{`body{margin:0}`}</style>
    </div>
  );
}

const inp: React.CSSProperties = { padding: 12, border: "1px solid #d8cdb0", background: "#faf6ec", color: "#2b2419", fontSize: 14, width: "100%", boxSizing: "border-box", marginBottom: 10, fontFamily: "Georgia,serif" };
const modalBtn: React.CSSProperties = { padding: "12px 22px", background: "#2b2419", color: "#f4efe4", border: "none", letterSpacing: 1, cursor: "pointer", fontFamily: "Georgia,serif", textTransform: "uppercase", fontSize: 13, marginTop: 6 };
