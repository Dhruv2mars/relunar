import { parse as parseYaml } from "yaml";
import { z } from "zod";

export type RelunarConfig = {
  setupCommands: string[];
};

const commandSchema = z.string().trim().min(1).max(500);

const relunarConfigSchema = z.object({
  setup: z.array(commandSchema).max(10).default([]),
});

export function parseRelunarConfig(text: string): RelunarConfig {
  if (!text.trim()) {
    return { setupCommands: [] };
  }

  const parsed = parseYaml(text);
  const config = relunarConfigSchema.parse(parsed ?? {});
  return {
    setupCommands: config.setup,
  };
}
