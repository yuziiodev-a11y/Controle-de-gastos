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
