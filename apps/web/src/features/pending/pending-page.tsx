import { useEffect, useMemo, useState } from 'react'
import { useRouter } from '@/app/router'
import { useScope } from '@/features/scope/scope-provider'
import { loadPendingOverview, type PendingOverview } from '@/services/pending/pending-overview-service'
import { Breadcrumb } from '@/ui/components/breadcrumb'
import { Button } from '@/ui/components/button'
import { FilterBar } from '@/ui/components/filter-bar'
import { MetricCard } from '@/ui/components/metric-card'
import { PageHeader } from '@/ui/components/page-header'
import { StatusBadge } from '@/ui/components/status-badge'

export function PendingPage() {
  const { navigate } = useRouter()
  const { activeScope } = useScope()
  const [overview, setOverview] = useState<PendingOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [type, setType] = useState('all')

  useEffect(() => {
    let cancelled = false

    if (!activeScope) {
      setOverview(null)
      setLoading(false)
      return () => { cancelled = true }
    }

    setLoading(true)
    setErrorMessage(null)

    void loadPendingOverview(activeScope)
      .then((result) => {
        if (!cancelled) setOverview(result)
      })
      .catch(() => {
        if (!cancelled) {
          setOverview(null)
          setErrorMessage('Não foi possível carregar as pendências deste contexto.')
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
        item.title.toLocaleLowerCase('pt-BR').includes(normalized) ||
        item.material.toLocaleLowerCase('pt-BR').includes(normalized) ||
        item.message.toLocaleLowerCase('pt-BR').includes(normalized)
      const matchesType = type === 'all' || item.type === type
      return matchesSearch && matchesType
    })
  }, [overview, search, type])

  if (loading) {
    return (
      <div className="v-page-grid">
        <div>
          <Breadcrumb items={[{ label: 'Início', href: '/' }, { label: 'Pendências' }]} />
          <PageHeader title="Pendências" description="Itens que precisam da sua ação para completar movimentações." />
        </div>
        <div className="v-receipt-panel">Carregando pendências...</div>
      </div>
    )
  }

  if (errorMessage) {
    return (
      <div className="v-page-grid">
        <div>
          <Breadcrumb items={[{ label: 'Início', href: '/' }, { label: 'Pendências' }]} />
          <PageHeader title="Pendências" description="Itens que precisam da sua ação para completar movimentações." />
        </div>
        <div className="v-receipt-alert v-receipt-alert--error">{errorMessage}</div>
      </div>
    )
  }

  const data = overview ?? {
    items: [],
    openCount: 0,
    missingDocumentCount: 0,
    exceptionCount: 0,
    resolvedTodayCount: 0,
  }

  return (
    <div className="v-page-grid">
      <div>
        <Breadcrumb items={[{ label: 'Início', href: '/' }, { label: 'Pendências' }]} />
        <PageHeader title="Pendências" description="Itens que precisam da sua ação para completar movimentações." />
      </div>

      <div className="v-metrics-grid">
        <MetricCard label="Pendências abertas" value={String(data.openCount)} detail="Aguardando ação" tone="attention" />
        <MetricCard label="Documentos ausentes" value={String(data.missingDocumentCount)} detail="Anexação necessária" tone="attention" />
        <MetricCard label="Exceções" value={String(data.exceptionCount)} detail="Análise operacional necessária" tone="attention" />
        <MetricCard label="Resolvidas hoje" value={String(data.resolvedTodayCount)} detail="Concluídas" tone="positive" />
      </div>

      <FilterBar>
        <input
          className="v-control v-filter-search"
          aria-label="Buscar pendência"
          placeholder="Buscar pendência..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select className="v-control" aria-label="Tipo" value={type} onChange={(event) => setType(event.target.value)}>
          <option value="all">Tipo: Todos</option>
          <option value="missing_document">Documento ausente</option>
          <option value="audit_exception">Exceção operacional</option>
        </select>
        <select className="v-control" aria-label="Origem" defaultValue="all"><option value="all">Origem: Todas</option></select>
        <select className="v-control" aria-label="Período" defaultValue="all"><option value="all">Período: Todos</option></select>
        <select className="v-control" aria-label="Status" defaultValue="open"><option value="open">Status: Abertas</option></select>
        <button
          className="v-button v-button--tertiary"
          type="button"
          onClick={() => {
            setSearch('')
            setType('all')
          }}
        >
          Limpar filtros
        </button>
      </FilterBar>

      <section aria-labelledby="pending-list-title">
        <div className="v-section-heading">
          <h2 id="pending-list-title">Requer sua ação</h2>
          <span className="v-row__meta">{filteredItems.length} item{filteredItems.length === 1 ? '' : 's'}</span>
        </div>

        {filteredItems.length === 0 ? (
          <div className="v-receipt-panel">
            <strong>Nenhuma pendência operacional.</strong>
            <p>Quando uma movimentação exigir ação humana, ela aparecerá aqui.</p>
          </div>
        ) : (
          <div className="v-list">
            {filteredItems.map((item) => (
              <article className="v-pending-card" key={item.id}>
                <div className="v-pending-card__topline">
                  <StatusBadge tone="attention">
                    {item.type === 'missing_document' ? 'Documento ausente' : 'Exceção operacional'}
                  </StatusBadge>
                  <strong>{item.title}</strong>
                  <span>{item.material}</span>
                </div>
                <div className="v-pending-card__body">
                  <div>
                    <strong>{item.message}</strong>
                    <p>
                      {item.type === 'missing_document'
                        ? 'Anexe o documento à movimentação para completar a rastreabilidade.'
                        : 'Revise a exceção e registre a decisão humana na trilha de auditoria.'}
                    </p>
                  </div>
                  <div className="v-row__actions">
                    <Button onClick={() => navigate(item.href)}>
                      {item.type === 'missing_document' ? 'ANEXAR DOCUMENTO →' : 'ANALISAR →'}
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
