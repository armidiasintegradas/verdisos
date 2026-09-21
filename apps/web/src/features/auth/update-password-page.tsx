import { useState, type FormEvent } from 'react'
import { useAuth } from './auth-provider'

export function UpdatePasswordPage() {
  const { completePasswordRecovery } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)

    if (password.length < 8) {
      setErrorMessage('Use uma senha com pelo menos 8 caracteres.')
      return
    }

    if (password !== confirmation) {
      setErrorMessage('As senhas informadas não coincidem.')
      return
    }

    setSubmitting(true)

    try {
      await completePasswordRecovery(password)
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : 'Não foi possível atualizar a senha.')
      setSubmitting(false)
    }
  }

  return (
    <main>
      <h1>Definir nova senha</h1>
      <p>Crie uma nova senha para continuar acessando a Verdis.</p>
      <form onSubmit={handleSubmit}>
        <label>
          Nova senha
          <input
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <label>
          Confirmar nova senha
          <input
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </label>
        <button type="submit" disabled={submitting}>
          {submitting ? 'Atualizando…' : 'Atualizar senha'}
        </button>
        {errorMessage ? <p role="alert">{errorMessage}</p> : null}
      </form>
    </main>
  )
}
