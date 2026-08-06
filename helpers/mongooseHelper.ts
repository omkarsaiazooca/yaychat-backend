export function toPlain<T = any>(doc: any): T {
  if (!doc) return doc;
  if (typeof doc.toObject === "function") {
    // strips mongoose internals without using .lean()
    const plain = doc.toObject({ getters: false, virtuals: false, versionKey: false });
    // extra safety:
    delete (plain as any).$__;
    delete (plain as any)._doc;
    delete (plain as any).$isNew;
    return plain as T;
  }
  // fallback works for hydrated docs too (uses toJSON under the hood)
  return JSON.parse(JSON.stringify(doc)) as T;
}