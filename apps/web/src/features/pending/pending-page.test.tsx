import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { RouterProvider } from '@/app/router'
import { ScopeProvider, type ScopeMembership } from '@/features/scope/scope-provider'
import { PendingPage } from './pending-page'

const mocks = vi.hoisted(() => ({ loadPendingOverview: vi.fn() }))

vi.mock('@/services/pending/pending-overview-service', () => ({
  loadPendingOverview: mocks.loadPendingOverview,
}))

const membership: ScopeMembership = {
  membershipId: 'membership-id',
  roleId: 'role-id',
  tenantId: 'tenant-id',
  organizationId: 'org-id',
  unitId: 'unit-id',
}

test('shows only live items requiring human action', async () => {
  mocks.loadPendingOverview.mockResolvedValue({
    openCount: 2,
    missingDocumentCount: 1,
    exceptionCount: 1,
    resolvedTodayCount: 0,
    items: [
      {
        id: 'sale-1',
        type: 'missing_document',
        title: 'Venda #abc12345',
        material: 'PET',
        message: 'Esta venda ainda não possui documento vinculado.',
        href: '/vendas/nova/movement-1?step=comprovacao',
      },
      {
        id: 'exception-1',
        type: 'audit_exception',
        title: 'Exceção #def67890',
        material: 'movement',
        message: 'Exceção operacional aberta e aguardando ação humana.',
        href: '/auditoria',
      },
    ],
  })

  render(
    <ScopeProvider loadMemberships={async () => [membership]}>
      <RouterProvider initialPath="/pendencias">
        <PendingPage />
      </RouterProvider>
    </ScopeProvider>,
  )

  expect(await screen.findByText('Venda #abc12345')).toBeInTheDocument()
  expect(screen.getByText('Exceção #def67890')).toBeInTheDocument()
  expect(screen.queryByText('Comprovante_Venda_Demo.pdf')).not.toBeInTheDocument()
})
