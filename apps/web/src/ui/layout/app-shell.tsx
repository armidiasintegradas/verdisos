import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { RouterLink, useRouter } from '@/app/router'
import { useAuth } from '@/features/auth/auth-provider'
import { ScopeSelector } from '@/features/scope/scope-selector'
import { useScope } from '@/features/scope/scope-provider'
import { Avatar } from '@/ui/components/avatar'
import { Icon, type IconName } from '@/ui/components/icon'
import { loadOperationalIdentity, type OperationalIdentity } from './load-operational-identity'
import './app-shell.css'

const navItems = [
  ['Início', '/', 'home'],
  ['Recebimentos', '/recebimentos', 'receive'],
  ['Estoque', '/estoque', 'stock'],
  ['Vendas', '/vendas', 'sales'],
  ['Documentos', '/documentos', 'document'],
  ['Pendências', '/pendencias', 'pending'],
  ['Auditoria', '/auditoria', 'search'],
  ['Cadastros', '/cadastros', 'settings'],
  ['Equipe', '/equipe', 'user'],
] as const satisfies ReadonlyArray<readonly [string, string, IconName]>

type AppShellProps = {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const { pathname } = useRouter()
  const { user, signOut } = useAuth()
  const { activeScope, memberships } = useScope()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )
  const [identity, setIdentity] = useState<OperationalIdentity | null>(null)
  const [identityError, setIdentityError] = useState(false)

  const activeMembership = useMemo(
    () =>
      memberships.find(
        (membership) =>
          membership.tenantId === activeScope?.tenantId &&
          membership.organizationId === activeScope?.organizationId &&
          membership.unitId === activeScope?.unitId,
      ) ?? null,
    [memberships, activeScope],
  )

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    if (!user || !activeScope || !activeMembership) {
      setIdentity(null)
      setIdentityError(false)
      return
    }

    setIdentity(null)
    setIdentityError(false)

    void loadOperationalIdentity(user.id, activeMembership.roleId, activeScope)
      .then((nextIdentity) => {
        if (!cancelled) setIdentity(nextIdentity)
      })
      .catch(() => {
        if (!cancelled) setIdentityError(true)
      })

    return () => {
      cancelled = true
    }
  }, [user, activeScope, activeMembership])

  const displayName =
    identity?.displayName ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'Usuário'

  const roleName = identity?.roleName || 'Acesso operacional'
  const organizationName = identity?.organizationName || 'Organização'
  const unitName = identity?.unitName || 'Unidade'
  const environmentName = organizationName
  const operationLabel = isOnline
    ? `OPERAÇÃO ATIVA · ${unitName.toUpperCase()}`
    : 'SEM CONEXÃO · DADOS ONLINE INDISPONÍVEIS'

  return (
    <div className="v-shell">
      {sidebarOpen ? (
        <div
          className="v-shell__backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <aside className={`v-shell__sidebar${sidebarOpen ? ' is-open' : ''}`}>
        <div>
          <div className="v-shell__sidebar-header">
            <div className="v-shell__brand">verdis.</div>
            <button
              className="v-shell__sidebar-close"
              type="button"
              aria-label="Fechar menu"
              onClick={() => setSidebarOpen(false)}
            >
              <Icon name="close" size={20} />
            </button>
          </div>

          <div className="v-shell__environment">
            <span className="v-shell__environment-dot" aria-hidden="true" />
            <span>
              <small>AMBIENTE</small>
              {environmentName}
            </span>
          </div>

          <nav className="v-shell__nav" aria-label="Navegação principal">
            {navItems.map(([label, href, icon]) => {
              const active = pathname === href
              return (
                <RouterLink
                  key={href}
                  to={href}
                  className={`v-shell__nav-link${active ? ' is-active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setSidebarOpen(false)}
                >
                  <span className="v-shell__nav-icon">
                    <Icon name={icon} size={19} />
                  </span>
                  <span>{label}</span>
                </RouterLink>
              )
            })}
          </nav>
        </div>

        <div className="v-shell__sidebar-user">
          <Avatar size={32} />
          <span className="v-shell__sidebar-user-copy">
            <strong>{displayName}</strong>
            <small>{roleName}</small>
          </span>
          <button
            className="v-shell__settings"
            aria-label="Sair da sessão"
            type="button"
            onClick={() => void signOut()}
          >
            <Icon name="settings" size={18} />
          </button>
        </div>
      </aside>

      <div className="v-shell__main">
        <header className="v-shell__header">
          <button
            className="v-shell__menu-toggle"
            type="button"
            aria-label="Abrir menu"
            onClick={() => setSidebarOpen(true)}
          >
            <Icon name="menu" size={22} />
          </button>
          <div className="v-shell__mobile-brand">verdis.</div>

          <div className="v-shell__unit">
            <span className="v-shell__header-icon">
              <Icon name="building" size={18} />
            </span>
            <span>
              <small>UNIDADE OPERACIONAL</small>
              <strong>{organizationName} · {unitName}</strong>
            </span>
            <div className="v-shell__scope-control">
              <ScopeSelector />
            </div>
          </div>

          <div className={`v-shell__operation${!isOnline ? ' is-offline' : ''}`}>
            <span className="v-shell__operation-dot" aria-hidden="true" />
            <span>{operationLabel}</span>
          </div>

          <label className="v-shell__search">
            <Icon name="search" size={18} />
            <span className="v-visually-hidden">Buscar na Verdis</span>
            <input type="search" placeholder="Buscar na Verdis..." />
          </label>

          <button className="v-shell__icon-button" type="button" aria-label="Notificações">
            <Icon name="bell" size={19} />
            <span className="v-shell__notification-dot" aria-hidden="true" />
          </button>

          <div className="v-shell__identity">
            <Avatar />
            <span>
              <strong>{displayName} — {roleName}</strong>
              <small>
                <i aria-hidden="true" />
                {identityError ? 'Sessão conectada · dados de perfil indisponíveis' : 'Sessão conectada'}
              </small>
            </span>
          </div>
        </header>

        <main className="v-shell__content">{children}</main>
      </div>
    </div>
  )
}
