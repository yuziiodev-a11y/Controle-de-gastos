const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const parsed = new Date(`${value}T12:00:00Z`)
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? null : parsed
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const data = payload as Record<string, unknown>
    for (const key of ['error', 'message', 'mensagem']) {
      if (typeof data[key] === 'string' && data[key]) return data[key] as string
    }
  }
  return fallback
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

    // SGS date range requests can return non-JSON error bodies for large ranges.
    // Fetch a bounded recent history, then select only the dates this pot needs.
    const url = new URL('https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/2600')
    url.searchParams.set('formato', 'json')
    const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) })
    const responseText = await response.text()
    let payload: unknown
    try {
      payload = JSON.parse(responseText)
    } catch {
      throw new Error(`Banco Central devolveu uma resposta inválida (HTTP ${response.status}).`)
    }
    if (!response.ok) {
      throw new Error(getErrorMessage(payload, `Banco Central respondeu com status ${response.status}.`))
    }

    const rows = Array.isArray(payload)
      ? payload
      : payload && typeof payload === 'object' && Array.isArray((payload as Record<string, unknown>).data)
        ? (payload as { data: unknown[] }).data
        : null
    if (!rows) {
      throw new Error(getErrorMessage(payload, `Banco Central retornou um formato inesperado: ${JSON.stringify(payload).slice(0, 180)}`))
    }

    const parsedRates: Array<{ date: string; value: number }> = []
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue
      const data = row as Record<string, unknown>
      const [day, month, year] = String(data.data ?? '').split('/')
      const value = Number(data.valor)
      if (day && month && year && Number.isFinite(value)) {
        parsedRates.push({ date: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`, value })
      }
    }
    parsedRates.sort((a, b) => a.date.localeCompare(b.date))

    const startDate = start.toISOString().slice(0, 10)
    const endDate = end.toISOString().slice(0, 10)
    const coverageStart = parsedRates[0]?.date ?? null
    if (coverageStart && startDate < coverageStart) {
      return new Response(JSON.stringify({ error: `O histórico disponível do CDI começa em ${coverageStart.split('-').reverse().join('/')}. Este cofrinho foi criado antes desse período.` }), { status: 422, headers: corsHeaders })
    }

    const rates = parsedRates.filter((rate) => rate.date >= startDate && rate.date <= endDate)
    return new Response(JSON.stringify({ rates, coverageStart, updatedAt: parsedRates.at(-1)?.date ?? null }), { headers: corsHeaders })
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Não foi possível consultar o CDI.' }), { status: 502, headers: corsHeaders })
  }
})
