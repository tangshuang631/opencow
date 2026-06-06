# @opencow/openclaw-adapter

Controlled adapter boundary between opencow and the vendored OpenClaw source under `vendor/openclaw`.

Current scope:

- Locate the vendored OpenClaw root.
- Read upstream package metadata for audit and license checks.
- Inspect expected upstream capability packages without importing runtime code.
- List vendored OpenClaw workspace packages for controlled adapter planning.
- Provide a browser-safe first-pass planner for local assistant tasks before desktop execution.
- Map the first batch of readonly shell diagnostics from conversation intent into controlled task kinds.
- Map planner-visible capability catalog tasks for `RAG / Skills / NPC / MCP` before real execution wiring expands.

Current readonly shell mappings:

- `readonly-shell-git-status` -> `git status --short`
- `readonly-shell-workspace-root` -> top-level workspace file listing
- `readonly-shell-packages-dir` -> `packages/` directory listing

Current planner-visible capability catalog mappings:

- `capability-rag-overview`
- `capability-skills-overview`
- `capability-npc-overview`
- `capability-mcp-overview`

Current real readonly RAG execution mapping:

- `rag-local-doc-search` -> local rules and documentation retrieval fallback

Current real readonly Skills execution mapping:

- `skills-local-scan` -> approved repo-local skill discovery over vendored OpenClaw skill roots
- `skills-local-inspect` -> readonly local skill detail lookup over the same approved skill roots
- `skills-local-enable` -> permission-backed local workspace skill registry enablement
- `skills-local-enabled-list` -> readonly workspace-enabled skill registry readback
- `skills-local-enabled-match` -> readonly recommendation matching over already-enabled local workspace skills
- `skills-local-disable` -> permission-backed removal of an enabled local workspace skill entry
- `skills-local-enabled-shell-create-temp-output` -> permission-backed enabled-skill-assisted dispatch into the controlled temp-output shell write
- `skills-local-enabled-shell-remove-temp-output` -> permission-backed and confirmation-backed enabled-skill-assisted dispatch into the controlled temp-output shell removal
- `skills-local-enabled-rag-doc-search` -> readonly enabled-skill-assisted dispatch into the local rules and documentation retrieval fallback
- `skills-local-enabled-rag-shell-handoff-preview` -> readonly enabled-skill-assisted dispatch into local rules retrieval plus shell next-step safety preview
- `npc-local-enabled-rag-shell-handoff-preview` -> readonly NPC-assisted dispatch into local rules retrieval plus shell next-step safety preview
- `skills-local-enabled-rag-shell-create-temp-output` -> permission-backed skill-assisted RAG handoff dispatch into the controlled temp-output shell write
- `skills-local-enabled-rag-shell-remove-temp-output` -> permission-backed and confirmation-backed skill-assisted RAG handoff dispatch into the controlled temp-output shell removal
- `npc-local-collaboration-preview` -> readonly local NPC collaboration preview over readiness, enabled skills, and local docs context
- `npc-local-shell-plan-preview` -> readonly local NPC shell plan preview over readiness, enabled skill routing, and shell safety planning
- `npc-local-enabled-shell-create-temp-output` -> permission-backed NPC-assisted dispatch into the controlled temp-output shell write
- `npc-local-enabled-shell-remove-temp-output` -> permission-backed and confirmation-backed NPC-assisted dispatch into the controlled temp-output shell removal
- `npc-local-enabled-rag-shell-create-temp-output` -> permission-backed NPC-assisted RAG handoff dispatch into the controlled temp-output shell write
- `npc-local-enabled-rag-shell-remove-temp-output` -> permission-backed and confirmation-backed NPC-assisted RAG handoff dispatch into the controlled temp-output shell removal

Current NPC shell continuation limits:

- NPC-assisted shell execution continues only into the existing temp-output create and remove slices
- NPC-assisted shell execution keeps its own execution identity and audit wording
- permission and dangerous confirmation requirements remain unchanged
- NPC wording does not create a separate executor or bypass enabled-skill matching

Current NPC-assisted RAG handoff limits:

- NPC collaboration can preview the next shell safety step after reviewing local rules and docs
- NPC collaboration can review local rules and docs before continuing into shell execution
- the handoff still reuses enabled-skill matching, local knowledge retrieval, and the existing controlled shell runners
- permission and dangerous confirmation requirements remain unchanged
- no arbitrary shell command synthesis from NPC or RAG content

Current Skills ecosystem linkage:

- scan and inspect results can now reflect whether a discovered or matched skill is already enabled in the workspace-local registry

Current approved local skill scan scope:

- `vendor/openclaw/skills/**/SKILL.md`
- `vendor/openclaw/extensions/*/SKILL.md`
- `vendor/openclaw/extensions/*/skills/**/SKILL.md`
- optional workspace-local `skills/**/SKILL.md`

Current local skill scan limits:

- readonly only
- ignores test and fixture skill paths
- does not crawl system or user-home skill directories
- does not install, enable, disable, or execute skills

Current local skill detail fields:

- `name`
- `path`
- `source`
- `description`
- `content_preview`

Current local skill enable limits:

- requests `workspace-write` first when planned from `readonly`
- writes only `.opencow/skills/enabled-skills.json`
- only enables already discovered approved local skills
- does not execute skill code
- does not install or download skills
- avoids duplicate registry entries on repeated enable requests

Current enabled local skills list limits:

- readonly only
- reads only `.opencow/skills/enabled-skills.json`
- returns only enabled workspace-local entries
- does not mutate the registry
- does not execute or auto-enable skills

Current local skill disable limits:

- requests `workspace-write` first when planned from `readonly`
- rewrites only `.opencow/skills/enabled-skills.json`
- only disables already enabled approved local skills
- does not execute skill code
- does not install or download skills
- does not remove unrelated enabled entries

Current skill-assisted shell write limits:

- requests `workspace-write` first when planned from `readonly`
- matches an enabled local shell-oriented skill before shell execution
- reuses only the existing controlled temp-output creation command
- does not synthesize arbitrary shell commands from skill content
- does not execute general skill runtime code

Current skill-assisted destructive shell limits:

- requests `controlled-full` first when planned below that permission mode
- still requires explicit dangerous confirmation after permission approval
- matches an enabled local shell-oriented skill before destructive shell execution
- reuses only the existing controlled temp-output removal command
- does not synthesize arbitrary destructive shell commands from skill content

Current skill-assisted readonly RAG limits:

- stays readonly end to end
- matches an enabled local doc-oriented skill before local knowledge retrieval
- reuses only the existing local rules and documentation retrieval fallback
- does not execute general skill runtime code
- does not add remote retrieval or embedding dependency

Current skill-assisted readonly RAG-to-shell handoff preview limits:

- stays readonly end to end
- matches an enabled local skill before local knowledge retrieval
- reuses only the existing local rules and documentation retrieval fallback plus the existing shell next-step preview path
- does not execute shell commands
- does not execute general skill runtime code

Current skill-assisted RAG-to-shell continued execution limits:

- reuses the same enabled skill match and local rules retrieval before shell execution
- still requires the normal permission and dangerous confirmation chain
- reuses only the existing controlled temp-output create and remove commands
- does not synthesize arbitrary shell commands from RAG or skill content

Current NPC collaboration preview limits:

- stays readonly end to end
- reuses only existing NPC capability inspection, enabled skill registry readback, and local docs retrieval
- does not start a real NPC runtime or background collaboration session
- does not execute tools or shell actions

Current NPC shell plan preview limits:

- stays readonly end to end
- reuses only existing NPC capability inspection, enabled skill matching, and shell safety planning
- does not execute shell commands
- does not start a real NPC runtime or background collaboration session

This package must stay small, tested, and safety-aware. UI code should not access `vendor/openclaw` directly.
