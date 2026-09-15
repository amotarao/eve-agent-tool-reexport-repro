# eve-agent-tool-reexport-repro

Minimal reproduction for: the built-in `agent` (delegation) tool, restored the way the docs and
`eve add tool/agent` describe, is never dispatched to the subagent workflow.

Bootstrapped with `npx eve@latest init`. The only changes on top of the scaffold are the two below.

## The reproduction

`agent/agent.ts` — turn off the optional default tools:

```ts
export default defineAgent({
  model: "anthropic/claude-haiku-4.5",
  defaultTools: false,
});
```

`agent/tools/agent.ts` — restore the delegation tool exactly as documented in
`docs/concepts/built-in-tools.md` (`### agent`), which is also what `eve add tool/agent` generates:

```ts
export { default } from "eve/tools/agent";
```

## Steps

```bash
npm install
npm exec -- eve info      # Tools 1, Diagnostics 0 errors, 0 warnings
npm exec -- eve link      # or set AI_GATEWAY_API_KEY
npm exec -- eve dev --no-ui
```

Then ask the agent to delegate:

```bash
curl -s -X POST http://127.0.0.1:2000/eve/v1/session \
  -H 'content-type: application/json' \
  -d '{"message":"Delegate the task \"reply with the word hello\" to a subagent using the agent tool, then report what happened."}'

curl -sN http://127.0.0.1:2000/eve/v1/session/<sessionId>/stream
```

## Expected vs. actual

Expected: a child session is spawned, as it would be with the default `agent` tool.

Actual: the call fails with the framework placeholder error, and no child is created.

```
The framework "agent" tool was executed directly. It must be resolved through the runtime tool
registry, which dispatches it to the shared subagent workflow.
```

Nothing is reported at build time: `eve info` shows the tool with 0 diagnostics, and the compiled
manifest still carries `"handling": { "kind": "dispatch", "action": "self-agent" }`.

## Why

`createPreparedRuntimeTool` (`packages/eve/src/runtime/tools/registry.ts`) attaches the subagent
workflow only when the tool is owned by the framework layer:

```ts
const isFrameworkAgent =
  definition.owner.kind === "framework" && definition.name === AGENT_TOOL_NAME;
```

Anything authored under `agent/tools/` is composed at the `application` layer
(`packages/eve/src/compiler/normalize-manifest.ts`), so the re-exported `agent` misses that branch
and the framework definition's placeholder `execute()` runs instead.

## Workaround

Don't use `defaultTools: false` for this. Disable only the unwanted defaults with
`export default disableTool()` in their own `agent/tools/<name>.ts`; the `agent` slot then stays
framework-owned and delegation works.
