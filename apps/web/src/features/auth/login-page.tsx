import { useState, type FormEvent } from 'react'
import { allowSelfSignup } from '@/lib/env'
import { supabase } from '@/lib/supabase/client'

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  function authRedirectUrl() {
    return new URL(import.meta.env.BASE_URL, window.location.href).toString()
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setErrorMessage(null)
    setStatusMessage(null)

    if (mode === 'signup') {
      if (password.length < 8) {
        setErrorMessage('Use uma senha com pelo menos 8 caracteres.')
        setSubmitting(false)
        return
      }

      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: authRedirectUrl() },
      })

      if (error) {
        setErrorMessage(error.message)
        setSubmitting(false)
        return
      }

      setStatusMessage(
        'Cadastro recebido. Confira seu e-mail para confirmar a conta e continuar.',
      )
      setSubmitting(false)
      return
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      setErrorMessage(error.message)
      setSubmitting(false)
    }
  }

  async function handlePasswordReset() {
    if (!email.trim()) {
      setErrorMessage('Informe seu e-mail para recuperar a senha.')
      return
    }

    setResetting(true)
    setErrorMessage(null)
    setStatusMessage(null)

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: authRedirectUrl(),
    })

    if (error) {
      setErrorMessage(error.message)
      setResetting(false)
      return
    }

    setStatusMessage(
      'Se existir uma conta para este e-mail, enviaremos as instruções de recuperação.',
    )
    setResetting(false)
  }

  function toggleMode() {
    setMode((current) => (current === 'login' ? 'signup' : 'login'))
    setErrorMessage(null)
    setStatusMessage(null)
    setPassword('')
  }

  return (
    <main>
      <h1>Verdis</h1>
      <p>
        {mode === 'signup'
          ? 'Crie sua conta para configurar o primeiro ambiente da cooperativa.'
          : 'Acesse a plataforma de gestão da circularidade.'}
      </p>

      <form onSubmit={handleSubmit}>
        <label>
          E-mail
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label>
          Senha
          <input
            name="password"
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            minLength={mode === 'signup' ? 8 : undefined}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        <button type="submit" disabled={submitting || resetting}>
          {submitting
            ? mode === 'signup'
              ? 'Criando conta…'
              : 'Entrando…'
            : mode === 'signup'
              ? 'Criar conta'
              : 'Entrar'}
        </button>

        {mode === 'login' ? (
          <button
            type="button"
            disabled={submitting || resetting}
            onClick={() => void handlePasswordReset()}
          >
            {resetting ? 'Enviando…' : 'Esqueci minha senha'}
          </button>
        ) : null}

        {allowSelfSignup ? (
          <button
            type="button"
            disabled={submitting || resetting}
            onClick={toggleMode}
          >
            {mode === 'login' ? 'Criar uma conta' : 'Já tenho uma conta'}
          </button>
        ) : null}

        {errorMessage ? <p role="alert">{errorMessage}</p> : null}
        {statusMessage ? <p role="status">{statusMessage}</p> : null}
      </form>
    </main>
  )
}
