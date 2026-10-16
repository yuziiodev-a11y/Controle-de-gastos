import { ArrowRight, BookOpen, CreditCard, Plus, PiggyBank, ReceiptText, Repeat } from 'lucide-react'

export function GettingStarted({ onCreateEntry, onCreateCard, onCreatePot, onCreateRecurring, onOpenTutorial }) {
  return <section className="getting-started panel" aria-labelledby="getting-started-title">
    <div className="getting-started-intro">
      <span className="eyebrow">PRIMEIROS PASSOS</span>
      <h2 id="getting-started-title">Vamos organizar seu dinheiro, uma coisa de cada vez.</h2>
      <p>Comece registrando uma conta ou receita. O resumo do mês vai ganhar informações conforme você usar o app.</p>
      <button className="button primary" type="button" onClick={onCreateEntry}><Plus size={16}/> Registrar primeira conta ou receita</button>
    </div>
    <div className="getting-started-next">
      <span className="getting-started-step"><i>1</i><ReceiptText size={16}/><span><b>Registre uma movimentação</b><small>Uma despesa ou valor que vai receber.</small></span></span>
      <details className="getting-started-options">
        <summary>Ver outras opções (se precisar)</summary>
        <button type="button" onClick={onCreateCard}><CreditCard size={15}/><span><b>Cartão de crédito</b><small>Acompanhe compras e faturas.</small></span><ArrowRight size={14}/></button>
        <button type="button" onClick={onCreatePot}><PiggyBank size={15}/><span><b>Cofrinho</b><small>Separe dinheiro para um objetivo.</small></span><ArrowRight size={14}/></button>
        <button type="button" onClick={onCreateRecurring}><Repeat size={15}/><span><b>Conta recorrente</b><small>Automatize um valor mensal fixo.</small></span><ArrowRight size={14}/></button>
      </details>
      <button className="getting-started-tutorial" type="button" onClick={onOpenTutorial}><BookOpen size={15}/> Prefere conhecer o app primeiro? Abrir tutorial</button>
    </div>
  </section>
}
