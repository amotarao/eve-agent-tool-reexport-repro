import { defineAgent } from "eve";

export default defineAgent({
  model: "anthropic/claude-haiku-4.5",
  // Turn off the optional default tools, then restore only `agent` below.
  defaultTools: false,
});
