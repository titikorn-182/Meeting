import { DEMO_TODAY } from './fixtures/workspace';

const DEMO_YEAR = String(Number(DEMO_TODAY.slice(0, 4)) + 543);

/** Local display sequence, including legacy demo formats. Real multi-user numbering belongs on the server. */
export function nextDisplayCode(
  kind: 'resolution' | 'task' | 'change',
  existingCodes: string[],
  year = DEMO_YEAR,
): string {
  const patterns =
    kind === 'resolution'
      ? [new RegExp(`^มติ ${year}/(\\d+)$`), new RegExp(`^มติ (\\d+)/${year}$`)]
      : kind === 'task'
        ? [/^งาน-(\d+)$/, /^T-(\d+)$/]
        : [new RegExp(`^CR-${year}-(\\d+)$`), new RegExp(`^CR-(\\d+)/${year}$`)];
  const max = existingCodes.reduce((largest, code) => {
    for (const pattern of patterns) {
      const match = code.match(pattern);
      if (match) return Math.max(largest, Number(match[1]));
    }
    return largest;
  }, 0);
  const serial = String(max + 1).padStart(3, '0');
  return kind === 'resolution'
    ? `มติ ${year}/${serial}`
    : kind === 'task'
      ? `งาน-${serial}`
      : `CR-${year}-${serial}`;
}
