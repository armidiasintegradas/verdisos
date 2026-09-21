import { useEffect, useMemo, useState } from 'react'
import { useRouter } from '@/app/router'
import { useScope } from '@/features/scope/scope-provider'
import { loadReceiptsOverview, type ReceiptsOverview } from '@/services/receipts/receipts-overview-service'
import { Breadcrumb } from '@/ui/components/breadcrumb'
import { Button } from '@/ui/components/button'
import { FilterBar } from '@/ui/components/filter-bar'
import { MetricCard } from '@/ui/components/metric-card'
import { PageHeader } from '@/ui/components/page-header'
import { StatusBadge } from '@/ui/components/status-badge'

function formatKg(value: number) {
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(value)} kg`
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
  if (state === 'failed') return <StatusBadge tone="error">Falha de processamento</StatusBadge>
  return <StatusBadge tone="attention">Sem documento</StatusBadge>
}

export function ReceiptsPage() {
  const { navigate } = useRouter()
  const { activeScope } = useScope()
  const [overview, setOverview] = useState<ReceiptsOverview | null>(null)
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

    void loadReceiptsOverview(activeScope)
      .then((result) => {
        if (!cancelled) setOverview(result)
      })
      .catch(() => {
        if (!cancelled) {
          setOverview(null)
          setErrorMessage('Não foi possível carregar os recebimentos deste contexto.')
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
        item.counterparty.toLocaleLowerCase('pt-BR').includes(normalized) ||
        item.movementId.toLocaleLowerCase('pt-BR').includes(normalized)
      const matchesStatus = status === 'all' || item.documentState === status
      return matchesSearch && matchesStatus
    })
  }, [overview, search, status])

  if (loading) {
    return (
      <div className="v-page-grid">
        <div>
          <Breadcrumb items={[{ label: 'Início', href: '/' }, { label: 'Recebimentos' }]} />
          <PageHeader title="Recebimentos" description="Entradas de materiais registradas na unidade operacional." />
        </div>
        <div className="v-receipt-panel">Carregando recebimentos...</div>
      </div>
    )
  }

  if (errorMessage) {
    return (
      <div className="v-page-grid">
        <div>
          <Breadcrumb items={[{ label: 'Início', href: '/' }, { label: 'Recebimentos' }]} />
          <PageHeader title="Recebimentos" description="Entradas de materiais registradas na unidade operacional." />
        </div>
        <div className="v-receipt-alert v-receipt-alert--error">{errorMessage}</div>
      </div>
    )
  }

  const data = overview ?? {
    items: [],
    receivedTodayKg: 0,
    receiptCountToday: 0,
    missingDocumentCount: 0,
    processingDocumentCount: 0,
  }

  return (
    <div className="v-page-grid">
      <div>
        <Breadcrumb items={[{ label: 'Início', href: '/' }, { label: 'Recebimentos' }]} />
        <PageHeader
          title="Recebimentos"
          description="Entradas de materiais registradas na unidade operacional."
          action={<Button onClick={() => navigate('/recebimentos/novo?step=dados')}>+ RECEBER MATERIAL</Button>}
        />
      </div>

      <div className="v-metrics-grid">
        <MetricCard label="Recebido hoje" value={formatKg(data.receivedTodayKg)} detail={`${data.receiptCountToday} registro${data.receiptCountToday === 1 ? '' : 's'}`} />
        <MetricCard label="Recebimentos hoje" value={String(data.receiptCountToday)} detail="Entradas registradas na unidade" />
        <MetricCard label="Sem documento" value={String(data.missingDocumentCount)} detail="Movimentações sem comprovação" tone="attention" />
        <MetricCard label="Processando" value={String(data.processingDocumentCount)} detail="Documentos em processamento" />
      </div>

      <FilterBar>
        <input
          className="v-control v-filter-search"
          aria-label="Buscar recebimento"
          placeholder="Buscar recebimento..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select className="v-control" aria-label="Período" defaultValue="all"><option value="all">Todos os períodos</option></select>
        <select className="v-control" aria-label="Material" defaultValue="all"><option value="all">Todos os materiais</option></select>
        <select className="v-control" aria-label="Origem" defaultValue="all"><option value="all">Todas as origens</option></select>
        <select className="v-control" aria-label="Status" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">Todos os status</option>
          <option value="processed">Documento processado</option>
          <option value="processing">Processando</option>
          <option value="failed">Falha</option>
          <option value="missing">Sem documento</option>
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

      <section aria-labelledby="receipts-list-title">
        <div className="v-section-heading">
          <h2 id="receipts-list-title">Recebimentos registrados</h2>
          <span className="v-row__meta">Mais recentes primeiro</span>
        </div>

        {filteredItems.length === 0 ? (
          <div className="v-receipt-panel">
            <strong>Nenhum recebimento encontrado.</strong>
            <p>Registre a primeira entrada de material para iniciar a operação.</p>
          </div>
        ) : (
          <div className="v-list">
            {filteredItems.map((movement) => (
              <article className="v-row" key={movement.movementId}>
                <div>
                  <div className="v-row__title">Recebimento #{movement.movementId.slice(0, 8)}</div>
                  <div className="v-row__meta">{movement.material}</div>
                </div>
                <div>
                  <div className="v-row__value">{formatKg(movement.quantityKg)}</div>
                  <div className="v-row__meta">{formatDate(movement.occurredAt)}</div>
                </div>
                <div>
                  <div>{movement.counterparty}</div>
                  <div className="v-row__meta">{documentStatus(movement.documentState)}</div>
                </div>
                <div className="v-row__actions">
                  <Button
                    variant="secondary"
                    onClick={() => navigate(`/recebimentos/novo/${movement.movementId}?step=concluir`)}
                  >
                    ABRIR
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
