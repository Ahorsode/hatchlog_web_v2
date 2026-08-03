export function parseFeedSource(source: string): {
  feedTypeId: string | null
  formulationId: string | null
} {
  if (source.startsWith('inv_')) {
    return { feedTypeId: source.slice(4), formulationId: null }
  }
  if (source.startsWith('form_')) {
    return { feedTypeId: null, formulationId: source.slice(5) }
  }
  return { feedTypeId: null, formulationId: null }
}

export function feedSourceFromLog(log: {
  feedTypeId?: string | null
  formulationId?: string | null
}): string {
  if (log.feedTypeId) return `inv_${log.feedTypeId}`
  if (log.formulationId) return `form_${log.formulationId}`
  return ''
}
