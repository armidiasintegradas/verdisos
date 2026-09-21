import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { RouterProvider } from '@/app/router'
import { ScopeProvider, type ScopeMembership } from '@/features/scope/scope-provider'
import { SalesPage } from './sales-page'

const mocks = vi.hoisted(() => ({ loadSalesOverview: vi.fn() }))

vi.mock('@/services/sales/sales-overview-service', () => ({
  loadSalesOverview: mocks.loadSalesOverview,
}))

const membership: ScopeMembership = {
  membershipId: 'membership-id',
  roleId: 'role-id',
  tenantId: 'tenant-id',
  organizationId: 'org-id',
  unitId: 'unit-id',
}

test('renders scoped sales from persistent records', async () => {
  mocks.loadSalesOverview.mockResolvedValue({
    salesCountToday: 1,
    soldTodayKg: 1000,
    soldTodayAmount: 3200,
    missingDocumentCount: 0,
    items: [
      {
        saleId: 'sale-1',
        movementId: 'abc12345-0000-0000-0000-000000000000',
        material: 'PET',
        quantityKg: 1000,
        buyer: 'Comprador Recife',
        unitPrice: 3.2,
        totalAmount: 3200,
        soldAt: '2026-09-21T10:00:00Z',
        documentState: 'processed',
      },
    ],
  })

  render(
    <ScopeProvider loadMemberships={async () => [membership]}>
      <RouterProvider initialPath="/vendas">
        <SalesPage />
      </RouterProvider>
    </ScopeProvider>,
  )

  expect(await screen.findByText('Venda #abc12345')).toBeInTheDocument()
  expect(screen.getByText('Comprador Recife')).toBeInTheDocument()
  expect(screen.getByText('Documento processado')).toBeInTheDocument()
})
