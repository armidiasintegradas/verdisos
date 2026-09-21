import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, vi } from 'vitest'
import { UpdatePasswordPage } from './update-password-page'

const mocks = vi.hoisted(() => ({
  completePasswordRecovery: vi.fn(),
}))

vi.mock('./auth-provider', () => ({
  useAuth: () => ({
    completePasswordRecovery: mocks.completePasswordRecovery,
  }),
}))

beforeEach(() => {
  mocks.completePasswordRecovery.mockReset()
})

test('updates password only when confirmation matches', async () => {
  mocks.completePasswordRecovery.mockResolvedValue(undefined)

  render(<UpdatePasswordPage />)

  fireEvent.change(screen.getByLabelText('Nova senha'), {
    target: { value: 'nova-senha-segura' },
  })
  fireEvent.change(screen.getByLabelText('Confirmar nova senha'), {
    target: { value: 'nova-senha-segura' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar senha' }))

  await waitFor(() => {
    expect(mocks.completePasswordRecovery).toHaveBeenCalledWith('nova-senha-segura')
  })
})

test('blocks mismatched password confirmation', () => {
  render(<UpdatePasswordPage />)

  fireEvent.change(screen.getByLabelText('Nova senha'), {
    target: { value: 'nova-senha-segura' },
  })
  fireEvent.change(screen.getByLabelText('Confirmar nova senha'), {
    target: { value: 'senha-diferente' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar senha' }))

  expect(screen.getByRole('alert')).toHaveTextContent('As senhas informadas não coincidem.')
  expect(mocks.completePasswordRecovery).not.toHaveBeenCalled()
})
