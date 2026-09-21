import { useEffect, useState, type FormEvent } from 'react'
import { useScope } from '@/features/scope/scope-provider'
import {
  inviteCooperativeUser,
  loadCooperativeTeam,
  setCooperativeMembershipStatus,
  type CooperativeTeamMember,
  type CooperativeTeamRole,
} from '@/services/team/cooperative-team-service'
import { Breadcrumb } from '@/ui/components/breadcrumb'
import { PageHeader } from '@/ui/components/page-header'

const ROLE_OPTIONS: Array<{ value: CooperativeTeamRole; label: string }> = [
  { value: 'operator', label: 'Operador' },
  { value: 'finance', label: 'Financeiro' },
  { value: 'auditor', label: 'Auditor' },
  { value: 'cooperative_manager', label: 'Gestor da cooperativa' },
]

export function TeamPage() {
  const { activeScope } = useScope()
  const [members, setMembers] = useState<CooperativeTeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [email, setEmail] = useState('')
  const [roleCode, setRoleCode] = useState<CooperativeTeamRole>('operator')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  async function reload() {
    if (!activeScope) return
    setLoading(true)
    setErrorMessage(null)

    try {
      setMembers(await loadCooperativeTeam(activeScope))
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar a equipe.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
  }, [activeScope?.tenantId, activeScope?.organizationId, activeScope?.unitId])

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activeScope || submitting) return

    setSubmitting(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      await inviteCooperativeUser(activeScope, { email, roleCode })
      setEmail('')
      setSuccessMessage('Convite enviado e acesso preparado para o novo usuário.')
      await reload()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível enviar o convite.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function handleStatus(
    membershipId: string,
    status: 'active' | 'suspended',
  ) {
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      await setCooperativeMembershipStatus(membershipId, status)
      await reload()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar o acesso.',
      )
    }
  }

  return (
    <div className="v-page-grid">
      <div>
        <Breadcrumb items={[{ label: 'Início', href: '/' }, { label: 'Equipe' }]} />
        <PageHeader
          title="Equipe"
          description="Convide usuários e controle o acesso ao ambiente operacional da cooperativa."
        />
      </div>

      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
      {successMessage ? <p role="status">{successMessage}</p> : null}

      <section>
        <h2>Convidar usuário</h2>
        <form onSubmit={handleInvite}>
          <label>
            E-mail
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label>
            Função
            <select
              value={roleCode}
              onChange={(event) =>
                setRoleCode(event.target.value as CooperativeTeamRole)
              }
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </label>

          <button type="submit" disabled={submitting}>
            {submitting ? 'Enviando…' : 'Enviar convite'}
          </button>
        </form>
      </section>

      <section>
        <h2>Usuários</h2>
        {loading ? <p>Carregando equipe…</p> : null}

        {!loading && members.length === 0 ? (
          <p>Nenhum usuário encontrado neste escopo.</p>
        ) : null}

        <ul>
          {members.map((member) => (
            <li key={member.membershipId}>
              <div>
                <strong>{member.displayName}</strong>
                <span> · {member.email} · {member.roleName} · {member.status}</span>
              </div>

              {member.status === 'active' ? (
                <button
                  type="button"
                  onClick={() =>
                    void handleStatus(member.membershipId, 'suspended')
                  }
                >
                  Suspender acesso
                </button>
              ) : member.status === 'suspended' ? (
                <button
                  type="button"
                  onClick={() =>
                    void handleStatus(member.membershipId, 'active')
                  }
                >
                  Reativar acesso
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
