# Desktop Conversation NPC Activation Design

## 1. Goal

把桌面端当前“选中了 NPC 配置页，就隐式影响会话执行”的状态拆开，改成真正产品化的“会话显式启用 NPC”。

目标是：

- 会话执行态和 NPC 编辑态彻底分离
- 用户能在会话里明确知道“当前有没有启用 NPC、启用了哪个 NPC”
- 当前会话只受显式选中的会话 NPC 影响
- 恢复历史会话时，连同当时启用的 NPC 一起恢复
- 视觉风格与现有 App 保持统一，避免新增卡片感和割裂感

## 2. Problem

当前桌面端已经有两套事实同时存在：

- `npcWorkspace.selectedNpcId` 用来驱动 NPC 页面编辑
- 普通会话执行链也直接读取这个值来注入 NPC 上下文

这样会导致几个问题：

- 用户进入 NPC 页面只是想编辑，实际却可能已经影响当前会话
- 用户回到会话页时，看不到当前是否真的启用了某个 NPC
- 后续多会话场景下，无法区分“这个窗口当前会话使用哪个 NPC”和“NPC 页面当前在编辑哪个 NPC”
- 产品语义不清晰，容易让用户误以为会话系统不稳定

## 3. Chosen Solution

采用独立的 `conversationNpcId`。

### 3.1 State split

保留：

- `npcWorkspace.selectedNpcId`
  - 只负责 NPC 页面编辑态

新增：

- `conversation.npcId` 或等价字段
  - 只负责当前会话执行态

最终规则：

- NPC 编辑页只读写 `npcWorkspace.selectedNpcId`
- 会话执行链只读取 `conversation.npcId`
- 两者默认互不联动

## 4. UX

### 4.1 Conversation NPC bar

在会话输入区上方增加一条轻量的 `NPC 会话条`。

显示规则：

- 未启用时显示：`未启用 NPC`
- 已启用时显示：`当前 NPC：研究助手`

交互规则：

- 点击整行，展开轻量下拉列表
- 列表包含：
  - `不使用 NPC`
  - 所有已有 NPC

切换后：

- 立即更新当前会话执行态
- 不自动切换 NPC 工作区的编辑选中项

### 4.2 Style rules

这条会话 NPC 切换区必须遵循当前 App 的简洁轻量风格：

- 不使用大卡片
- 不增加浮层式厚重边框
- 以浅灰分割线、轻量行高、细字重为主
- 和 `会话 / 搜索 / Skills / NPC / MCP` 现有界面风格统一
- 中文文案简洁，不做解释性大段说明

推荐视觉形态：

- 一条横向行容器
- 左边是状态文案
- 右边是 `切换` 或下拉箭头
- 展开列表也是无卡片感的窄列表

### 4.3 New conversation behavior

新建会话后：

- 默认 `conversation.npcId = null`
- 会话条显示 `未启用 NPC`

不再因为用户最近编辑过某个 NPC，就自动继承那个 NPC 到新会话。

### 4.4 Restored conversation behavior

恢复最近会话或归档会话时：

- 恢复该会话自己的 `conversation.npcId`
- 会话条同步显示当时启用的 NPC

如果对应 NPC 已不存在：

- 会话条退回 `未启用 NPC`
- 不报错，不阻塞会话打开

## 5. Runtime Behavior

### 5.1 Chat execution

普通会话执行链改为：

1. 读取 `conversation.npcId`
2. 若为空：
   - 按普通本地会话链执行
3. 若存在：
   - 加载该 NPC 配置
   - 注入该 NPC 的：
     - 默认模型
     - 人设标题
     - personaPrompt
     - outputStyle
     - agentDraft
     - rulesDraft
     - enabledSkillNames
     - knowledgeLibraryIds

### 5.2 Knowledge retrieval

当 `conversation.npcId` 对应 NPC 绑定了知识库时：

- 本地知识检索优先按该 NPC 绑定知识库集合聚合

当 `conversation.npcId` 为空，或该 NPC 没有绑定知识库时：

- 回退到现有普通本地知识检索逻辑

### 5.3 Model selection priority

当 `conversation.npcId` 有值时：

- 优先使用该 NPC 默认模型

当该 NPC 默认模型当前不可用时：

- 回退现有会话模型选择逻辑

## 6. Persistence

需要把 `conversation.npcId` 纳入持久化。

至少覆盖：

- 浏览器态 / 桌面端持久化存储
- 最近会话摘要
- 归档会话
- 恢复会话
- 新建会话
- 删除会话后的回退逻辑

## 7. Testing

至少补这些测试：

### 7.1 UI

- 会话页显示 `未启用 NPC`
- 选择某个 NPC 后，会话条显示对应名称
- 切换回 `不使用 NPC` 后，会话条恢复未启用状态
- 进入 NPC 页面编辑另一个 NPC，不会自动改掉当前会话条里的 NPC

### 7.2 Runtime

- 启用某个会话 NPC 后，普通会话执行链读取的是 `conversation.npcId`
- 即使 `npcWorkspace.selectedNpcId` 改了，只要 `conversation.npcId` 不变，会话执行仍使用原来的 NPC
- 会话 NPC 绑定知识库时，检索按该 NPC 绑定集聚合
- 会话 NPC 默认模型可用时优先使用该模型
- 会话 NPC 默认模型不可用时回退到普通模型逻辑

### 7.3 Persistence

- 新建会话默认无 NPC
- 恢复历史会话时恢复对应 NPC
- 若恢复时 NPC 已不存在，则自动退回 `未启用 NPC`

## 8. Scope

本次只做“单会话显式启用单 NPC”。

明确不在本次范围内：

- 一个会话里同时启用多个 NPC
- 多 NPC 协作流编排
- 在左侧历史列表里展示 NPC badge
- 把 NPC 启用状态扩展到全局工作区级别

## 9. Recommendation

这是当前最稳妥的产品化分层：

- `npcWorkspace` = 编辑态
- `conversation.npcId` = 执行态

这样后续继续扩展：

- 单 NPC 会话
- 多会话分别挂不同 NPC
- 后续多 NPC 协作模式

都会更清晰，不需要再拆一次状态模型。
