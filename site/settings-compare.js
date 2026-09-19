// Firestore maps may arrive with their keys in a different order on each read.
// Compare values, while keeping array order significant, before saving a draft.
export function sameSettingsValue(a, b) {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length
      && a.every((value, index) => sameSettingsValue(value, b[index]));
  }
  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  }
  if (typeof a.isEqual === 'function') return a.isEqual(b);
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length
    && keys.every(key => Object.hasOwn(b, key) && sameSettingsValue(a[key], b[key]));
}

export function assertSettingsUnchanged(current, baseline, paths) {
  const valueAt = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);
  for (const path of paths) {
    if (!sameSettingsValue(valueAt(current, path), valueAt(baseline, path))) {
      const error = new Error('다른 화면에서 같은 항목이 변경되었습니다.');
      error.code = 'cm/conflict';
      throw error;
    }
  }
}
