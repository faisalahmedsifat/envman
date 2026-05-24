import { EnvmanError } from "./errors.js";

export interface EnvEntry {
  key: string;
  value: string;
}

export interface ParsedEnvFile {
  entries: EnvEntry[];
  byKey: Map<string, string>;
}

function unquote(value: string): string {
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

export function parseEnvFile(content: string): ParsedEnvFile {
  const entries: EnvEntry[] = [];
  const byKey = new Map<string, string>();
  const lines = content.split(/\r?\n/);

  for (const [index, rawLine] of lines.entries()) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = rawLine.indexOf("=");
    if (separatorIndex <= 0) {
      throw new EnvmanError(`Unsupported env syntax on line ${index + 1}`);
    }

    const rawKey = rawLine.slice(0, separatorIndex).trim();
    const rawValue = rawLine.slice(separatorIndex + 1).trim();

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(rawKey)) {
      throw new EnvmanError(`Invalid env key "${rawKey}" on line ${index + 1}`);
    }

    const value = unquote(rawValue);
    entries.push({ key: rawKey, value });
    byKey.set(rawKey, value);
  }

  return { entries, byKey };
}

function quoteIfNeeded(value: string): string {
  if (value.length === 0) {
    return "\"\"";
  }

  if (/[\s#"'`]/.test(value)) {
    return JSON.stringify(value);
  }

  return value;
}

export function formatEnvFile(entries: EnvEntry[]): string {
  const lines = entries.map((entry) => `${entry.key}=${quoteIfNeeded(entry.value)}`);
  return `${lines.join("\n")}\n`;
}
