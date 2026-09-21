import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { RouterProvider } from '@/app/router'
import { ScopeProvider, type ScopeMembership } from '@/features/scope/scope-provider'
import { HomePage } from './home-page'

const mocks = vi.hoisted(() => ({
  loadReceiptsOverview: vi.fn(),
  loadSalesOverview: vi.fn(),
  loadStockOverview: vi.fn(),
  listAuditExceptions: vi.fn(),
}))

vi.mock('@/services/receipts/receipts-overview-service', () => ({
  loadReceiptsOverview: mocks.loadReceiptsOverview,
}))
vi.mock('@/services/sales/sales-overview-service', () => ({
  loadSalesOverview: mocks.loadSalesOverview,
}))
vi.mock('@/services/stock/stock-overview-service', () => ({
  loadStockOverview: mocks.loadStockOverview,
}))
vi.mock('@/features/audit/audit-service', () => ({
  listAuditExceptions: mocks.listAuditExceptions,
}))

const membership: ScopeMembership = {
  membershipId: 'membership-id',
  roleId: 'role-id',
  tenantId: 'tenant-id',
  organizationId: 'org-id',
  unitId: 'unit-id',
}

test('renders real operational aggregates without pilot fixtures', async () => {
  mocks.loadReceiptsOverview.mockResolvedValue({
    receivedTodayKg: 480,
    receiptCountToday: 1,
    missingDocumentCount: 0,
    processingDocumentCount: 0,
    items: [],
  })
  mocks.loadSalesOverview.mockResolvedValue({
    salesCountToday: 1,
    soldTodayKg: 1000,
    soldTodayAmount: 3200,
    missingDocumentCount: 0,
    items: [],
  })
  mocks.loadStockOverview.mockResolvedValue({
    totalKg: 4200,
    receivedTodayKg: 480,
    dispatchedTodayKg: 1000,
    items: [],
  })
  mocks.listAuditExceptions.mockResolvedValue([])

  render(
    <ScopeProvider loadMemberships={async () => [membership]}>
      <RouterProvider initialPath="/">
        <HomePage />
      </RouterProvider>
    </ScopeProvider>,
  )

  expect(await screen.findByText('480 kg')).toBeInTheDocument()
  expect(screen.getByText('4.200 kg')).toBeInTheDocument()
  expect(screen.queryByText('Bom dia, Maria.')).not.toBeInTheDocument()
})
