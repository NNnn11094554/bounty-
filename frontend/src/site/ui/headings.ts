/**
 * Части заголовка: слова (через пробел) и, для языков без пробелов (китайский, японский), куски между '|' —
 * там перенос разрешён, но пробела нет. Каждая часть не рвётся внутри.
 */
export function headingParts(text: string): Array<{ text: string; space: boolean }> {
  const parts: Array<{ text: string; space: boolean }> = [];
  for (const [w, word] of text.split(' ').entries())
    for (const [p, piece] of word.split('|').entries())
      if (piece) parts.push({ text: piece, space: parts.length > 0 && w > 0 && p === 0 });
  return parts;
}
