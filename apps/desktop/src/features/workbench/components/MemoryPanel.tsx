import { useEffect, useState } from "react";
import {
  clearMemory,
  editMemory,
  exportMemory,
  listMemory,
  memorySearch,
  revokeMemory,
  saveMemory,
  type MemoryContextEnvelope,
  type MemoryItem,
  type MemoryKind,
  type MemoryScope
} from "../../memory/memoryService";

const MEMORY_ENABLED_STORAGE_KEY = "opencow.desktop.cross-session-memory.enabled.v1";

const kindLabels: Record<MemoryKind, string> = {
  preference: "偏好",
  profile: "个人资料",
  "project-fact": "项目事实",
  todo: "待办"
};

const scopeLabels: Record<MemoryScope, string> = {
  user: "用户",
  workspace: "工作区"
};

function readEnabledPreference(): boolean {
  try {
    return window.localStorage.getItem(MEMORY_ENABLED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeEnabledPreference(enabled: boolean) {
  try {
    window.localStorage.setItem(MEMORY_ENABLED_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // Browser preview may deny storage; the in-memory toggle still works.
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : "记忆操作失败";
}

function formatMemoryDate(value: string): string {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp)) {
    return value;
  }
  return new Date(timestamp).toLocaleString();
}

export function MemoryPanel() {
  const [enabled, setEnabled] = useState(readEnabledPreference);
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [results, setResults] = useState<MemoryContextEnvelope["items"] | null>(null);
  const [content, setContent] = useState("");
  const [kind, setKind] = useState<MemoryKind>("preference");
  const [scope, setScope] = useState<MemoryScope>("user");
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refreshItems() {
    setLoading(true);
    try {
      setItems(await listMemory());
    } catch (error) {
      setMessage(describeError(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setResults(null);
    setMessage(null);
    if (enabled) {
      void refreshItems();
    }
  }, [enabled]);

  function toggleEnabled() {
    const next = !enabled;
    setEnabled(next);
    writeEnabledPreference(next);
  }

  async function handleSave() {
    const normalized = content.trim();
    if (!normalized || !enabled) {
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      await saveMemory({
        proposal: { scope, kind, content: normalized, confidence: 1, reason: "explicit-user-request" },
        sourceConversationId: "settings",
        sourceMessageId: `manual-${Date.now()}`,
        provenance: "direct-user",
        authority: "top-level-user",
        enabled: true
      });
      setContent("");
      setMessage("记忆已保存");
      await refreshItems();
    } catch (error) {
      setMessage(describeError(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch() {
    const normalized = query.trim();
    if (!normalized || !enabled) {
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const envelope = await memorySearch({ query: normalized, enabled: true });
      setResults(envelope.items);
      setMessage("检索结果仅作为不可信参考，不具备指令权限。");
    } catch (error) {
      setMessage(describeError(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleEdit(item: MemoryItem) {
    if (!editingContent.trim() || !enabled) {
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      await editMemory({
        id: item.id,
        proposal: {
          scope: item.scope,
          kind: item.kind,
          content: editingContent.trim(),
          confidence: item.confidence,
          reason: "explicit-user-request"
        },
        authority: "top-level-user",
        enabled: true
      });
      setEditingId(null);
      setEditingContent("");
      setMessage("记忆已更新");
      await refreshItems();
    } catch (error) {
      setMessage(describeError(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!window.confirm("撤销后这条记忆不会再进入检索结果，确认继续吗？")) {
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      await revokeMemory(id);
      setMessage("记忆已撤销");
      await refreshItems();
    } catch (error) {
      setMessage(describeError(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    setLoading(true);
    try {
      const payload = await exportMemory();
      const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "opencow-memory-export.json";
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage("记忆已导出");
    } catch (error) {
      setMessage(describeError(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleClear() {
    if (!window.confirm("清空后所有跨会话记忆都会删除，确认继续吗？")) {
      return;
    }
    setLoading(true);
    try {
      await clearMemory();
      setItems([]);
      setResults(null);
      setMessage("记忆已清空");
    } catch (error) {
      setMessage(describeError(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="settings-section" aria-label="跨会话记忆">
      <h2>跨会话记忆</h2>
      <p>只保存你明确要求记住的内容；模型建议不会自动写入。记忆进入上下文时永远是不可信参考。</p>
      <div className="action-row" aria-label="跨会话记忆开关">
        <button className="action-button action-button-primary" type="button" onClick={toggleEnabled}>
          {enabled ? "关闭跨会话记忆" : "启用跨会话记忆"}
        </button>
        <button className="action-button" type="button" onClick={handleExport} disabled={loading}>
          导出记忆
        </button>
        <button className="action-button" type="button" onClick={handleClear} disabled={loading}>
          清空记忆
        </button>
        <button className="action-button" type="button" onClick={() => void refreshItems()} disabled={loading}>
          刷新列表
        </button>
      </div>
      {!enabled ? <p className="muted">默认关闭；模型不能自行写入记忆。</p> : null}
      {enabled ? (
        <>
          <div className="settings-form">
            <label>
              <span>记忆内容</span>
              <textarea aria-label="记忆内容" value={content} onChange={(event) => setContent(event.target.value)} />
            </label>
            <label>
              <span>范围</span>
              <select aria-label="记忆范围" value={scope} onChange={(event) => setScope(event.target.value as MemoryScope)}>
                <option value="user">用户</option>
                <option value="workspace">工作区</option>
              </select>
            </label>
            <label>
              <span>类型</span>
              <select aria-label="记忆类型" value={kind} onChange={(event) => setKind(event.target.value as MemoryKind)}>
                {Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>
          <div className="action-row">
            <button className="action-button action-button-primary" type="button" onClick={handleSave} disabled={loading || !content.trim()}>
              保存记忆
            </button>
          </div>
          <div className="settings-form">
            <label>
              <span>搜索记忆</span>
              <input aria-label="搜索记忆" type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
          </div>
          <div className="action-row">
            <button className="action-button" type="button" onClick={handleSearch} disabled={loading || !query.trim()}>
              搜索
            </button>
          </div>
        </>
      ) : null}
      {message ? <p className="muted" role="status">{message}</p> : null}
      {results ? (
        <div className="settings-line-list" aria-label="记忆检索结果">
          {results.length === 0 ? <p>没有匹配的记忆。</p> : results.map((result) => (
            <p key={result.id}>{result.content} · {scopeLabels[result.scope]} / {kindLabels[result.kind]}</p>
          ))}
        </div>
      ) : null}
      <div className="settings-line-list" aria-label="已保存记忆">
        {loading && items.length === 0 ? <p>读取中…</p> : null}
        {!loading && items.length === 0 ? <p>还没有已保存记忆。</p> : null}
        {items.map((item) => (
          <div className="settings-shell-card" key={item.id}>
            {editingId === item.id ? (
              <textarea aria-label={`编辑记忆 ${item.id}`} value={editingContent} onChange={(event) => setEditingContent(event.target.value)} />
            ) : <p>{item.content}</p>}
            <p className="muted">{scopeLabels[item.scope]} / {kindLabels[item.kind]} · 更新于 {formatMemoryDate(item.updatedAt)}{item.revokedAt ? " · 已撤销" : ""}</p>
            <div className="action-row">
              {item.revokedAt ? null : editingId === item.id ? (
                <>
                  <button className="action-button action-button-primary" type="button" onClick={() => void handleEdit(item)} disabled={loading || !enabled}>保存编辑</button>
                  <button className="action-button" type="button" onClick={() => setEditingId(null)} disabled={loading}>取消</button>
                </>
              ) : (
                <>
                  <button className="action-button" type="button" onClick={() => { setEditingId(item.id); setEditingContent(item.content); }} disabled={!enabled}>编辑</button>
                  <button className="action-button" type="button" onClick={() => void handleRevoke(item.id)} disabled={loading}>撤销</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
