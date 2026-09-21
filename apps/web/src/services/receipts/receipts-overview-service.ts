import type { ActiveScope } from '@/domain/scope'
import { supabase } from '@/lib/supabase/client'

export type ReceiptListItem = {
  movementId: string
  material: string
  quantityKg: number
  counterparty: string
  occurredAt: string
  documentState: 'processed' | 'processing' | 'failed' | 'missing'
}

export type ReceiptsOverview = {
  items: ReceiptListItem[]
  receivedTodayKg: number
  receiptCountToday: number
  missingDocumentCount: number
  processingDocumentCount: number
}

function startOfTodayIso() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
}

export async function loadReceiptsOverview(scope: ActiveScope): Promise<ReceiptsOverview> {
  let movementQuery = supabase
    .from('movements')
    .select('id, material_id, quantity_kg, source_counterparty_id, occurred_at, status')
    .eq('tenant_id', scope.tenantId)
    .eq('organization_id', scope.organizationId)
    .eq('movement_type', 'receipt')
    .order('occurred_at', { ascending: false })
    .limit(100)

  if (scope.unitId) movementQuery = movementQuery.eq('unit_id', scope.unitId)

  const { data: movements, error: movementError } = await movementQuery
  if (movementError) throw movementError

  const materialIds = [...new Set((movements ?? []).map((row) => row.material_id))]
  const counterpartyIds = [
    ...new Set(
      (movements ?? [])
        .map((row) => row.source_counterparty_id)
        .filter((value): value is string => Boolean(value)),
    ),
  ]
  const movementIds = (movements ?? []).map((row) => row.id)

  const [materialsResult, counterpartiesResult, evidencesResult] = await Promise.all([
    materialIds.length
      ? supabase.from('materials').select('id, name').in('id', materialIds)
      : Promise.resolve({ data: [], error: null }),
    counterpartyIds.length
      ? supabase.from('counterparties').select('id, external_name').in('id', counterpartyIds)
      : Promise.resolve({ data: [], error: null }),
    movementIds.length
      ? supabase.from('evidences').select('movement_id, document_id, status').in('movement_id', movementIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (materialsResult.error) throw materialsResult.error
  if (counterpartiesResult.error) throw counterpartiesResult.error
  if (evidencesResult.error) throw evidencesResult.error

  const documentIds = [
    ...new Set(
      (evidencesResult.data ?? [])
        .map((row) => row.document_id)
        .filter((value): value is string => Boolean(value)),
    ),
  ]

  const documentsResult = documentIds.length
    ? await supabase
        .from('documents')
        .select('id, extraction_status')
        .in('id', documentIds)
    : { data: [], error: null }

  if (documentsResult.error) throw documentsResult.error

  const materialNames = new Map((materialsResult.data ?? []).map((row) => [row.id, row.name]))
  const counterpartyNames = new Map(
    (counterpartiesResult.data ?? []).map((row) => [
      row.id,
      row.external_name?.trim() || 'Contraparte cadastrada',
    ]),
  )
  const documentsById = new Map(
    (documentsResult.data ?? []).map((row) => [row.id, row.extraction_status]),
  )
  const evidenceByMovement = new Map(
    (evidencesResult.data ?? []).map((row) => [row.movement_id, row]),
  )

  const items: ReceiptListItem[] = (movements ?? []).map((movement) => {
    const evidence = evidenceByMovement.get(movement.id)
    const extraction = evidence?.document_id ? documentsById.get(evidence.document_id) : null

    let documentState: ReceiptListItem['documentState'] = 'missing'
    if (extraction === 'processed') documentState = 'processed'
    else if (extraction === 'failed') documentState = 'failed'
    else if (evidence?.document_id) documentState = 'processing'

    return {
      movementId: movement.id,
      material: materialNames.get(movement.material_id) ?? 'Material',
      quantityKg: Number(movement.quantity_kg),
      counterparty: movement.source_counterparty_id
        ? counterpartyNames.get(movement.source_counterparty_id) ?? 'Contraparte cadastrada'
        : 'Origem não informada',
      occurredAt: movement.occurred_at,
      documentState,
    }
  })

  const todayStart = startOfTodayIso()
  const todayItems = items.filter((item) => item.occurredAt >= todayStart)

  return {
    items,
    receivedTodayKg: todayItems.reduce((sum, item) => sum + item.quantityKg, 0),
    receiptCountToday: todayItems.length,
    missingDocumentCount: items.filter((item) => item.documentState === 'missing').length,
    processingDocumentCount: items.filter((item) => item.documentState === 'processing').length,
  }
}
