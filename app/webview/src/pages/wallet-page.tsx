import { useEffect, useState } from "react";
import { Coins, RefreshCw, Wallet } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import {
  fetchLocalWallet,
  fetchLocalWalletBalances,
  generateLocalWallet,
  readUserErrorMessage,
  type WalletBalances,
  type WalletSummary,
} from "../lib/api";

function formatCreatedAt(iso?: string): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function readChainBalance(balances: WalletBalances | null, chain: "eth" | "bsc" | "base") {
  const item = balances?.chains?.[chain] || {};
  const errors: string[] = [];
  if (typeof item.nativeError === "string" && item.nativeError) {
    errors.push("原生币余额暂时无法获取");
  }
  if (typeof item.usdtError === "string" && item.usdtError) {
    errors.push("USDT 余额暂时无法获取");
  }
  return {
    native: item.nativeBalance || "-",
    usdt: item.usdtBalance || "-",
    error: errors.join(" | "),
  };
}

export function WalletPage() {
  const [wallet, setWallet] = useState<WalletSummary>({});
  const [balances, setBalances] = useState<WalletBalances | null>(null);
  const [privateKey, setPrivateKey] = useState("");
  const [meta, setMeta] = useState("正在读取钱包状态...");
  const [busy, setBusy] = useState(false);

  async function loadWallet() {
    setMeta("正在读取钱包状态...");
    try {
      const nextWallet = await fetchLocalWallet();
      setWallet(nextWallet);
      if (nextWallet.exists) {
        const nextBalances = await fetchLocalWalletBalances();
        setBalances(nextBalances);
        setMeta("钱包已加载");
      } else {
        setBalances(null);
        setMeta("未生成");
      }
    } catch (error) {
      setMeta(readUserErrorMessage(error, "读取钱包失败"));
    }
  }

  useEffect(() => {
    void loadWallet();
  }, []);

  async function handleGenerate() {
    setBusy(true);
    setMeta("正在生成钱包...");
    try {
      const data = await generateLocalWallet();
      setWallet(data.wallet || {});
      setPrivateKey(typeof data.privateKey === "string" ? data.privateKey : "");
      const nextBalances = await fetchLocalWalletBalances();
      setBalances(nextBalances);
      setMeta("钱包已生成");
    } catch (error) {
      setMeta(readUserErrorMessage(error, "生成失败"));
      if (error instanceof Error && error.message.includes("已存在钱包")) {
        await loadWallet();
      }
    } finally {
      setBusy(false);
    }
  }

  const eth = readChainBalance(balances, "eth");
  const bsc = readChainBalance(balances, "bsc");
  const base = readChainBalance(balances, "base");

  return (
    <div className="settings-layout">
      <Card className="wallet-card-compact">
        <CardHeader className="wallet-card-compact-header">
          <CardTitle>本地钱包</CardTitle>
        </CardHeader>
        <CardContent className="wallet-card-compact-content">
          <div className="settings-actions settings-actions-start wallet-actions-compact">
            <Button disabled={busy || wallet.exists === true} onClick={() => void handleGenerate()}>
              <Wallet size={14} />
              {wallet.exists ? "已生成" : busy ? "生成中..." : "生成钱包"}
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => void loadWallet()}>
              <RefreshCw size={14} />
              刷新
            </Button>
          </div>
          <div className="wallet-mini-grid">
            <div className="info-tile">
              <span>钱包地址</span>
              <strong className="mono-break">{wallet.exists ? wallet.address || "-" : "未生成"}</strong>
            </div>
            <div className="info-tile">
              <span>创建时间</span>
              <strong>{wallet.exists ? formatCreatedAt(wallet.createdAt) : "-"}</strong>
            </div>
          </div>
          {privateKey ? (
            <label className="input-group">
              <span>本次生成私钥</span>
              <textarea className="field-textarea field-textarea-short" readOnly value={privateKey} />
            </label>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>余额</CardTitle>
          <CardDescription>{balances?.updatedAt ? `更新时间: ${formatCreatedAt(balances.updatedAt)}` : "未查询"}</CardDescription>
        </CardHeader>
        <CardContent className="settings-stack">
          <div className="triple-grid">
            {[
              { key: "ETH 主网", nativeLabel: "ETH", value: eth },
              { key: "BSC", nativeLabel: "BNB", value: bsc },
              { key: "Base", nativeLabel: "ETH", value: base },
            ].map((item) => (
              <div key={item.key} className="field-card field-card-vertical">
                <div className="migration-item">
                  <Coins size={18} />
                  <div>
                    <strong>{item.key}</strong>
                    {item.value.error ? <p>{item.value.error}</p> : null}
                  </div>
                </div>
                <div className="stack-compact">
                  <div className="metric-row">
                    <div>
                      <strong>{item.nativeLabel}</strong>
                    </div>
                    <span className="badge-soft">{item.value.native}</span>
                  </div>
                  <div className="metric-row">
                    <div>
                      <strong>USDT</strong>
                    </div>
                    <span className="badge-soft">{item.value.usdt}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="meta-banner">{meta}</div>
    </div>
  );
}
