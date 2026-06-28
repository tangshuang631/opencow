# Chat Attachments Design

## Goal

为 `apps/desktop` 的聊天工作台补齐正式附件能力：点击附件按钮可打开系统默认文件选择器，支持从文件管理器拖拽文件到输入区，支持直接粘贴剪贴板图片或文件，附件在发送前显示在输入框上方，发送后作为会话历史的一部分持久保留，直到删除会话为止，并支持双击再次打开附件。

## Scope

- 仅覆盖 `apps/desktop` 工作台聊天输入区与会话历史展示。
- 桌面端优先使用 Tauri 命令处理文件选择与打开。
- Web/测试环境允许回退到浏览器 `input[type=file]` 与本地 `blob:` 预览，不阻塞开发验证。
- 多附件横向展示，超出输入框宽度时允许裁剪隐藏后续附件，不在本次实现复杂瀑布流或独立附件管理页。

## Non-Goals

- 不做远程上传服务。
- 不做图片 OCR、文档解析增强或自动转知识库索引。
- 不做附件重命名、排序拖拽、批量下载。

## Architecture

### Attachment Domain Model

新增统一的聊天附件实体，包含：

- 稳定 `id`
- `name`、`mimeType`、`sizeBytes`
- `kind`（image / file）
- 桌面端可重新打开所需的 `filePath`
- 浏览器预览所需的 `previewUrl`
- `source`（picker / drop / paste）

附件存在两个层次：

- `composer.draftAttachments`：当前输入框待发送附件
- `conversation.entries[].attachments`：已发送历史消息附件

发送消息时，草稿附件会整体复制到用户消息条目中，随后清空草稿附件。

### Desktop Bridge

新增聊天附件服务层，前端不直接依赖 Tauri 细节：

- `pickChatAttachments()`：桌面端调用原生命令打开系统文件选择器；浏览器端回退隐藏文件输入框。
- `openChatAttachment()`：桌面端按系统默认应用打开本地文件；浏览器端对 `blob:` 或 `data:` URL 使用 `window.open`。
- `extractClipboardAttachments()` / `extractDroppedAttachments()`：统一将 `FileList`、`DataTransferItemList`、剪贴板图片提取成聊天附件对象。

### Conversation Persistence

由于历史附件要随会话保留，`WorkbenchState`、最近会话记录、归档会话、持久化读写都要携带 `attachments`。删除会话时对应附件历史一并消失。

### UI

#### Composer

- 附件按钮实际可用
- 输入框上方显示横向附件条
- 单个附件卡片支持关闭
- 拖拽进入时输入区出现高亮态
- 支持多附件，超出宽度时通过横向滚动/裁剪隐藏后续内容

#### Conversation History

- 用户消息上方渲染附件条
- 图片与普通文件统一走小卡片表现，展示图标、名称、简要信息
- 双击卡片重新打开附件

## Data Flow

1. 用户点击按钮 / 拖拽文件 / 粘贴图片。
2. 前端统一生成 `ChatAttachment[]` 放入 `composer.draftAttachments`。
3. 用户提交消息时，`createUserTaskSubmittedState` 将草稿附件写入新建用户消息。
4. 消息、最近会话、归档会话、持久化状态全部保留附件。
5. 历史消息双击附件时，调用统一附件打开服务。

## Error Handling

- 用户取消文件选择时静默返回。
- 非文件型粘贴保持原文本粘贴行为。
- 桌面端打开文件失败时只记录控制台/错误状态，不中断会话渲染。
- 无法获得桌面路径的剪贴板图片仍可通过 `blob:` 预览在当前会话中保留，但跨重启是否仍可打开取决于浏览器 URL 生命周期；优先保证桌面文件与拖拽文件完整可恢复。

## Testing

- `Composer.test.tsx`：
  - 点击附件按钮触发选择
  - 拖拽文件进入草稿
  - 粘贴剪贴板图片进入草稿
  - 发送消息后清空草稿
- `MainConversation.test.tsx`：
  - 历史用户消息渲染多个附件
  - 双击附件触发打开
- `workbenchState.*.test.ts`：
  - 用户消息保存附件
  - 最近会话 / 持久化恢复保留附件
- 附件服务测试：
  - 桌面命令映射
  - 浏览器回退逻辑
