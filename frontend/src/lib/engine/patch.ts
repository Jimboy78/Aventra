import type { PatchOp } from "./types";

// Minimal RFC 6902 applier (add / replace / remove, "-" appends). The engine expresses every
// state change as ops so turns are auditable, replayable and small to store.

const decode = (segment: string) => segment.replace(/~1/g, "/").replace(/~0/g, "~");

export const escapePointer = (segment: string) => segment.replace(/~/g, "~0").replace(/\//g, "~1");

type Container = Record<string, unknown> | unknown[];

function parent(root: unknown, path: string): [Container, string] {
  if (!path.startsWith("/")) throw new Error(`Invalid JSON pointer: ${path}`);
  const segments = path.slice(1).split("/").map(decode);
  const key = segments.pop() as string;
  let node: unknown = root;
  for (const segment of segments) {
    if (node === null || typeof node !== "object") throw new Error(`Path not found: ${path}`);
    node = Array.isArray(node) ? node[Number(segment)] : (node as Record<string, unknown>)[segment];
  }
  if (node === null || typeof node !== "object") throw new Error(`Path not found: ${path}`);
  return [node as Container, key];
}

export function applyOps<T>(doc: T, ops: PatchOp[]): T {
  const root = structuredClone(doc);
  for (const op of ops) {
    const [container, key] = parent(root, op.path);
    if (Array.isArray(container)) {
      const index = key === "-" ? container.length : Number(key);
      if (!Number.isInteger(index) || index < 0 || index > container.length) {
        throw new Error(`Bad array index in ${op.path}`);
      }
      if (op.op === "add") container.splice(index, 0, structuredClone(op.value));
      else if (op.op === "replace") {
        if (index >= container.length) throw new Error(`Nothing to replace at ${op.path}`);
        container[index] = structuredClone(op.value);
      } else {
        if (index >= container.length) throw new Error(`Nothing to remove at ${op.path}`);
        container.splice(index, 1);
      }
    } else if (op.op === "remove") {
      if (!(key in container)) throw new Error(`Nothing to remove at ${op.path}`);
      delete container[key];
    } else {
      if (op.op === "replace" && !(key in container)) throw new Error(`Nothing to replace at ${op.path}`);
      container[key] = structuredClone(op.value);
    }
  }
  return root;
}
