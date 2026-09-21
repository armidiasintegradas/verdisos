import { supabase } from '@/lib/supabase/client'
import type { ActiveScope } from '@/domain/scope'

export type OperationalIdentity = {
  displayName: string
  roleName: string
  organizationName: string
  unitName: string | null
}

export async function loadOperationalIdentity(
  userId: string,
  roleId: string,
  scope: ActiveScope,
): Promise<OperationalIdentity> {
  const [profileResult, organizationResult, roleResult, unitResult] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('display_name')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('organizations')
      .select('display_name')
      .eq('id', scope.organizationId)
      .single(),
    supabase
      .from('roles')
      .select('name')
      .eq('id', roleId)
      .single(),
    scope.unitId
      ? supabase.from('units').select('name').eq('id', scope.unitId).single()
      : Promise.resolve({ data: null, error: null }),
  ])

  if (organizationResult.error) throw organizationResult.error
  if (roleResult.error) throw roleResult.error
  if (unitResult.error) throw unitResult.error

  return {
    displayName: profileResult.data?.display_name?.trim() || 'Usuário',
    roleName: roleResult.data.name,
    organizationName: organizationResult.data.display_name,
    unitName: unitResult.data?.name ?? null,
  }
}
