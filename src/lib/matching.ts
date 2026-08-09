export type MatchType = "contains" | "exact" | "any";

/**
 * Deixa o texto comparável: sem acento, minúsculo, sem pontuação de borda e
 * com espaços colapsados.
 *
 * Sem isso "Análise", "analise" e "ANALISE!" seriam três palavras diferentes,
 * e quem comenta no Instagram escreve das três formas.
 */
export function normalize(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    // _ fica: nome de usuário do Instagram usa underscore, e menção é
    // palavra-chave legítima. Ponto e vírgula viram espaço.
    .replace(/[^\p{L}\p{N}\s#@_]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Decide se o texto dispara a automação.
 *
 * - contains: a palavra-chave aparece em qualquer lugar, respeitando limite
 *   de palavra — "quero" não casa dentro de "querosene".
 * - exact:    o texto inteiro é exatamente a palavra-chave.
 * - any:      qualquer texto serve, inclusive vazio.
 */
export function matches(
  text: string,
  keywords: string[],
  matchType: MatchType,
): boolean {
  if (matchType === "any") return true;

  const haystack = normalize(text);
  if (!haystack) return false;

  const needles = keywords.map(normalize).filter(Boolean);
  if (needles.length === 0) return false;

  if (matchType === "exact") {
    return needles.includes(haystack);
  }

  // contains, com limite de palavra nas duas pontas
  const words = haystack.split(" ");
  return needles.some((needle) => {
    const parts = needle.split(" ");
    if (parts.length === 1) return words.includes(needle);
    // palavra-chave com mais de uma palavra: procura a sequência
    for (let i = 0; i + parts.length <= words.length; i++) {
      if (parts.every((p, j) => words[i + j] === p)) return true;
    }
    return false;
  });
}

/** Troca {{primeiro_nome}} e {{usuario}} pelos valores reais. */
export function render(
  template: string,
  vars: { username?: string | null; firstName?: string | null },
): string {
  const usuario = vars.username ?? "";
  const primeiro = vars.firstName ?? vars.username ?? "";
  return template
    .replace(/\{\{\s*primeiro_nome\s*\}\}/gi, primeiro)
    .replace(/\{\{\s*usuario\s*\}\}/gi, usuario)
    .replace(/\s{2,}/g, " ")
    .trim();
}
