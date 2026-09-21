import type { ActiveScope } from '@/domain/scope'
import { supabase } from '@/lib/supabase/client'

export type CooperativeTeamRole =
  | 'cooperative_manager'
  | 'operator'
  | 'finance'
  | 'auditor'

export type CooperativeTeamMember = {
  membershipId: string
  userId: string
  email: string
  displayName: string
  roleCode: CooperativeTeamRole
  roleName: string
  status: 'active' | 'invited' | 'suspended' | 'ended'
  unitId: string | null
}

export async function loadCooperativeTeam(
  scope: ActiveScope,
): Promise<CooperativeTeamMember[]> {
  const { data, error } = await supabase.rpc('list_cooperative_team_m1', {
    p_organization_id: scope.organizationId,
    p_unit_id: scope.unitId ?? undefined,
  })

  if (error) throw error

  return (data ?? []).map((row) => ({
    membershipId: row.membership_id,
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name,
    roleCode: row.role_code as CooperativeTeamRole,
    roleName: row.role_name,
    status: row.status,
    unitId: row.unit_id,
  }))
}

export async function inviteCooperativeUser(
  scope: ActiveScope,
  input: { email: string; roleCode: CooperativeTeamRole },
): Promise<void> {
  const { error } = await supabase.functions.invoke('invite-cooperative-user', {
    body: {
      email: input.email.trim().toLowerCase(),
      organizationId: scope.organizationId,
      unitId: scope.unitId,
      roleCode: input.roleCode,
    },
  })

  if (error) throw error
}

export async function setCooperativeMembershipStatus(
  membershipId: string,
  status: 'active' | 'suspended' | 'ended',
): Promise<void> {
  const { error } = await supabase.rpc('set_cooperative_membership_status_m1', {
    p_membership_id: membershipId,
    p_status: status,
  })

  if (error) throw error
}
