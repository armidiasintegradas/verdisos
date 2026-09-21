import { render, screen, waitFor } from '@testing-library/react'
import { RouterProvider } from '@/app/router'
import { AppShell } from './app-shell'

vi.mock('@/features/auth/auth-provider', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'maria@cooperativa.org', user_metadata: {} },
    signOut: vi.fn(),
  }),
}))

vi.mock('@/features/scope/scope-provider', () => ({
  useScope: () => ({
    activeScope: { tenantId: 'tenant-1', organizationId: 'org-1', unitId: 'unit-1' },
    memberships: [
      {
        membershipId: 'membership-1',
        roleId: 'role-1',
        tenantId: 'tenant-1',
        organizationId: 'org-1',
        unitId: 'unit-1',
      },
    ],
  }),
}))

vi.mock('@/features/scope/scope-selector', () => ({
  ScopeSelector: () => <span>Escopo ativo</span>,
}))

vi.mock('./load-operational-identity', () => ({
  loadOperationalIdentity: vi.fn().mockResolvedValue({
    displayName: 'Maria Silva',
    roleName: 'Gestora',
    organizationName: 'Cooperativa Recife',
    unitName: 'Galpão 01',
    permissionCodes: [
      'movement.read',
      'stock.read',
      'sale.create',
      'evidence.read',
      'evidence.validate',
      'audit.read',
      'scope.manage',
    ],
  }),
}))

test('renders the canonical navigation with real operational identity', async () => {
  render(
    <RouterProvider initialPath="/documentos">
      <AppShell><h1>Documentos</h1></AppShell>
    </RouterProvider>,
  )

  expect(screen.getAllByText('verdis.').length).toBeGreaterThan(0)
  expect(await screen.findByRole('link', { name: 'Documentos' })).toHaveAttribute('aria-current', 'page')

  await waitFor(() => {
    expect(screen.getByText('Maria Silva — Gestora')).toBeInTheDocument()
  })

  expect(screen.getByText('Cooperativa Recife · Galpão 01')).toBeInTheDocument()
  expect(screen.getAllByLabelText('Usuário').length).toBeGreaterThan(0)
  expect(screen.queryByText('Cooperativa Demo · M1 Pilot')).not.toBeInTheDocument()
})
