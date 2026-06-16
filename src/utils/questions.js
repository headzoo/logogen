export function createQuestion(label = '') {
  return {
    id: crypto.randomUUID(),
    label,
  };
}
