import type { ActiveScope } from '@/domain/scope'
import { supabase } from '@/lib/supabase/client'

export type SaleListItem = {
  saleId: string
  movementId: string
  material: string
  quantityKg: number
  buyer: string
  unitPrice: number
  totalAmount: number
  soldAt: string
  documentState: 'processed' | 'processing' | 'failed' | 'missing'
}

export type SalesOverview = {
  items: SaleListItem[]
  salesCountToday: number
  soldTodayKg: number
  soldTodayAmount: number
  missingDocumentCount: number
}

function startOfTodayIso() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
}

export async function loadSalesOverview(scope: ActiveScope): Promise<SalesOverview> {
  let salesQuery = supabase
    .from('sales')
    .select('id, movement_id, buyer_counterparty_id, material_id, quantity_kg, unit_price, total_amount, sold_at, fiscal_document_id')
    .eq('tenant_id', scope.tenantId)
    .eq('organization_id', scope.organizationId)
    .order('sold_at', { ascending: false })
    .limit(100)

  if (scope.unitId) salesQuery = salesQuery.eq('unit_id', scope.unitId)

  const { data: sales, error: salesError } = await salesQuery
  if (salesError) throw salesError

  const materialIds = [...new Set((sales ?? []).map((row) => row.material_id))]
  const buyerIds = [...new Set((sales ?? []).map((row) => row.buyer_counterparty_id))]
  const documentIds = [
    ...new Set(
      (sales ?? [])
        .map((row) => row.fiscal_document_id)
        .filter((value): value is string => Boolean(value)),
    ),
  ]

  const [materialsResult, buyersResult, documentsResult] = await Promise.all([
    materialIds.length
      ? supabase.from('materials').select('id, name').in('id', materialIds)
      : Promise.resolve({ data: [], error: null }),
    buyerIds.length
      ? supabase.from('counterparties').select('id, external_name').in('id', buyerIds)
      : Promise.resolve({ data: [], error: null }),
    documentIds.length
      ? supabase.from('documents').select('id, extraction_status').in('id', documentIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (materialsResult.error) throw materialsResult.error
  if (buyersResult.error) throw buyersResult.error
  if (documentsResult.error) throw documentsResult.error

  const materialNames = new Map((materialsResult.data ?? []).map((row) => [row.id, row.name]))
  const buyerNames = new Map(
    (buyersResult.data ?? []).map((row) => [
      row.id,
      row.external_name?.trim() || 'Comprador cadastrado',
    ]),
  )
  const documentStates = new Map(
    (documentsResult.data ?? []).map((row) => [row.id, row.extraction_status]),
  )

  const items: SaleListItem[] = (sales ?? []).map((sale) => {
    const extraction = sale.fiscal_document_id
      ? documentStates.get(sale.fiscal_document_id)
      : null

    let documentState: SaleListItem['documentState'] = 'missing'
    if (extraction === 'rejected') documentState = 'failed'
    else if (extraction === 'accepted' || extraction === 'needs_review') documentState = 'processed'
    else if (sale.fiscal_document_id) documentState = 'processing'

    return {
      saleId: sale.id,
      movementId: sale.movement_id,
      material: materialNames.get(sale.material_id) ?? 'Material',
      quantityKg: Number(sale.quantity_kg),
      buyer: buyerNames.get(sale.buyer_counterparty_id) ?? 'Comprador cadastrado',
      unitPrice: Number(sale.unit_price),
      totalAmount: Number(sale.total_amount ?? Number(sale.quantity_kg) * Number(sale.unit_price)),
      soldAt: sale.sold_at,
      documentState,
    }
  })

  const todayStart = startOfTodayIso()
  const todayItems = items.filter((item) => item.soldAt >= todayStart)

  return {
    items,
    salesCountToday: todayItems.length,
    soldTodayKg: todayItems.reduce((sum, item) => sum + item.quantityKg, 0),
    soldTodayAmount: todayItems.reduce((sum, item) => sum + item.totalAmount, 0),
    missingDocumentCount: items.filter((item) => item.documentState === 'missing').length,
  }
}
