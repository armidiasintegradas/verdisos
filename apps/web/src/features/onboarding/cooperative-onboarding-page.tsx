import { useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '@/features/auth/auth-provider'
import {
  bootstrapCooperativeAccount,
  onboardingErrorMessage,
} from '@/services/onboarding/bootstrap-cooperative-account'

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
}

type CooperativeOnboardingPageProps = {
  onComplete: () => Promise<void>
}

export function CooperativeOnboardingPage({
  onComplete,
}: CooperativeOnboardingPageProps) {
  const { user } = useAuth()
  const suggestedManagerName = useMemo(
    () =>
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      user?.email?.split('@')[0] ||
      '',
    [user],
  )

  const [displayName, setDisplayName] = useState(suggestedManagerName)
  const [organizationDisplayName, setOrganizationDisplayName] = useState('')
  const [organizationLegalName, setOrganizationLegalName] = useState('')
  const [taxId, setTaxId] = useState('')
  const [unitName, setUnitName] = useState('Unidade Principal')
  const [unitCode, setUnitCode] = useState('UNIDADE-01')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)

    const tenantSlug = slugify(organizationDisplayName)
    if (tenantSlug.length < 2) {
      setErrorMessage('Informe um nome válido para a cooperativa.')
      return
    }

    setSubmitting(true)

    try {
      await bootstrapCooperativeAccount({
        tenantSlug,
        tenantName: organizationDisplayName.trim(),
        organizationLegalName: organizationLegalName.trim(),
        organizationDisplayName: organizationDisplayName.trim(),
        taxId,
        unitName: unitName.trim(),
        unitCode: unitCode.trim(),
        displayName,
      })
      await onComplete()
    } catch (error) {
      setErrorMessage(onboardingErrorMessage(error))
      setSubmitting(false)
    }
  }

  return (
    <main>
      <h1>Configurar sua cooperativa</h1>
      <p>
        Crie o primeiro ambiente operacional da organização. Você será vinculado como
        gestor da cooperativa.
      </p>

      <form onSubmit={handleSubmit}>
        <label>
          Nome da cooperativa
          <input
            name="organizationDisplayName"
            required
            autoComplete="organization"
            value={organizationDisplayName}
            onChange={(event) => setOrganizationDisplayName(event.target.value)}
          />
        </label>

        <label>
          Razão social
          <input
            name="organizationLegalName"
            required
            value={organizationLegalName}
            onChange={(event) => setOrganizationLegalName(event.target.value)}
          />
        </label>

        <label>
          CNPJ ou CPF
          <input
            name="taxId"
            inputMode="numeric"
            value={taxId}
            onChange={(event) => setTaxId(event.target.value)}
          />
        </label>

        <label>
          Nome da unidade
          <input
            name="unitName"
            required
            value={unitName}
            onChange={(event) => setUnitName(event.target.value)}
          />
        </label>

        <label>
          Código da unidade
          <input
            name="unitCode"
            required
            value={unitCode}
            onChange={(event) => setUnitCode(event.target.value)}
          />
        </label>

        <label>
          Nome do gestor
          <input
            name="displayName"
            autoComplete="name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </label>

        <button type="submit" disabled={submitting}>
          {submitting ? 'Criando ambiente…' : 'Criar cooperativa'}
        </button>

        {errorMessage ? <p role="alert">{errorMessage}</p> : null}
      </form>
    </main>
  )
}
