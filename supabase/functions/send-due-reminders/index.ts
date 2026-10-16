import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders })

  const cronSecret = Deno.env.get('REMINDER_CRON_SECRET')
  if (!cronSecret || request.headers.get('Authorization') !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')
  const serviceKey = secretKeys.default ?? Object.values(secretKeys)[0] ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('REMINDER_FROM_EMAIL')
  if (!supabaseUrl || !serviceKey || !resendKey || !from) {
    return new Response('Missing server configuration', { status: 500, headers: corsHeaders })
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const today = new Date().toISOString().slice(0, 10)
  const { data: settings, error: settingsError } = await admin.from('reminder_settings').select('user_id,days_before').eq('enabled', true)
  if (settingsError) return new Response('Could not read reminder settings', { status: 500, headers: corsHeaders })

  let sent = 0
  for (const setting of settings ?? []) {
    const due = new Date(`${today}T12:00:00Z`)
    due.setUTCDate(due.getUTCDate() + Number(setting.days_before))
    const dueDate = due.toISOString().slice(0, 10)
    const { data: expenses, error } = await admin.from('expenses')
      .select('id,description,amount,kind,due_date')
      .eq('user_id', setting.user_id).eq('status', 'pending').eq('due_date', dueDate)
    if (error || !expenses?.length) continue

    const { data: dispatched } = await admin.from('reminder_dispatches').select('expense_id')
      .eq('user_id', setting.user_id).eq('reminder_date', today)
      .in('expense_id', expenses.map((item) => item.id))
    const sentIds = new Set((dispatched ?? []).map((item) => item.expense_id))
    const fresh = expenses.filter((item) => !sentIds.has(item.id))
    if (!fresh.length) continue

    const { data: userResult } = await admin.auth.admin.getUserById(setting.user_id)
    const email = userResult.user?.email
    if (!email) continue

    const lines = fresh.map((item) => `<li><strong>${escapeHtml(item.description)}</strong> — ${item.kind === 'income' ? 'a receber' : 'a pagar'}: R$ ${Number(item.amount).toFixed(2).replace('.', ',')}</li>`).join('')
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from, to: [email], subject: `Lembrete: ${fresh.length} vencimento${fresh.length === 1 ? '' : 's'} em ${new Date(`${dueDate}T12:00:00`).toLocaleDateString('pt-BR')}`,
        html: `<div style="font-family:Arial,sans-serif;color:#27163e"><h2>Contas próximas do vencimento</h2><p>Estes lançamentos vencem em ${new Date(`${dueDate}T12:00:00`).toLocaleDateString('pt-BR')}:</p><ul>${lines}</ul><p>Enviado pelo Meu Controle.</p></div>`,
      }),
    })
    if (!response.ok) continue
    const { error: saveError } = await admin.from('reminder_dispatches').upsert(
      fresh.map((item) => ({ user_id: setting.user_id, expense_id: item.id, reminder_date: today })),
      { onConflict: 'user_id,expense_id,reminder_date', ignoreDuplicates: true },
    )
    if (!saveError) sent += fresh.length
  }

  return Response.json({ sent, date: today }, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
