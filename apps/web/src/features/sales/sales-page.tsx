import { useEffect, useMemo, useState } from 'react'
import { useRouter } from '@/app/router'
import { useScope } from '@/features/scope/scope-provider'
import { loadSalesOverview, type SalesOverview } from '@/services/sales/sales-overview-service'
import { Breadcrumb } from '@/ui/components/breadcrumb'
import { Button } from '@/ui/components/button'
import { FilterBar } from '@/ui/components/filter-bar'
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

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function documentStatus(state: 'processed' | 'processing' | 'failed' | 'missing') {
  if (state === 'processed') return <StatusBadge tone="positive">Documento processado</StatusBadge>
  if (state === 'processing') return <StatusBadge tone="processing">Processando</StatusBadge>
  if (state === 'failed') return <StatusBadge tone="error">Falha</StatusBadge>
  return <StatusBadge tone="attention">Documento pendente</StatusBadge>
}

export function SalesPage() {
  const { navigate } = useRouter()
  const { activeScope } = useScope()
  const [overview, setOverview] = useState<SalesOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')

  useEffect(() => {
    let cancelled = false

    if (!activeScope) {
      setOverview(null)
      setLoading(false)
      return () => { cancelled = true }
    }

    setLoading(true)
    setErrorMessage(null)

    void loadSalesOverview(activeScope)
      .then((result) => {
        if (!cancelled) setOverview(result)
      })
      .catch(() => {
        if (!cancelled) {
          setOverview(null)
          setErrorMessage('Não foi possível carregar as vendas deste contexto.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [activeScope])

  const filteredItems = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase('pt-BR')
    return (overview?.items ?? []).filter((item) => {
      const matchesSearch =
        !normalized ||
        item.material.toLocaleLowerCase('pt-BR').includes(normalized) ||
        item.buyer.toLocaleLowerCase('pt-BR').includes(normalized) ||
        item.movementId.toLocaleLowerCase('pt-BR').includes(normalized)
      const matchesStatus = status === 'all' || item.documentState === status
      return matchesSearch && matchesStatus
    })
  }, [overview, search, status])

  if (loading) {
    return (
      <div className="v-page-grid">
        <div>
          <Breadcrumb items={[{ label: 'Início', href: '/' }, { label: 'Vendas' }]} />
          <PageHeader title="Vendas" description="Saídas comerciais de materiais registradas na unidade operacional." />
        </div>
        <div className="v-receipt-panel">Carregando vendas...</div>
      </div>
    )
  }

  if (errorMessage) {
    return (
      <div className="v-page-grid">
        <div>
          <Breadcrumb items={[{ label: 'Início', href: '/' }, { label: 'Vendas' }]} />
          <PageHeader title="Vendas" description="Saídas comerciais de materiais registradas na unidade operacional." />
        </div>
        <div className="v-receipt-alert v-receipt-alert--error">{errorMessage}</div>
      </div>
    )
  }

  const data = overview ?? {
    items: [],
    salesCountToday: 0,
    soldTodayKg: 0,
    soldTodayAmount: 0,
    missingDocumentCount: 0,
  }

  return (
    <div className="v-page-grid">
      <div>
        <Breadcrumb items={[{ label: 'Início', href: '/' }, { label: 'Vendas' }]} />
        <PageHeader
          title="Vendas"
          description="Saídas comerciais de materiais registradas na unidade operacional."
          action={<Button onClick={() => navigate('/vendas/nova?step=dados')}>+ REGISTRAR VENDA</Button>}
        />
      </div>

      <div className="v-metrics-grid">
        <MetricCard label="Vendido hoje" value={formatCurrency(data.soldTodayAmount)} detail={`${data.salesCountToday} venda${data.salesCountToday === 1 ? '' : 's'} registrada${data.salesCountToday === 1 ? '' : 's'}`} tone="positive" />
        <MetricCard label="Saídas hoje" value={String(data.salesCountToday)} detail="Expedições comerciais" />
        <MetricCard label="Material vendido hoje" value={formatKg(data.soldTodayKg)} detail="Volume total vendido hoje" />
        <MetricCard label="Documentos pendentes" value={String(data.missingDocumentCount)} detail="Vendas sem documento" tone="attention" />
      </div>

      <FilterBar>
        <input
          className="v-control v-filter-search"
          aria-label="Buscar venda"
          placeholder="Buscar venda..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select className="v-control" aria-label="Período" defaultValue="all"><option value="all">Período: Todos</option></select>
        <select className="v-control" aria-label="Material" defaultValue="all"><option value="all">Material: Todos</option></select>
        <select className="v-control" aria-label="Comprador" defaultValue="all"><option value="all">Comprador: Todos</option></select>
        <select className="v-control" aria-label="Comprovação" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">Comprovação: Todos</option>
          <option value="processed">Documento processado</option>
          <option value="processing">Processando</option>
          <option value="failed">Falha</option>
          <option value="missing">Documento pendente</option>
        </select>
        <button
          className="v-button v-button--tertiary"
          type="button"
          onClick={() => {
            setSearch('')
            setStatus('all')
          }}
        >
          Limpar filtros
        </button>
      </FilterBar>

      <section aria-labelledby="sales-list-title">
        <div className="v-section-heading">
          <h2 id="sales-list-title">Vendas registradas</h2>
          <span className="v-row__meta">Ordenadas por data mais recente</span>
        </div>

        {filteredItems.length === 0 ? (
          <div className="v-receipt-panel">
            <strong>Nenhuma venda encontrada.</strong>
            <p>Registre a primeira venda para iniciar o histórico comercial.</p>
          </div>
        ) : (
          <div className="v-list">
            {filteredItems.map((sale) => (
              <article className="v-row v-row--sales" key={sale.saleId}>
                <div>
                  <div className="v-row__title">Venda #{sale.movementId.slice(0, 8)}</div>
                  <div className="v-row__meta">{sale.material} · {sale.buyer} · {formatDate(sale.soldAt)}</div>
                </div>
                <div>
                  <div className="v-row__value">{formatKg(sale.quantityKg)}</div>
                  <div className="v-row__meta">{formatCurrency(sale.unitPrice)} / kg</div>
                </div>
                <div>
                  <div className="v-row__value">{formatCurrency(sale.totalAmount)}</div>
                  <div className="v-row__meta">VALOR TOTAL</div>
                </div>
                <div className="v-row__actions">
                  {documentStatus(sale.documentState)}
                  <Button
                    variant="secondary"
                    onClick={() => navigate(`/vendas/nova/${sale.movementId}?step=concluir`)}
                  >
                    ABRIR
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="v-integrity-note">Os registros refletem vendas persistidas, baixa de estoque e documentos vinculados ao escopo ativo.</div>
    </div>
  )
}
