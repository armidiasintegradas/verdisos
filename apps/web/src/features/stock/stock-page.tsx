import { useEffect, useMemo, useState } from 'react'
import { useScope } from '@/features/scope/scope-provider'
import { loadStockOverview, type StockOverview } from '@/services/stock/stock-overview-service'
import { Breadcrumb } from '@/ui/components/breadcrumb'
import { Button } from '@/ui/components/button'
import { FilterBar } from '@/ui/components/filter-bar'
import { MetricCard } from '@/ui/components/metric-card'
import { PageHeader } from '@/ui/components/page-header'

function formatKg(value: number) {
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(value)} kg`
}

function formatMovementDate(value: string | null) {
  if (!value) return 'Sem movimentação'
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

export function StockPage() {
  const { activeScope } = useScope()
  const [overview, setOverview] = useState<StockOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')

  useEffect(() => {
    let cancelled = false

    if (!activeScope) {
      setOverview(null)
      setLoading(false)
      return () => { cancelled = true }
    }

    setLoading(true)
    setErrorMessage(null)

    void loadStockOverview(activeScope)
      .then((result) => {
        if (!cancelled) setOverview(result)
      })
      .catch(() => {
        if (!cancelled) {
          setOverview(null)
          setErrorMessage('Não foi possível carregar o estoque deste contexto.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [activeScope])

  const categories = useMemo(
    () => [...new Set((overview?.items ?? []).map((item) => item.category))].sort(),
    [overview],
  )

  const filteredItems = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase('pt-BR')
    return (overview?.items ?? []).filter((item) => {
      const matchesSearch =
        !normalized ||
        item.material.toLocaleLowerCase('pt-BR').includes(normalized) ||
        item.category.toLocaleLowerCase('pt-BR').includes(normalized)
      const matchesCategory = category === 'all' || item.category === category
      return matchesSearch && matchesCategory
    })
  }, [overview, search, category])

  if (loading) {
    return (
      <div className="v-page-grid">
        <div>
          <Breadcrumb items={[{ label: 'Início', href: '/' }, { label: 'Estoque' }]} />
          <PageHeader title="Estoque" description="Saldo atual dos materiais na unidade operacional." />
        </div>
        <div className="v-receipt-panel">Carregando estoque...</div>
      </div>
    )
  }

  if (errorMessage) {
    return (
      <div className="v-page-grid">
        <div>
          <Breadcrumb items={[{ label: 'Início', href: '/' }, { label: 'Estoque' }]} />
          <PageHeader title="Estoque" description="Saldo atual dos materiais na unidade operacional." />
        </div>
        <div className="v-receipt-alert v-receipt-alert--error">{errorMessage}</div>
      </div>
    )
  }

  const data = overview ?? {
    items: [],
    totalKg: 0,
    receivedTodayKg: 0,
    dispatchedTodayKg: 0,
  }

  return (
    <div className="v-page-grid">
      <div>
        <Breadcrumb items={[{ label: 'Início', href: '/' }, { label: 'Estoque' }]} />
        <PageHeader title="Estoque" description="Saldo atual dos materiais na unidade operacional." />
      </div>

      <div className="v-metrics-grid">
        <MetricCard label="Estoque total" value={formatKg(data.totalKg)} detail="Saldo calculado a partir das entradas e saídas registradas." />
        <MetricCard label="Materiais com saldo" value={String(data.items.filter((item) => item.balanceKg > 0).length)} detail="Materiais com saldo operacional" />
        <MetricCard label="Entradas hoje" value={formatKg(data.receivedTodayKg)} detail="Total de entradas do dia" tone="positive" />
        <MetricCard label="Saídas hoje" value={formatKg(data.dispatchedTodayKg)} detail="Total de saídas do dia" />
      </div>

      <FilterBar>
        <input
          className="v-control v-filter-search"
          aria-label="Buscar material"
          placeholder="Buscar material..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          className="v-control"
          aria-label="Categoria"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="all">Categoria: Todas</option>
          {categories.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <span className="v-control" aria-label="Unidade">Escopo operacional ativo</span>
        <select className="v-control" aria-label="Ordenar" defaultValue="balance">
          <option value="balance">Ordenar por: Maior saldo</option>
        </select>
        <button
          className="v-button v-button--tertiary"
          type="button"
          onClick={() => {
            setSearch('')
            setCategory('all')
          }}
        >
          Limpar filtros
        </button>
      </FilterBar>

      <section aria-labelledby="stock-list-title">
        <div className="v-section-heading">
          <h2 id="stock-list-title">Materiais registrados ({filteredItems.length})</h2>
          <span className="v-row__meta">Saldo derivado das movimentações registradas</span>
        </div>

        {filteredItems.length === 0 ? (
          <div className="v-receipt-panel">
            <strong>Nenhum material com movimentação neste contexto.</strong>
            <p>Os saldos aparecerão após o primeiro recebimento confirmado.</p>
          </div>
        ) : (
          <div className="v-list">
            {filteredItems.map((item) => (
              <article className="v-row" key={item.materialId}>
                <div>
                  <div className="v-row__title">{item.material}</div>
                  <div className="v-row__meta">{item.category}</div>
                </div>
                <div>
                  <div className="v-row__meta">SALDO ATUAL</div>
                  <div className="v-row__value">{formatKg(item.balanceKg)}</div>
                </div>
                <div>
                  <div>Última movimentação</div>
                  <div className="v-row__meta">{formatMovementDate(item.lastMovementAt)}</div>
                </div>
                <div className="v-row__actions">
                  <Button variant="secondary" disabled>DETALHE EM BREVE</Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="v-integrity-note">Os saldos são calculados a partir do ledger imutável de movimentações.</div>
    </div>
  )
}
