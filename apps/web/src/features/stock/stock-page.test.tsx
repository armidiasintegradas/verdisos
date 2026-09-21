import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { RouterProvider } from '@/app/router'
import { ScopeProvider, type ScopeMembership } from '@/features/scope/scope-provider'
import { StockPage } from './stock-page'

const mocks = vi.hoisted(() => ({ loadStockOverview: vi.fn() }))

vi.mock('@/services/stock/stock-overview-service', () => ({
  loadStockOverview: mocks.loadStockOverview,
}))

const membership: ScopeMembership = {
  membershipId: 'membership-id',
  roleId: 'role-id',
  tenantId: 'tenant-id',
  organizationId: 'org-id',
  unitId: 'unit-id',
}

test('renders scoped stock from persistent ledger data', async () => {
  mocks.loadStockOverview.mockResolvedValue({
    totalKg: 1200,
    receivedTodayKg: 500,
    dispatchedTodayKg: 100,
    items: [
      {
        materialId: 'mat-1',
        material: 'PET',
        category: 'Plástico',
        balanceKg: 1200,
        lastMovementAt: '2026-09-21T10:00:00Z',
      },
    ],
  })

  render(
    <ScopeProvider loadMemberships={async () => [membership]}>
      <RouterProvider initialPath="/estoque">
        <StockPage />
      </RouterProvider>
    </ScopeProvider>,
  )

  expect(await screen.findByText('PET')).toBeInTheDocument()
  expect(screen.getByText('1.200 kg')).toBeInTheDocument()
  expect(screen.getByText('500 kg')).toBeInTheDocument()
})
