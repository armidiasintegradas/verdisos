import { render, screen, within } from '@testing-library/react'
import { vi } from 'vitest'
import { RouterProvider } from '@/app/router'
import { ScopeProvider, type ScopeMembership } from '@/features/scope/scope-provider'
import { ReceiptsPage } from './receipts-page'

const mocks = vi.hoisted(() => ({ loadReceiptsOverview: vi.fn() }))

vi.mock('@/services/receipts/receipts-overview-service', () => ({
  loadReceiptsOverview: mocks.loadReceiptsOverview,
}))

const membership: ScopeMembership = {
  membershipId: 'membership-id',
  roleId: 'role-id',
  tenantId: 'tenant-id',
  organizationId: 'org-id',
  unitId: 'unit-id',
}

test('renders persisted receipt data and document state', async () => {
  mocks.loadReceiptsOverview.mockResolvedValue({
    receivedTodayKg: 480,
    receiptCountToday: 1,
    missingDocumentCount: 0,
    processingDocumentCount: 0,
    items: [
      {
        movementId: '1284abcd-0000-0000-0000-000000000000',
        material: 'Papelão Ondulado',
        quantityKg: 480,
        counterparty: 'Fornecedor Recife',
        occurredAt: '2026-09-21T11:00:00Z',
        documentState: 'processed',
      },
    ],
  })

  render(
    <ScopeProvider loadMemberships={async () => [membership]}>
      <RouterProvider initialPath="/recebimentos">
        <ReceiptsPage />
      </RouterProvider>
    </ScopeProvider>,
  )

  const movementTitle = await screen.findByText('Recebimento #1284abcd')
  const movementRow = movementTitle.closest('article')

  expect(movementRow).not.toBeNull()
  expect(within(movementRow!).getByText('Documento processado')).toBeInTheDocument()
  expect(within(movementRow!).getByText('Fornecedor Recife')).toBeInTheDocument()
})
