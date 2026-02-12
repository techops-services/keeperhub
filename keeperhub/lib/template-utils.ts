import { BUILTIN_NODE_ID } from "./builtin-variables";

const TEMPLATE_REF_PATTERN = /\{\{@([^:]+):([^}]+)\}\}/;

/**
 * Checks whether a template reference like {{@nodeId:Label.field}}
 * points to a node that exists in the workflow (or is the built-in
 * __system pseudo-node).
 */
export function doesNodeExist(
  template: string,
  nodes: ReadonlyArray<{ id: string }>
): boolean {
  const match = template.match(TEMPLATE_REF_PATTERN);
  if (!match) {
    return false;
  }

  const nodeId = match[1];
  if (nodeId === BUILTIN_NODE_ID) {
    return true;
  }
  return nodes.some((n) => n.id === nodeId);
}
