/** A class choice can be stored under either its catalog ID or its English name. */
export function isClassSelectionForOwner(key: string, owners: readonly string[]): boolean {
  const lowerKey = key.toLowerCase();
  return owners.some((owner) => lowerKey.startsWith(`cls:${owner.toLowerCase()}:`));
}

export function isActiveClassSelection(key: string, owners: readonly string[]): boolean {
  return !key.toLowerCase().startsWith('cls:') || isClassSelectionForOwner(key, owners);
}
