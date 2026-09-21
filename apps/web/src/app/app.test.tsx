import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { ScopeProvider, type ScopeMembership } from '@/features/scope/scope-provider'
import { RouterProvider } from './router'
import { AppRoutes } from './routes'

vi.mock('@/features/auth/auth-provider', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'maria@cooperativa.org', user_metadata: {} },
    signOut: vi.fn(),
  }),
}))

vi.mock('@/features/scope/scope-selector', () => ({
  ScopeSelector: () => <span>Escopo ativo</span>,
}))

vi.mock('@/ui/layout/load-operational-identity', () => ({
  loadOperationalIdentity: vi.fn().mockResolvedValue({
    displayName: 'Maria Silva',
    roleName: 'Gestora',
    organizationName: 'Cooperativa Recife',
    unitName: 'Galpão 01',
    permissionCodes: ['evidence.read'],
  }),
}))

const mocks = vi.hoisted(() => ({ loadDocuments: vi.fn() }))

vi.mock('@/services/documents/documents-query-service', () => ({
  loadDocuments: mocks.loadDocuments,
}))

const membership: ScopeMembership = {
  membershipId: 'membership-id',
  roleId: 'role-id',
  tenantId: 'tenant-id',
  organizationId: 'org-id',
  unitId: 'unit-id',
}

const documents = Array.from({ length: 4 }, (_, index) => ({
  documentId: `document-${index}`,
  movementId: `movement-${index}`,
  origin: 'receipt' as const,
  filename: `Documento_${index}.pdf`,
  mimeType: 'application/pdf',
  occurredAt: '2026-09-16T12:00:00Z',
  materialId: 'paper',
  materialLabel: 'Papelão',
  extractionState: 'processed' as const,
  reviewState: 'none' as const,
  movementLabel: 'Recebimento',
}))

test('renders documents inside the canonical shell', async () => {
  mocks.loadDocuments.mockResolvedValue(documents)

  render(
    <ScopeProvider loadMemberships={async () => [membership]}>
      <RouterProvider initialPath="/documentos">
        <AppRoutes />
      </RouterProvider>
    </ScopeProvider>,
  )

  expect(await screen.findByRole('heading', { name: 'Documentos' })).toBeInTheDocument()
  expect(await screen.findByRole('link', { name: 'Documentos' })).toHaveAttribute('aria-current', 'page')
  expect((await screen.findAllByText('4 documentos')).length).toBeGreaterThan(0)
})
