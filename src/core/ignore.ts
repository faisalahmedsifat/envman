import { promises as fs } from "node:fs";
import path from "node:path";
import ignore, { type Ignore } from "ignore";
import type { EnvmanConfig } from "../types/index.js";
import { pathExists } from "./fs.js";

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function globToRegExp(pattern: string): RegExp {
  const escaped = escapeRegExp(pattern).replaceAll("*", ".*");
  return new RegExp(`^${escaped}$`);
}

export function matchesPattern(value: string, patterns: string[]): boolean {
  return patterns.some((pattern) => globToRegExp(pattern).test(value));
}

export class EnvmanFilter {
  private readonly ig: Ignore;

  constructor() {
    this.ig = ignore();
  }

  public async load(repoRoot: string, config: EnvmanConfig): Promise<void> {
    const ignorePath = path.join(repoRoot, ".envmanignore");
    if (await pathExists(ignorePath)) {
      const content = await fs.readFile(ignorePath, "utf8");
      this.ig.add(content);
    }

    if (config.exclude && config.exclude.length > 0) {
      this.ig.add(config.exclude);
    }
  }

  public shouldSkipPath(relativePath: string, config: EnvmanConfig): boolean {
    if (this.ig.ignores(relativePath)) {
      return true;
    }

    if (config.include.length === 0) {
      return false;
    }

    return (
      !matchesPattern(relativePath, config.include) &&
      !matchesPattern(path.basename(relativePath), config.include)
    );
  }
}
