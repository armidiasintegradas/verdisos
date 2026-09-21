import type { ActiveScope } from '@/domain/scope'
import { listAuditExceptions } from '@/features/audit/audit-service'
import { loadReceiptsOverview } from '@/services/receipts/receipts-overview-service'
import { loadSalesOverview } from '@/services/sales/sales-overview-service'

export type PendingOperationalItem = {
  id: string
  type: 'missing_document' | 'audit_exception'
  title: string
  material: string
  message: string
  href: string
}

export type PendingOverview = {
  items: PendingOperationalItem[]
  openCount: number
  missingDocumentCount: number
  exceptionCount: number
  resolvedTodayCount: number
}

function startOfTodayIso() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
}

export async function loadPendingOverview(scope: ActiveScope): Promise<PendingOverview> {
  const [receipts, sales, exceptions] = await Promise.all([
    loadReceiptsOverview(scope),
    loadSalesOverview(scope),
    listAuditExceptions(scope),
  ])

  const receiptItems: PendingOperationalItem[] = receipts.items
    .filter((item) => item.documentState === 'missing')
    .map((item) => ({
      id: `receipt-${item.movementId}`,
      type: 'missing_document',
      title: `Recebimento #${item.movementId.slice(0, 8)}`,
      material: item.material,
      message: 'Este recebimento ainda não possui documento vinculado.',
      href: `/recebimentos/novo/${item.movementId}?step=comprovacao`,
    }))

  const saleItems: PendingOperationalItem[] = sales.items
    .filter((item) => item.documentState === 'missing')
    .map((item) => ({
      id: `sale-${item.movementId}`,
      type: 'missing_document',
      title: `Venda #${item.movementId.slice(0, 8)}`,
      material: item.material,
      message: 'Esta venda ainda não possui documento vinculado.',
      href: `/vendas/nova/${item.movementId}?step=comprovacao`,
    }))

  const exceptionItems: PendingOperationalItem[] = exceptions
    .filter((item) => item.state === 'open' || item.state === 'in_review')
    .map((item) => ({
      id: `exception-${item.id}`,
      type: 'audit_exception',
      title: `Exceção #${item.id.slice(0, 8)}`,
      material: item.subjectType,
      message: item.state === 'in_review'
        ? 'Exceção operacional em análise e aguardando conclusão.'
        : 'Exceção operacional aberta e aguardando ação humana.',
      href: '/auditoria',
    }))

  const todayStart = startOfTodayIso()
  const resolvedTodayCount = exceptions.filter(
    (item) => Boolean(item.resolvedAt && item.resolvedAt >= todayStart),
  ).length

  const items = [...receiptItems, ...saleItems, ...exceptionItems]

  return {
    items,
    openCount: items.length,
    missingDocumentCount: receiptItems.length + saleItems.length,
    exceptionCount: exceptionItems.length,
    resolvedTodayCount,
  }
}
