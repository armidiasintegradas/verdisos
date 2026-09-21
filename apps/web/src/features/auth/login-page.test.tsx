import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { LoginPage } from './login-page'

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}))

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      signInWithPassword: mocks.signInWithPassword,
      resetPasswordForEmail: mocks.resetPasswordForEmail,
    },
  },
}))

test('requests password recovery without exposing account existence', async () => {
  mocks.resetPasswordForEmail.mockResolvedValue({ error: null })

  render(<LoginPage />)

  fireEvent.change(screen.getByLabelText('E-mail'), {
    target: { value: 'gestora@cooperativa.org' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Esqueci minha senha' }))

  await waitFor(() => {
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith(
      'gestora@cooperativa.org',
      expect.objectContaining({ redirectTo: expect.any(String) }),
    )
  })

  expect(
    screen.getByText('Se existir uma conta para este e-mail, enviaremos as instruções de recuperação.'),
  ).toBeInTheDocument()
})
