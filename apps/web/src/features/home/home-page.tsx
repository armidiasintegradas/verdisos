import { useEffect, useState } from 'react'
import { RouterLink } from '@/app/router'
import { useScope } from '@/features/scope/scope-provider'
import { listAuditExceptions } from '@/features/audit/audit-service'
import { loadReceiptsOverview, type ReceiptsOverview } from '@/services/receipts/receipts-overview-service'
import { loadSalesOverview, type SalesOverview } from '@/services/sales/sales-overview-service'
import { loadStockOverview, type StockOverview } from '@/services/stock/stock-overview-service'
import { Breadcrumb } from '@/ui/components/breadcrumb'
import { Card } from '@/ui/components/card'
import { MetricCard } from '@/ui/components/metric-card'
import { PageHeader } from '@/ui/components/page-header'
import { StatusBadge } from '@/ui/components/status-badge'

function formatKg(value: number) {
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(value)} kg`
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

type HomeData = {
  receipts: ReceiptsOverview
  sales: SalesOverview
  stock: StockOverview
  pendingCount: number
}

export function HomePage() {
  const { activeScope } = useScope()
  const [data, setData] = useState<HomeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    if (!activeScope) {
      setData(null)
      setLoading(false)
      return () => { cancelled = true }
    }

    setLoading(true)
    setErrorMessage(null)

    void Promise.all([
      loadReceiptsOverview(activeScope),
      loadSalesOverview(activeScope),
      loadStockOverview(activeScope),
      listAuditExceptions(activeScope),
    ])
      .then(([receipts, sales, stock, exceptions]) => {
        if (cancelled) return
        setData({
          receipts,
          sales,
          stock,
          pendingCount: exceptions.filter((item) => item.state === 'open' || item.state === 'in_review').length,
        })
      })
      .catch(() => {
        if (!cancelled) {
          setData(null)
          setErrorMessage('Não foi possível carregar o resumo operacional.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [activeScope])

  if (loading) {
    return (
      <div className="v-page-grid">
        <div>
          <Breadcrumb items={[{ label: 'Início' }]} />
          <PageHeader title="Início" description="Carregando o resumo da operação..." />
        </div>
      </div>
    )
  }

  if (errorMessage) {
    return (
      <div className="v-page-grid">
        <div>
          <Breadcrumb items={[{ label: 'Início' }]} />
          <PageHeader title="Início" description="Visão operacional do contexto ativo." />
        </div>
        <div className="v-receipt-alert v-receipt-alert--error">{errorMessage}</div>
      </div>
    )
  }

  const receipts = data?.receipts
  const sales = data?.sales
  const stock = data?.stock
  const latestReceipt = receipts?.items[0]
  const latestSale = sales?.items[0]

  return (
    <div className="v-page-grid">
      <div>
        <Breadcrumb items={[{ label: 'Início' }]} />
        <PageHeader
          title="Início"
          description="Acompanhe recebimentos, vendas, estoque e ações que precisam de resposta na unidade operacional."
        />
      </div>

      <div className="v-home-actions">
        <RouterLink className="v-home-action v-home-action--primary" to="/recebimentos/novo?step=dados">
          <span><strong>+ RECEBER MATERIAL</strong><small>Registrar uma nova entrada de material</small></span>
          <span aria-hidden="true">→</span>
        </RouterLink>
        <RouterLink className="v-home-action" to="/vendas/nova?step=dados">
          <span><strong>+ REGISTRAR VENDA</strong><small>Registrar uma saída comercial de material</small></span>
          <span aria-hidden="true">→</span>
        </RouterLink>
      </div>

      <section aria-labelledby="home-summary-title">
        <div className="v-section-heading">
          <h2 id="home-summary-title">Resumo de hoje</h2>
          <span className="v-row__meta">{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date())}</span>
        </div>
        <div className="v-metrics-grid">
          <MetricCard label="Recebido hoje" value={formatKg(receipts?.receivedTodayKg ?? 0)} detail={`${receipts?.receiptCountToday ?? 0} registros`} />
          <MetricCard label="Vendido hoje" value={formatCurrency(sales?.soldTodayAmount ?? 0)} detail={`${sales?.salesCountToday ?? 0} vendas registradas`} tone="positive" />
          <MetricCard label="Estoque atual" value={formatKg(stock?.totalKg ?? 0)} detail="Saldo operacional do contexto ativo" />
          <MetricCard label="Pendências" value={String(data?.pendingCount ?? 0)} detail="Exceções que requerem resposta" tone="attention" />
        </div>
      </section>

      <Card className="v-content-card">
        <div className="v-section-heading">
          <h2>Pendências prioritárias</h2>
          <RouterLink to="/pendencias">Ver todas →</RouterLink>
        </div>
        {(data?.pendingCount ?? 0) === 0 ? (
          <div className="v-integrity-note">Nenhuma exceção operacional aberta neste contexto.</div>
        ) : (
          <div className="v-home-pending">
            <StatusBadge tone="attention">{data?.pendingCount} pendência{data?.pendingCount === 1 ? '' : 's'}</StatusBadge>
            <div>
              <strong>Ação humana necessária</strong>
              <p>Existem exceções operacionais abertas ou em análise.</p>
            </div>
            <RouterLink className="v-button v-button--secondary" to="/pendencias">Resolver</RouterLink>
          </div>
        )}
      </Card>

      <Card className="v-content-card">
        <div className="v-section-heading"><h2>Últimas atividades registradas</h2></div>
        {!latestReceipt && !latestSale ? (
          <div className="v-integrity-note">Nenhuma movimentação registrada neste contexto.</div>
        ) : (
          <div className="v-activity-grid">
            {latestReceipt ? (
              <div>
                <small>RECEBIMENTO</small>
                <strong>#{latestReceipt.movementId.slice(0, 8)}</strong>
                <span>{latestReceipt.material} · {formatKg(latestReceipt.quantityKg)}</span>
              </div>
            ) : null}
            {latestSale ? (
              <div>
                <small>VENDA</small>
                <strong>#{latestSale.movementId.slice(0, 8)}</strong>
                <span>{latestSale.material} · {formatKg(latestSale.quantityKg)}</span>
              </div>
            ) : null}
            <div>
              <small>RASTREABILIDADE</small>
              <strong>{data?.pendingCount ?? 0} exceções abertas</strong>
              <span>Dados derivados do escopo operacional autenticado</span>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
