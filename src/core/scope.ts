import path from "node:path";

function trimTrailingSlash(value: string): string {
  if (value === "/") {
    return value;
  }

  return value.replace(/\/+$/u, "");
}

export function normalizeRelativePath(value: string): string {
  const normalized = value.replaceAll("\\", "/");
  const collapsed = path.posix.normalize(normalized);

  if (collapsed === "." || collapsed === "") {
    return "";
  }

  return trimTrailingSlash(collapsed.replace(/^\.\/+/u, ""));
}

export function normalizeScope(scope: string | undefined): string | undefined {
  if (scope === undefined) {
    return undefined;
  }

  const normalized = normalizeRelativePath(scope);
  return normalized.length > 0 ? normalized : undefined;
}

export function isPathWithinScope(filePath: string, scope: string | undefined): boolean {
  const normalizedScope = normalizeScope(scope);
  if (normalizedScope === undefined) {
    return true;
  }

  const normalizedFilePath = normalizeRelativePath(filePath);
  return (
    normalizedFilePath === normalizedScope ||
    normalizedFilePath.startsWith(`${normalizedScope}/`)
  );
}
