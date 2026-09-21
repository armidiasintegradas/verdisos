import type { ActiveScope } from '@/domain/scope'
import { supabase } from '@/lib/supabase/client'

export type StockOverviewItem = {
  materialId: string
  material: string
  category: string
  balanceKg: number
  lastMovementAt: string | null
}

export type StockOverview = {
  items: StockOverviewItem[]
  totalKg: number
  receivedTodayKg: number
  dispatchedTodayKg: number
}

function applyScope<T extends { eq: (column: string, value: string) => T }>(
  query: T,
  scope: ActiveScope,
) {
  let scoped = query
    .eq('tenant_id', scope.tenantId)
    .eq('organization_id', scope.organizationId)

  if (scope.unitId) {
    scoped = scoped.eq('unit_id', scope.unitId)
  }

  return scoped
}

function startOfTodayIso() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return start.toISOString()
}

export async function loadStockOverview(scope: ActiveScope): Promise<StockOverview> {
  const stockQuery = applyScope(
    supabase
      .from('current_stock')
      .select('material_id, quantity_kg, tenant_id, organization_id, unit_id'),
    scope,
  )

  const ledgerQuery = applyScope(
    supabase
      .from('stock_ledger_entries')
      .select('material_id, delta_kg, occurred_at, tenant_id, organization_id, unit_id')
      .order('occurred_at', { ascending: false }),
    scope,
  )

  const materialsQuery = supabase
    .from('materials')
    .select('id, name, category')
    .eq('tenant_id', scope.tenantId)
    .eq('active', true)

  const [stockResult, ledgerResult, materialsResult] = await Promise.all([
    stockQuery,
    ledgerQuery,
    materialsQuery,
  ])

  if (stockResult.error) throw stockResult.error
  if (ledgerResult.error) throw ledgerResult.error
  if (materialsResult.error) throw materialsResult.error

  const balances = new Map<string, number>()
  for (const row of stockResult.data ?? []) {
    if (!row.material_id) continue
    balances.set(
      row.material_id,
      (balances.get(row.material_id) ?? 0) + Number(row.quantity_kg ?? 0),
    )
  }

  const latestMovement = new Map<string, string>()
  const todayStart = startOfTodayIso()
  let receivedTodayKg = 0
  let dispatchedTodayKg = 0

  for (const row of ledgerResult.data ?? []) {
    if (!latestMovement.has(row.material_id)) {
      latestMovement.set(row.material_id, row.occurred_at)
    }

    if (row.occurred_at >= todayStart) {
      const delta = Number(row.delta_kg)
      if (delta > 0) receivedTodayKg += delta
      if (delta < 0) dispatchedTodayKg += Math.abs(delta)
    }
  }

  const items = (materialsResult.data ?? [])
    .map((material) => ({
      materialId: material.id,
      material: material.name,
      category: material.category,
      balanceKg: balances.get(material.id) ?? 0,
      lastMovementAt: latestMovement.get(material.id) ?? null,
    }))
    .filter((item) => item.balanceKg !== 0 || item.lastMovementAt !== null)
    .sort((left, right) => right.balanceKg - left.balanceKg)

  return {
    items,
    totalKg: items.reduce((sum, item) => sum + item.balanceKg, 0),
    receivedTodayKg,
    dispatchedTodayKg,
  }
}
