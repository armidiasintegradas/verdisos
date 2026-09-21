import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { RouterProvider } from '@/app/router'
import { AppShell } from './app-shell'

vi.mock('@/features/auth/auth-provider', () => ({
  useAuth: () => ({
    user: { id: 'user-operator', email: 'operador@cooperativa.org', user_metadata: {} },
    signOut: vi.fn(),
  }),
}))

vi.mock('@/features/scope/scope-provider', () => ({
  useScope: () => ({
    activeScope: {
      tenantId: 'tenant-1',
      organizationId: 'org-1',
      unitId: 'unit-1',
    },
    memberships: [
      {
        membershipId: 'membership-operator',
        roleId: 'role-operator',
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
    displayName: 'Operador',
    roleName: 'Operador',
    organizationName: 'Cooperativa Recife',
    unitName: 'Galpão 01',
    permissionCodes: ['movement.create', 'movement.read', 'evidence.read', 'stock.read'],
  }),
}))

test('blocks a direct route when the active role lacks the required permission', async () => {
  render(
    <RouterProvider initialPath="/equipe">
      <AppShell requiredPermission="scope.manage">
        <h1>Equipe privada</h1>
      </AppShell>
    </RouterProvider>,
  )

  expect(
    await screen.findByRole('heading', { name: 'Acesso não autorizado' }),
  ).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Equipe privada' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Equipe' })).not.toBeInTheDocument()
})
