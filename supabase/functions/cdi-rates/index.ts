const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

const SGS_START = '1986-03-06'

function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const parsed = new Date(`${value}T12:00:00Z`)
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? null : parsed
}

function formatBcbDate(date: Date): string {
  return `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${date.getUTCFullYear()}`
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Método não permitido.' }), { status: 405, headers: corsHeaders })

  try {
    const body = await request.json()
    const start = parseIsoDate(body.startDate)
    const end = parseIsoDate(body.endDate)
    if (!start || !end || start > end) {
      return new Response(JSON.stringify({ error: 'Informe um período válido para consultar o CDI.' }), { status: 400, headers: corsHeaders })
    }

    const coverageStart = start < new Date(`${SGS_START}T12:00:00Z`) ? new Date(`${SGS_START}T12:00:00Z`) : start
    const rates: Array<{ date: string; value: number }> = []
    let segmentStart = coverageStart

    // Keep each request comfortably below the SGS daily-series period limit.
    while (segmentStart <= end) {
      const segmentEnd = new Date(segmentStart)
      segmentEnd.setUTCFullYear(segmentEnd.getUTCFullYear() + 5)
      segmentEnd.setUTCDate(segmentEnd.getUTCDate() - 1)
      if (segmentEnd > end) segmentEnd.setTime(end.getTime())

      const url = new URL('https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados')
      url.searchParams.set('formato', 'json')
      url.searchParams.set('dataInicial', formatBcbDate(segmentStart))
      url.searchParams.set('dataFinal', formatBcbDate(segmentEnd))
      const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) })
      if (!response.ok) throw new Error(`Banco Central respondeu com status ${response.status}.`)
      const rows = await response.json()
      if (!Array.isArray(rows)) throw new Error('A resposta do Banco Central veio em formato inesperado.')
      for (const row of rows) {
        const [day, month, year] = String(row.data).split('/')
        const value = Number(row.valor)
        if (day && month && year && Number.isFinite(value)) rates.push({ date: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`, value })
      }

      segmentStart = new Date(segmentEnd)
      segmentStart.setUTCDate(segmentStart.getUTCDate() + 1)
    }

    rates.sort((a, b) => a.date.localeCompare(b.date))
    return new Response(JSON.stringify({ rates, coverageStart: coverageStart.toISOString().slice(0, 10), updatedAt: rates.at(-1)?.date || null }), { headers: corsHeaders })
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Não foi possível consultar o CDI.' }), { status: 502, headers: corsHeaders })
  }
})
