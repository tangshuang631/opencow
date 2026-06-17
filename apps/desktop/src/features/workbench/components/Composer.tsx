import { ArrowUp, Check, ChevronDown, Cpu, Paperclip, Square } from "lucide-react";
import { useState } from "react";
import type { WorkbenchState } from "../workbenchState";
import { normalizeWorkbenchText } from "../workbenchText";

type ComposerProps = {
  state: WorkbenchState;
  onSubmitTask: (message: string) => void;
  onCancelActiveTask: () => void;
  onSelectModel: (modelName: string) => void;
  onSelectNpcModel?: (modelName: string) => void;
  onOpenModelSettings?: (target: "ollama" | "remote-api") => void;
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
  stopTask: "\u505c\u6b62\u4efb\u52a1",
  send: "\u53d1\u9001"
} as const;

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

function getNpcModelLabel(state: WorkbenchState) {
  return state.settings.npc.localModel || state.model.activeModel || "未选择模型";
}

export function Composer({
  state,
  onSubmitTask,
  onCancelActiveTask,
  onSelectModel,
  onSelectNpcModel,
  onOpenModelSettings
}: ComposerProps) {
  const [draft, setDraft] = useState("");
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const hasActiveTask = Boolean(
    state.tasks.activeTaskId
      && state.tasks.items.some((item) => item.id === state.tasks.activeTaskId && item.status === "running")
  );
  const hasModels = state.model.availableModels.length > 0;
  const modelSetupPrompt = getModelSetupPrompt(state);
  const [npcModelMenuOpen, setNpcModelMenuOpen] = useState(false);

  function submitTask() {
    const message = draft.trim();

    if (!message || hasActiveTask) {
      return;
    }

    onSubmitTask(message);
    setDraft("");
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
      <div className="composer">
        <button className="icon-button" type="button" aria-label={TEXT.addAttachment}>
          <Paperclip aria-hidden="true" size={18} />
        </button>
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
        {hasModels ? (
          <div className="model-picker">
            <button
              aria-expanded={npcModelMenuOpen}
              aria-haspopup="menu"
              aria-label={`选择 NPC 模型：${getNpcModelLabel(state)}`}
              className="model-picker-button"
              type="button"
              onClick={() => setNpcModelMenuOpen((open) => !open)}
            >
              <Cpu aria-hidden="true" size={16} />
              <ChevronDown aria-hidden="true" size={15} />
            </button>
            {npcModelMenuOpen ? (
              <div aria-label="NPC 模型" className="model-picker-menu" role="menu">
                {state.model.availableModels.map((model) => {
                  const selected = model.name === getNpcModelLabel(state);

                  return (
                    <button
                      aria-checked={selected}
                      className={`model-picker-item ${selected ? "model-picker-item-selected" : ""}`}
                      key={model.name}
                      role="menuitemradio"
                      type="button"
                      onClick={() => {
                        onSelectNpcModel?.(model.name);
                        setNpcModelMenuOpen(false);
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
          <button className="send-button" type="button" aria-label={TEXT.send} onClick={submitTask}>
            <ArrowUp aria-hidden="true" size={18} />
          </button>
        )}
      </div>
    </footer>
  );
}
