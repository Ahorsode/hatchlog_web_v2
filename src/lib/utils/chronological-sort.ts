export function compareNewestFirst(
  a: { date: Date | string; id?: string | null },
  b: { date: Date | string; id?: string | null },
): number {
  const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime()
  if (dateDiff !== 0) return dateDiff
  return String(b.id ?? '').localeCompare(String(a.id ?? ''))
}
