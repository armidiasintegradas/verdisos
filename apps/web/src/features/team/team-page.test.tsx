import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { TeamPage } from './team-page'

const mocks = vi.hoisted(() => ({
  loadCooperativeTeam: vi.fn(),
  inviteCooperativeUser: vi.fn(),
  setCooperativeMembershipStatus: vi.fn(),
}))

vi.mock('@/features/scope/scope-provider', () => ({
  useScope: () => ({
    activeScope: {
      tenantId: 'tenant-1',
      organizationId: 'org-1',
      unitId: 'unit-1',
    },
  }),
}))

vi.mock('@/services/team/cooperative-team-service', () => ({
  loadCooperativeTeam: mocks.loadCooperativeTeam,
  inviteCooperativeUser: mocks.inviteCooperativeUser,
  setCooperativeMembershipStatus: mocks.setCooperativeMembershipStatus,
}))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.loadCooperativeTeam.mockResolvedValue([
    {
      membershipId: 'membership-1',
      userId: 'user-1',
      email: 'gestora@coop.org',
      displayName: 'Maria Gestora',
      roleCode: 'cooperative_manager',
      roleName: 'Cooperative manager',
      status: 'active',
      unitId: 'unit-1',
    },
    {
      membershipId: 'membership-2',
      userId: 'user-2',
      email: 'operador@coop.org',
      displayName: 'Operador',
      roleCode: 'operator',
      roleName: 'Operator',
      status: 'suspended',
      unitId: 'unit-1',
    },
  ])
  mocks.inviteCooperativeUser.mockResolvedValue(undefined)
  mocks.setCooperativeMembershipStatus.mockResolvedValue(undefined)
})

test('loads team and sends a scoped invite', async () => {
  render(<TeamPage />)

  expect(await screen.findByText('Maria Gestora')).toBeInTheDocument()

  fireEvent.change(screen.getByLabelText('E-mail'), {
    target: { value: 'novo@coop.org' },
  })
  fireEvent.change(screen.getByLabelText('Função'), {
    target: { value: 'finance' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Enviar convite' }))

  await waitFor(() => {
    expect(mocks.inviteCooperativeUser).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        organizationId: 'org-1',
        unitId: 'unit-1',
      }),
      { email: 'novo@coop.org', roleCode: 'finance' },
    )
  })

  expect(
    await screen.findByText('Convite enviado e acesso preparado para o novo usuário.'),
  ).toBeInTheDocument()
})

test('suspends and reactivates memberships through controlled service', async () => {
  render(<TeamPage />)

  expect(await screen.findByText('Maria Gestora')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Suspender acesso' }))
  await waitFor(() => {
    expect(mocks.setCooperativeMembershipStatus).toHaveBeenCalledWith(
      'membership-1',
      'suspended',
    )
  })

  fireEvent.click(screen.getByRole('button', { name: 'Reativar acesso' }))
  await waitFor(() => {
    expect(mocks.setCooperativeMembershipStatus).toHaveBeenCalledWith(
      'membership-2',
      'active',
    )
  })
})
