// Simple Diff algorithm adapted for basic text comparison
// Returns an array of objects: { value: string, added?: boolean, removed?: boolean }

export function computeDiff(oldText, newText) {
  // A very basic word-level diff implementation
  const oldWords = oldText.split(/(\s+)/);
  const newWords = newText.split(/(\s+)/);
  
  // This is a naive O(N*M) LCS approach for simplicity in a standalone script.
  // For production with large texts, 'diff-match-patch' lib is better, but this suffices for descriptions.
  
  const matrix = Array(oldWords.length + 1).fill(null).map(() => Array(newWords.length + 1).fill(0));
  
  for (let i = 1; i <= oldWords.length; i++) {
    for (let j = 1; j <= newWords.length; j++) {
      if (oldWords[i - 1] === newWords[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1] + 1;
      } else {
        matrix[i][j] = Math.max(matrix[i - 1][j], matrix[i][j - 1]);
      }
    }
  }

  const result = [];
  let i = oldWords.length;
  let j = newWords.length;

  while (i > 0 && j > 0) {
    if (oldWords[i - 1] === newWords[j - 1]) {
      result.unshift({ value: oldWords[i - 1] });
      i--;
      j--;
    } else if (matrix[i - 1][j] > matrix[i][j - 1]) {
      result.unshift({ value: oldWords[i - 1], removed: true });
      i--;
    } else {
      result.unshift({ value: newWords[j - 1], added: true });
      j--;
    }
  }

  while (i > 0) {
    result.unshift({ value: oldWords[i - 1], removed: true });
    i--;
  }
  while (j > 0) {
    result.unshift({ value: newWords[j - 1], added: true });
    j--;
  }

  return result;
}
