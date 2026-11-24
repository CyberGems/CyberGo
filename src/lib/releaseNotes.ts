/** Extracts a short, plain-text preview from the suite's bilingual GitHub release template. */
export function releaseNotesPeek(body: string | undefined, language: 'en' | 'es'): string[] {
  if (!body) return [];
  const details = /<details\b[^>]*>\s*<summary\b[^>]*>(.*?)<\/summary>(.*?)<\/details>/gis;
  const spanish = language === 'es'
    ? Array.from(body.matchAll(details)).find((block) => /español|spanish/i.test(block[1]))
    : undefined;
  const local = (spanish?.[2]?.trim() || body.replace(details, ''))
    .replace(/<!--.*?-->|<p\b[^>]*>.*?<\/p>|\x60{3}.*?\x60{3}/gis, '')
    .split(/^#{2,6}[^\S\r\n]+[^\r\n]*(?:Before you install|Antes de instalar|Downloads|Descargas|VirusTotal|Checksums)/im)[0];
  const paragraphs: string[] = [];
  const bullets: string[] = [];
  for (const line of local.split(/\r?\n/).map((value) => value.trim())) {
    if (!line || /^[#>|<]/.test(line) || /^-{3,}$|^\*Crafted with precision|^Full changelog:/i.test(line)) continue;
    const bullet = /^[-*+•]\s+/.test(line);
    const cleaned = line.replace(/^[-*+•]\s+/, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/^\p{Extended_Pictographic}[\ufe0f\s]*/u, '')
      .replace(/\*\*|__|\x60/g, '').trim();
    if (cleaned) (bullet ? bullets : paragraphs).push(cleaned);
  }
  return Array.from(new Set(bullets.length ? bullets : paragraphs)).slice(0, 4);
}
