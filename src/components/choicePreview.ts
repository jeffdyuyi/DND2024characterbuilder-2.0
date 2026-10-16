/** Resolve a preview within its own candidate group without changing saved choices. */
export function resolveChoicePreview<T>(
  candidates: readonly T[],
  previewId: string | null | undefined,
  selectedIds: readonly string[],
  references: (candidate: T) => readonly (string | undefined)[],
  fallbackToFirst = false,
): T | undefined {
  const find = (id: string) => candidates.find((candidate) => references(candidate).includes(id));
  if (previewId) {
    const preview = find(previewId);
    if (preview !== undefined) return preview;
  }
  for (const id of selectedIds) {
    const selected = find(id);
    if (selected !== undefined) return selected;
  }
  return fallbackToFirst ? candidates[0] : undefined;
}
