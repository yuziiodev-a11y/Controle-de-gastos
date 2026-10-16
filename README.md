# Meu Controle — Sistema de gastos

Aplicação para registrar gastos manualmente e acompanhar o total de cada fatura. Cada pessoa cria uma conta própria; as políticas de Row Level Security (RLS) do Supabase impedem o acesso aos dados de outro usuário.

## Tecnologias

- JavaScript, React e Vite no frontend.
- Supabase Auth para cadastro e login por e-mail e senha.
- Supabase Database (PostgreSQL) e RLS para dados privados por usuário.

O Supabase fornece o backend gerenciado, então não há servidor Node separado.

## Iniciar

1. Crie um projeto em [Supabase](https://supabase.com/dashboard).
2. Copie `.env.example` para `.env` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com a URL e a chave publicável do projeto.
3. Se ainda não aplicou o schema inicial, execute `supabase/migrations/202610160001_initial_schema.sql` no SQL Editor do Supabase.
4. Para ativar contas a pagar e a receber, execute `supabase/migrations/202610160002_payable_receivable.sql` no SQL Editor. Ela preserva os gastos já registrados.
5. Execute `supabase/migrations/202610160003_settled_dates.sql` para registrar separadamente a data em que cada conta foi paga ou recebida.
6. Execute `supabase/migrations/202610160004_payment_methods.sql` para separar pagamentos em Pix, dinheiro, débito e crédito. Somente compras no crédito associadas a um cartão entram na fatura.
7. Na pasta do projeto, execute `npm install` e depois `npm run dev`.
8. Abra o endereço local mostrado pelo Vite e crie sua conta.

O frontend usa apenas a chave publicável. Nunca coloque uma chave `service_role` no navegador ou no arquivo `.env` do frontend. A visão mensal pode ser alternada para meses passados e futuros; contas podem ser editadas e marcadas como pagas/recebidas. Pagamentos em Pix, dinheiro e débito são despesas normais, mas não entram na fatura do cartão. Cartões têm uma seção separada, com totais de fatura do mês selecionado. Cada parcela deve ser lançada separadamente, associada ao mês da fatura correspondente.

### Cofrinhos

A área Cofrinhos acompanha saldos guardados manualmente, com saldo inicial, meta opcional e movimentações de depósito e retirada. Esses valores ficam separados dos lançamentos de despesas e receitas para evitar contar uma transferência para poupança como um gasto adicional. Para habilitar o recurso, execute `202610160005_savings_pots.sql` no SQL Editor do Supabase, depois das migrações anteriores.

### Orçamento, recorrências e relatórios

Execute `supabase/migrations/202610160006_budgets_recurring.sql` no SQL Editor, depois da migração 005. A visão mensal permite salvar limites por categoria e mês, pesquisar/filtrar lançamentos e comparar entradas e despesas dos últimos seis meses. A página Recorrências cria automaticamente uma conta a pagar ou receber para o mês selecionado; cada regra gera no máximo um lançamento por mês, e lançamentos já gerados ficam preservados mesmo quando a regra é pausada ou excluída. A sobra estimada considera o resultado previsto do mês menos os depósitos registrados nos cofrinhos; é uma estimativa baseada nos dados lançados, não um saldo bancário.

### Limites dos cartões

Para guardar o limite total e o valor disponível atual de cada cartão, execute `supabase/migrations/202610160007_card_credit_limits.sql` depois das migrações anteriores. Os campos são opcionais e o limite disponível é informado manualmente a partir do aplicativo do cartão.

### Recursos novos (migração 008)

Execute `supabase/migrations/202610160008_finance_expansions.sql` no SQL Editor depois da migração 007. Ela habilita:

- **Compras parceladas:** em um lançamento no cartão, informe o total e o número de parcelas. O sistema distribui o total em centavos pelas faturas mensais seguintes e cria cada parcela como pendente. O valor total pode não dividir exatamente; os centavos restantes são distribuídos nas primeiras parcelas. Excluir uma parcela exclui o grupo inteiro.
- **Metas com prazo:** informe a meta e a data final no cofrinho. A página calcula quanto guardar por mês considerando o saldo atual e os meses até a data.
- **Lembretes:** o painel mensal mostra contas pendentes com vencimento nos próximos sete dias. A configuração de e-mail permite escolher antecedência de 1, 2, 3 ou 7 dias.
- **Visão anual:** compare entradas, despesas e resultado de cada mês; clique em um mês para abrir a visão mensal.
- **Categorias personalizadas:** crie categorias separadas para despesas e receitas. Excluir uma categoria não altera lançamentos antigos.

#### Ativar lembretes automáticos por e-mail

O lembrete por e-mail usa uma Supabase Edge Function agendada e o serviço Resend. Você precisa de uma chave de API do Resend e de um endereço de remetente verificado no Resend. A chave e o segredo de chamada ficam somente nos segredos da Edge Function; não os coloque em `VITE_*` nem no frontend. Consulte os guias oficiais do [Supabase para envio via Resend](https://supabase.com/docs/guides/functions/examples/send-emails) e para [segredos de Edge Functions](https://supabase.com/docs/guides/functions/secrets).

1. No Resend, crie uma API key e verifique o domínio/endereço que será usado como remetente.
2. No terminal, na pasta do projeto, vincule a pasta Supabase ao projeto: `supabase link --project-ref SEU_PROJECT_REF`.
3. Configure os segredos (substitua os valores pelos seus; não os envie em chats nem os adicione ao Git):

   ```sh
   supabase secrets set RESEND_API_KEY=re_... REMINDER_FROM_EMAIL="Meu Controle <lembretes@seudominio.com>" REMINDER_CRON_SECRET="gere-uma-string-aleatoria-longa"
   ```

   No Supabase hospedado, a função recebe as chaves administrativas do projeto pelo ambiente de execução; nenhuma chave administrativa deve ser copiada para o navegador.
4. Publique a função: `supabase functions deploy send-due-reminders`.
5. No painel do Supabase, habilite as extensões `pg_cron`, `pg_net` e `supabase_vault` (Vault). No SQL Editor, salve a URL do projeto e o mesmo segredo `REMINDER_CRON_SECRET` no Vault:

   ```sql
   select vault.create_secret('https://SEU_PROJECT_REF.supabase.co', 'reminder_project_url');
   select vault.create_secret('COLE_AQUI_O_MESMO_REMINDER_CRON_SECRET', 'reminder_cron_secret');
   ```

6. Ainda no SQL Editor, agende a execução diária às 12:00 UTC (09:00 no horário de Brasília/Bahia):

   ```sql
   select cron.schedule(
     'meu-controle-due-reminders',
     '0 12 * * *',
     $$
       select net.http_post(
         url := (select decrypted_secret from vault.decrypted_secrets where name = 'reminder_project_url' limit 1) || '/functions/v1/send-due-reminders',
         headers := jsonb_build_object(
           'Content-Type', 'application/json',
           'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'reminder_cron_secret' limit 1)
         ),
         body := '{}'::jsonb
       );
     $$
   );
   ```

A função envia um resumo apenas dos lançamentos pendentes que vencem na antecedência escolhida e registra cada envio para evitar repetição. O agendamento usa `pg_cron` + `pg_net` e guarda o segredo no Vault, conforme o [guia oficial do Supabase para agendar Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions). Você pode conferir/pausar o job na página Cron do Supabase.
