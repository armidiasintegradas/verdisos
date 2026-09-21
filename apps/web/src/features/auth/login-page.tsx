import { useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase/client'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [resetMessage, setResetMessage] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setErrorMessage(null)
    setResetMessage(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

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
    setResetMessage(null)

    const redirectTo = new URL(import.meta.env.BASE_URL, window.location.href).toString()
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })

    if (error) {
      setErrorMessage(error.message)
      setResetting(false)
      return
    }

    setResetMessage('Se existir uma conta para este e-mail, enviaremos as instruções de recuperação.')
    setResetting(false)
  }

  return (
    <main>
      <h1>Verdis</h1>
      <p>Acesse a plataforma de gestão da circularidade.</p>
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
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button type="submit" disabled={submitting || resetting}>
          {submitting ? 'Entrando…' : 'Entrar'}
        </button>
        <button type="button" disabled={submitting || resetting} onClick={() => void handlePasswordReset()}>
          {resetting ? 'Enviando…' : 'Esqueci minha senha'}
        </button>
        {errorMessage ? <p role="alert">{errorMessage}</p> : null}
        {resetMessage ? <p role="status">{resetMessage}</p> : null}
      </form>
    </main>
  )
}
