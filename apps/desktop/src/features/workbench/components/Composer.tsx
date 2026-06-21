import { ArrowUp, Check, ChevronDown, Cpu, Paperclip, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ChatAttachment, WorkbenchState } from "../workbenchState";
import { normalizeWorkbenchText } from "../workbenchText";
import {
  createChatAttachmentFromFile,
  extractClipboardAttachments,
  extractDroppedAttachments,
  extractFilesFromTransferItems,
  pickChatAttachments
} from "../chatAttachments";
import { AttachmentPreview } from "./AttachmentPreview";

type ComposerProps = {
  state: WorkbenchState;
  onSubmitTask: (message: string, attachments?: ChatAttachment[]) => void;
  onCancelActiveTask: () => void;
  onSelectModel: (modelName: string) => void;
  onSelectNpcModel?: (modelName: string) => void;
  onOpenModelSettings?: (target: "ollama" | "remote-api") => void;
  onAddAttachments?: (attachments: ChatAttachment[]) => void;
  onRemoveAttachment?: (attachmentId: string) => void;
};

const TEXT = {
  rollbackPoints: "\u56de\u9000",
  addAttachment: "\u6dfb\u52a0\u9644\u4ef6",
  inputTask: "\u8f93\u5165\u4efb\u52a1",
  inputPlaceholder: "\u8f93\u5165\u4efb\u52a1\uff0c\u9ed8\u8ba4\u4f7f\u7528\u672c\u5730 Ollama...",
  modelMenu: "\u6a21\u578b",
  selectModel: "\u9009\u62e9\u6a21\u578b",
  configureOllama: "\u914d\u7f6e Ollama",
  configureRemoteApi: "\u914d\u7f6e\u5927\u6a21\u578b API",
  addingAttachments: "正在添加附件…",
  stopTask: "\u505c\u6b62\u4efb\u52a1",
  send: "\u53d1\u9001"
} as const;

function mergeAttachments(primary: ChatAttachment[], secondary: ChatAttachment[]) {
  const seenIds = new Set<string>();

  return [...primary, ...secondary].filter((attachment) => {
    if (seenIds.has(attachment.id)) {
      return false;
    }

    seenIds.add(attachment.id);
    return true;
  });
}

function getComposerStatusLine(state: WorkbenchState) {
  const modelMode = state.model.remoteApiEnabled ? "远程 API" : "本地优先";

  return `${modelMode} · ${normalizeWorkbenchText(state.permission.label)} · ${TEXT.rollbackPoints} ${state.rollback.activeLimit}/${state.rollback.maxLimit}`;
}

function getModelSetupPrompt(state: WorkbenchState): string | null {
  if (state.error?.module === "ollama") {
    return "默认使用本地 Ollama，当前未检测到可用服务。";
  }

  if (state.model.status === "Ollama 已连接" && state.model.availableModels.length === 0) {
    return "默认使用本地 Ollama，当前未检测到可用模型。";
  }

  if (
    state.model.status === "Ollama 已连接"
    && state.model.availableModels.length > 0
    && !state.model.availableModels.some((model) => model.name === state.model.activeModel)
  ) {
    return "默认使用本地 Ollama，请先选择一个可用模型。";
  }

  return null;
}

export function Composer({
  state,
  onSubmitTask,
  onCancelActiveTask,
  onSelectModel,
  onSelectNpcModel,
  onOpenModelSettings,
  onAddAttachments,
  onRemoveAttachment
}: ComposerProps) {
  const [draft, setDraft] = useState("");
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [localDraftAttachments, setLocalDraftAttachments] = useState<ChatAttachment[]>([]);
  const [pendingAttachmentImportCount, setPendingAttachmentImportCount] = useState(0);
  const browserFileInputRef = useRef<HTMLInputElement | null>(null);
  const hasActiveTask = Boolean(
    state.tasks.activeTaskId
      && state.tasks.items.some((item) => item.id === state.tasks.activeTaskId && item.status === "running")
  );
  const hasModels = state.model.availableModels.length > 0;
  const modelSetupPrompt = getModelSetupPrompt(state);
  const visibleDraftAttachments = mergeAttachments(state.composer.draftAttachments, localDraftAttachments);
  const isImportingAttachments = pendingAttachmentImportCount > 0;

  useEffect(() => {
    if (localDraftAttachments.length === 0) {
      return;
    }

    const syncedIds = new Set(state.composer.draftAttachments.map((attachment) => attachment.id));
    setLocalDraftAttachments((current) => current.filter((attachment) => !syncedIds.has(attachment.id)));
  }, [localDraftAttachments.length, state.composer.draftAttachments]);

  function reportAttachmentError(error: unknown) {
    console.warn("Failed to add chat attachments.", error);
  }

  function commitPickedAttachments(attachments: ChatAttachment[]) {
    if (attachments.length === 0) {
      return;
    }

    setLocalDraftAttachments((current) => mergeAttachments(current, attachments));
    onAddAttachments?.(attachments);
  }

  async function importAttachments(task: () => Promise<ChatAttachment[]>) {
    setPendingAttachmentImportCount((count) => count + 1);

    try {
      commitPickedAttachments(await task());
    } catch (error) {
      reportAttachmentError(error);
    } finally {
      setPendingAttachmentImportCount((count) => Math.max(0, count - 1));
    }
  }

  function submitTask() {
    const message = draft.trim();
    const attachments = visibleDraftAttachments;

    if ((!message && attachments.length === 0) || hasActiveTask || isImportingAttachments) {
      return;
    }

    onSubmitTask(message, attachments);
    setDraft("");
    setLocalDraftAttachments([]);
  }

  async function appendDroppedFiles(files: File[]) {
    await importAttachments(() => extractDroppedAttachments(files));
  }

  async function appendClipboardFiles(files: File[]) {
    await importAttachments(() => extractClipboardAttachments(files));
  }

  async function appendPickedFiles(files: File[]) {
    await importAttachments(() => Promise.all(files.map((file) => createChatAttachmentFromFile(file, "picker"))));
  }

  async function handleAttachmentButtonClick() {
    try {
      if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
        await importAttachments(() => pickChatAttachments());
        return;
      }

      browserFileInputRef.current?.click();
    } catch (error) {
      reportAttachmentError(error);
    }
  }

  function removeAttachment(attachmentId: string) {
    setLocalDraftAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId));
    onRemoveAttachment?.(attachmentId);
  }

  return (
    <footer className="composer-shell">
      <div className="composer-meta">
        <span>{getComposerStatusLine(state)}</span>
      </div>
      {modelSetupPrompt ? (
        <div className="composer-setup-prompt">
          <span>{modelSetupPrompt}</span>
          <button type="button" onClick={() => onOpenModelSettings?.("ollama")}>
            {TEXT.configureOllama}
          </button>
          <button type="button" onClick={() => onOpenModelSettings?.("remote-api")}>
            {TEXT.configureRemoteApi}
          </button>
        </div>
      ) : null}
      <div
        className={`composer ${isDragActive ? "composer-drag-active" : ""}`}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragActive(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragActive(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
            return;
          }

          setIsDragActive(false);
        }}
        onDrop={async (event) => {
          event.preventDefault();
          setIsDragActive(false);
          const files = Array.from(event.dataTransfer?.files ?? []);

          if (files.length === 0) {
            return;
          }

          await appendDroppedFiles(files);
        }}
        onPaste={async (event) => {
          const fileList = Array.from(event.clipboardData?.files ?? []);
          const itemFiles = extractFilesFromTransferItems(Array.from(event.clipboardData?.items ?? []));
          const files = fileList.length > 0 ? fileList : itemFiles;

          if (files.length === 0) {
            return;
          }

          event.preventDefault();
          await appendClipboardFiles(files);
        }}
      >
        <input
          ref={(node) => {
            browserFileInputRef.current = node;
          }}
          multiple
          style={{ display: "none" }}
          type="file"
          onClick={(event) => {
            (event.currentTarget as HTMLInputElement).value = "";
          }}
          onChange={async (event) => {
            const input = event.currentTarget;
            const files = Array.from(input.files ?? []);

            if (files.length === 0) {
              return;
            }

            await appendPickedFiles(files);
            input.value = "";
          }}
        />
        <button
          className="icon-button"
          type="button"
          aria-label={TEXT.addAttachment}
          onClick={() => {
            void handleAttachmentButtonClick();
          }}
        >
          <Paperclip aria-hidden="true" size={18} />
        </button>
        <div className="composer-main">
          {isImportingAttachments ? (
            <div className="composer-attachment-importing" role="status">
              {TEXT.addingAttachments}
            </div>
          ) : null}
          {visibleDraftAttachments.length > 0 ? (
            <div className="composer-attachment-strip" aria-label="待发送附件">
              {visibleDraftAttachments.map((attachment) => (
                <AttachmentPreview
                  attachment={attachment}
                  classNamePrefix="composer"
                  key={attachment.id}
                  onRemove={removeAttachment}
                />
              ))}
            </div>
          ) : null}
          <textarea
            aria-label={TEXT.inputTask}
            placeholder={TEXT.inputPlaceholder}
            value={draft}
            disabled={hasActiveTask}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submitTask();
              }
            }}
          />
          <div className="composer-actions">
            {hasModels ? (
              <div className="model-picker">
                <button
                  aria-expanded={modelMenuOpen}
                  aria-haspopup="menu"
                  aria-label={`${TEXT.selectModel}\uff1a${state.model.activeModel}`}
                  className="model-picker-button"
                  type="button"
                  onClick={() => setModelMenuOpen((open) => !open)}
                >
                  <Cpu aria-hidden="true" size={16} />
                  <ChevronDown aria-hidden="true" size={15} />
                </button>
                {modelMenuOpen ? (
                  <div aria-label={TEXT.modelMenu} className="model-picker-menu" role="menu">
                    {state.model.availableModels.map((model) => {
                      const selected = model.name === state.model.activeModel;

                      return (
                        <button
                          aria-checked={selected}
                          className={`model-picker-item ${selected ? "model-picker-item-selected" : ""}`}
                          key={model.name}
                          role="menuitemradio"
                          type="button"
                          onClick={() => {
                            onSelectModel(model.name);
                            setModelMenuOpen(false);
                          }}
                        >
                          <span>{normalizeWorkbenchText(model.name)}</span>
                          <span>{normalizeWorkbenchText(model.sizeLabel)}</span>
                          {selected ? <Check aria-hidden="true" size={17} /> : null}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
            {hasActiveTask ? (
              <button className="send-button" type="button" aria-label={TEXT.stopTask} onClick={onCancelActiveTask}>
                <Square aria-hidden="true" size={18} />
              </button>
            ) : (
              <button
                className="send-button"
                type="button"
                aria-label={TEXT.send}
                disabled={isImportingAttachments}
                onClick={submitTask}
              >
                <ArrowUp aria-hidden="true" size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
