import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { LoginPage } from './login-page'

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}))

vi.mock('@/lib/env', () => ({
  allowSelfSignup: true,
}))

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      signInWithPassword: mocks.signInWithPassword,
      signUp: mocks.signUp,
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


test('creates the first manager account only when self-signup is enabled', async () => {
  mocks.signUp.mockResolvedValue({ error: null })

  render(<LoginPage />)

  fireEvent.click(screen.getByRole('button', { name: 'Criar uma conta' }))

  fireEvent.change(screen.getByLabelText('E-mail'), {
    target: { value: 'primeira.gestora@cooperativa.org' },
  })
  fireEvent.change(screen.getByLabelText('Senha'), {
    target: { value: 'senha-segura-123' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))

  await waitFor(() => {
    expect(mocks.signUp).toHaveBeenCalledWith({
      email: 'primeira.gestora@cooperativa.org',
      password: 'senha-segura-123',
      options: { emailRedirectTo: expect.any(String) },
    })
  })

  expect(
    screen.getByText('Cadastro recebido. Confira seu e-mail para confirmar a conta e continuar.'),
  ).toBeInTheDocument()
})
