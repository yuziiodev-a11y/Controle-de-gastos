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

function formatBcbDate(date: Date): string {
  return `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${date.getUTCFullYear()}`
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const data = payload as Record<string, unknown>
    for (const key of ['error', 'message', 'mensagem', 'detail']) {
      if (typeof data[key] === 'string' && data[key]) return data[key] as string
    }
    const nestedError = data.erro ?? data.error
    if (nestedError && typeof nestedError === 'object') {
      const nested = nestedError as Record<string, unknown>
      for (const key of ['detail', 'message', 'mensagem']) {
        if (typeof nested[key] === 'string' && nested[key]) return nested[key] as string
      }
    }
  }
  return fallback
}

function isEmptySgsResult(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false
  const data = payload as Record<string, unknown>
  const nestedError = data.erro ?? data.error
  if (!nestedError || typeof nestedError !== 'object') return false
  const nested = nestedError as Record<string, unknown>
  return Number(nested.statusCode) === 404 && String(nested.detail ?? '').includes('Value(s) not found')
}

async function fetchRateChunk(start: Date, end: Date): Promise<Array<{ date: string; value: number }>> {
  const url = new URL('https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados')
  url.searchParams.set('formato', 'json')
  url.searchParams.set('dataInicial', formatBcbDate(start))
  url.searchParams.set('dataFinal', formatBcbDate(end))

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  })
  const responseText = await response.text()
  let payload: unknown

  try {
    payload = JSON.parse(responseText)
  } catch {
    throw new Error(`Banco Central devolveu uma resposta inválida (HTTP ${response.status}).`)
  }

  // O SGS representa intervalos sem observações com esse erro, inclusive
  // quando a resposta HTTP vem como 200. Isso é normal em fins de semana,
  // feriados e datas ainda não publicadas.
  if (isEmptySgsResult(payload)) return []

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

  const rates: Array<{ date: string; value: number }> = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const data = row as Record<string, unknown>
    const [day, month, year] = String(data.data ?? '').split('/')
    const value = Number(data.valor)
    if (day && month && year && Number.isFinite(value)) {
      rates.push({ date: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`, value })
    }
  }
  return rates
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido.' }), { status: 405, headers: corsHeaders })
  }

  try {
    const body = await request.json()
    const start = parseIsoDate(body.startDate)
    const end = parseIsoDate(body.endDate)
    if (!start || !end || start > end) {
      return new Response(JSON.stringify({ error: 'Informe um período válido para consultar o CDI.' }), { status: 400, headers: corsHeaders })
    }

    // O SGS limita cada consulta a 20 valores. Janelas de 20 dias mantêm
    // cada resposta abaixo do limite mesmo em períodos sem feriados.
    const chunks: Array<{ start: Date; end: Date }> = []
    let chunkStart = start
    while (chunkStart <= end) {
      const chunkEnd = new Date(chunkStart)
      chunkEnd.setUTCDate(chunkEnd.getUTCDate() + 19)
      if (chunkEnd > end) chunkEnd.setTime(end.getTime())
      chunks.push({ start: chunkStart, end: chunkEnd })
      chunkStart = new Date(chunkEnd)
      chunkStart.setUTCDate(chunkStart.getUTCDate() + 1)
    }

    const rates: Array<{ date: string; value: number }> = []
    // Limit concurrency so a long-lived savings pot does not overload the BCB API.
    for (let index = 0; index < chunks.length; index += 5) {
      const batch = chunks.slice(index, index + 5)
      const batchRates = await Promise.all(batch.map(({ start: chunkStartDate, end: chunkEndDate }) => fetchRateChunk(chunkStartDate, chunkEndDate)))
      rates.push(...batchRates.flat())
    }

    rates.sort((a, b) => a.date.localeCompare(b.date))
    return new Response(JSON.stringify({
      rates,
      coverageStart: rates[0]?.date ?? start.toISOString().slice(0, 10),
      updatedAt: rates.at(-1)?.date ?? null,
    }), { headers: corsHeaders })
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Não foi possível consultar o CDI.' }), { status: 502, headers: corsHeaders })
  }
})
