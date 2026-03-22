import { useEffect, useState } from "react";
import { MessageSquareText, RefreshCw } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { fetchSessionHistory, fetchSessions, readUserErrorMessage, type SessionHistoryEntry, type SessionSummary } from "../lib/api";

function formatTs(ts?: number): string {
  if (!Number.isFinite(ts)) {
    return "";
  }
  try {
    return new Date(ts as number).toLocaleString("zh-CN", {
      hour12: false,
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function roleLabel(role?: string): string {
  const key = String(role || "unknown").toLowerCase();
  if (["user", "human"].includes(key)) return "用户";
  if (["assistant", "ai", "bot", "agent"].includes(key)) return "助手";
  if (["system"].includes(key)) return "系统";
  return "其他";
}

export function SessionsPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeSessionKey, setActiveSessionKey] = useState("");
  const [history, setHistory] = useState<SessionHistoryEntry[]>([]);
  const [listMeta, setListMeta] = useState("未加载");
  const [detailMeta, setDetailMeta] = useState("");
  const [busy, setBusy] = useState(false);

  async function selectSession(sessionKey: string) {
    setActiveSessionKey(sessionKey);
    setDetailMeta("正在加载历史消息...");
    try {
      const nextHistory = await fetchSessionHistory(sessionKey);
      setHistory(nextHistory);
      setDetailMeta(`共 ${nextHistory.length} 条消息`);
    } catch (error) {
      setHistory([]);
      setDetailMeta(readUserErrorMessage(error, "加载失败"));
    }
  }

  async function loadSessionsList() {
    setBusy(true);
    setListMeta("正在刷新...");
    try {
      const nextSessions = await fetchSessions();
      setSessions(nextSessions);
      setListMeta(`共 ${nextSessions.length} 条`);
      const nextActiveKey = nextSessions.find((item) => item.key === activeSessionKey)?.key || nextSessions[0]?.key || "";
      if (nextActiveKey) {
        await selectSession(nextActiveKey);
      } else {
        setActiveSessionKey("");
        setHistory([]);
        setDetailMeta("");
      }
    } catch (error) {
      setSessions([]);
      setListMeta(readUserErrorMessage(error, "初始化失败"));
      setHistory([]);
      setDetailMeta("连接异常");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void loadSessionsList();
  }, []);

  const activeTitle = sessions.find((item) => item.key === activeSessionKey)?.title || activeSessionKey || "未选择会话";

  return (
    <div className="sessions-layout">
      <Card>
        <CardHeader>
          <CardTitle>所有会话</CardTitle>
          <CardDescription>{listMeta}</CardDescription>
        </CardHeader>
        <CardContent className="settings-stack">
          <Button variant="outline" size="sm" disabled={busy} onClick={() => void loadSessionsList()}>
            <RefreshCw size={14} />
            {busy ? "刷新中..." : "刷新"}
          </Button>
          <div className="stack-compact">
            {sessions.length > 0 ? (
              sessions.map((session) => (
                <button
                  key={session.key}
                  type="button"
                  className={`session-item${session.key === activeSessionKey ? " is-active" : ""}`}
                  onClick={() => void selectSession(session.key)}
                >
                  <div className="session-item-copy">
                    <strong>{session.key}</strong>
                    <span>{formatTs(session.updatedAtMs)}</span>
                  </div>
                  {session.active ? <span className="session-dot" /> : null}
                </button>
              ))
            ) : (
              <div className="meta-banner">暂无会话数据</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{activeTitle}</CardTitle>
          <CardDescription>{detailMeta}</CardDescription>
        </CardHeader>
        <CardContent className="settings-stack">
          {history.length > 0 ? (
            history.map((item, index) => (
              <div key={`${item.ts || index}-${index}`} className="message-card">
                <div className="message-head">
                  <span>{roleLabel(item.role)}</span>
                  <span>{formatTs(item.ts)}</span>
                </div>
                <div className="message-copy">
                  <MessageSquareText size={16} />
                  <p>{item.text || ""}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="meta-banner">暂无历史消息</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
