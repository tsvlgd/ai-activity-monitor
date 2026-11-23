# Normalized event schema (v1)

Every adapter appends one JSON object per line to
`$XDG_RUNTIME_DIR/ai-activity-monitor/spool/<provider>--<session>.jsonl`
(override with `AIMON_SPOOL_DIR`). The extension validates every line in
`parseEvent()` (`lib/core/model.js`) and drops anything malformed.

| Field | Type | Notes |
| --- | --- | --- |
| `v` | int | Always `1`. |
| `ts` | float | Unix seconds with milliseconds. |
| `provider` | string | `[a-z0-9-]{1,32}`, for example `claude-code`, `opencode`. |
| `session` | string | Agent session id, at most 128 characters. |
| `kind` | string | One of the kinds below. |
| `detail` | string | Human text, clamped to 160 characters, control characters removed. |
| `tool` | string | Tool name when relevant. |
| `cwd` | string | Session directory. |
| `title` | string | Optional session title, as the agent shows it in the terminal tab. The Claude hook reads the newest `ai-title` record from the last 64 KiB of the transcript and sends it on `session_start`, `prompt`, `permission`, `input_needed`, `turn_complete` and `turn_error` (main agent only). The extension compares it with the focused tab title to stay quiet while the user watches. |
| `pid` | int | Agent process (Claude) or server process (OpenCode). Sent on `session_start` and `prompt`. |
| `reason` | string | For `session_start` (`startup`, `resume`, `clear`) and `session_end`. |
| `agent` | string | Which agent inside the session: a Claude `agent_id` or an OpenCode child session id, at most 64 characters. Pending approvals are tracked per agent. Empty means the main agent. |
| `term` | object | Optional terminal identity: `screen`, `service`, `program`, `window`. |

## Kinds and their sources

| Kind | Claude Code hook | OpenCode 2.x event |
| --- | --- | --- |
| `session_start` | `SessionStart` | `session.created`, `session.viewed`, first event of a session |
| `prompt` | `UserPromptSubmit` | `session.execution.started` (text from `session.inbox.enqueued`) |
| `activity` | `PreCompact` | `session.step.started`, `session.text.started`, `session.reasoning.started`, `session.retry.scheduled` |
| `tool_start` | `PreToolUse` | `session.tool.called` (name from `session.tool.input.started`) |
| `tool_end` | `PostToolUse` | `session.tool.success` |
| `tool_error` | `PostToolUseFailure` | `session.tool.failed` |
| `permission` | `PermissionRequest`, `Notification` permission_prompt | `permission.asked` |
| `input_needed` | `PreToolUse` AskUserQuestion or ExitPlanMode, `Notification` elicitation | `session.tool.called` with tool `question` |
| `permission_resolved` | (inferred from the next tool event) | `permission.replied`, `permission.rejected` |
| `turn_complete` | `Stop` (main agent only) | `session.execution.succeeded` (root session only) |
| `turn_error` | `StopFailure` (`error` field, for example `model_not_found`) | `session.execution.failed` |
| `turn_interrupted` | `PostToolUseFailure` with `is_interrupt` | `session.execution.interrupted` |
| `idle_hint` | `Notification` idle_prompt | none |
| `session_end` | `SessionEnd` | `session.deleted`, `location.shutdown`, plugin dispose |

Subagents never complete their parent: Claude subagent `Stop` events carry
`agent_id` and are dropped, and OpenCode child sessions (`parentID`) are folded
into their root session.

## Privacy

Adapters never write tool output or file contents. Commands and prompts are
reduced to their first line, the home directory becomes `~`, and obvious
secrets (bearer tokens, `api_key=`, `token:`, `ghp_`, `sk-`, URL credentials)
become `[redacted]`. Prompt previews can be hidden in the preview card with
the `show-prompt-text` setting.
