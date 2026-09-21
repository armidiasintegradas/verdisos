import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { CooperativeOnboardingPage } from './cooperative-onboarding-page'

const mocks = vi.hoisted(() => ({
  bootstrap: vi.fn(),
}))

vi.mock('@/features/auth/auth-provider', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      email: 'gestora@cooperativa.org',
      user_metadata: { full_name: 'Maria Gestora' },
    },
  }),
}))

vi.mock('@/services/onboarding/bootstrap-cooperative-account', () => ({
  bootstrapCooperativeAccount: mocks.bootstrap,
  onboardingErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : 'Falha',
}))

test('creates a cooperative and reloads the authenticated scope', async () => {
  mocks.bootstrap.mockResolvedValue({
    tenantId: 'tenant-1',
    organizationId: 'org-1',
    unitId: 'unit-1',
    membershipId: 'membership-1',
    roleId: 'role-1',
  })
  const onComplete = vi.fn().mockResolvedValue(undefined)

  render(<CooperativeOnboardingPage onComplete={onComplete} />)

  fireEvent.change(screen.getByLabelText('Nome da cooperativa'), {
    target: { value: 'Cooperativa Recife Verde' },
  })
  fireEvent.change(screen.getByLabelText('Razão social'), {
    target: { value: 'Cooperativa Recife Verde de Reciclagem' },
  })
  fireEvent.change(screen.getByLabelText('CNPJ ou CPF'), {
    target: { value: '12.345.678/0001-90' },
  })

  fireEvent.click(screen.getByRole('button', { name: 'Criar cooperativa' }))

  await waitFor(() => {
    expect(mocks.bootstrap).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantSlug: 'cooperativa-recife-verde',
        tenantName: 'Cooperativa Recife Verde',
        organizationDisplayName: 'Cooperativa Recife Verde',
        organizationLegalName: 'Cooperativa Recife Verde de Reciclagem',
        unitName: 'Unidade Principal',
        unitCode: 'UNIDADE-01',
        displayName: 'Maria Gestora',
      }),
    )
  })

  expect(onComplete).toHaveBeenCalledTimes(1)
})

test('prevents duplicate submission while bootstrap is running', async () => {
  let release!: () => void
  mocks.bootstrap.mockImplementation(
    () =>
      new Promise((resolve) => {
        release = () => resolve({
          tenantId: 'tenant-1',
          organizationId: 'org-1',
          unitId: 'unit-1',
          membershipId: 'membership-1',
          roleId: 'role-1',
        })
      }),
  )
  const onComplete = vi.fn().mockResolvedValue(undefined)

  render(<CooperativeOnboardingPage onComplete={onComplete} />)

  fireEvent.change(screen.getByLabelText('Nome da cooperativa'), {
    target: { value: 'Cooperativa Recife' },
  })
  fireEvent.change(screen.getByLabelText('Razão social'), {
    target: { value: 'Cooperativa Recife LTDA' },
  })

  fireEvent.click(screen.getByRole('button', { name: 'Criar cooperativa' }))

  expect(screen.getByRole('button', { name: 'Criando ambiente…' })).toBeDisabled()

  release()

  await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
})
