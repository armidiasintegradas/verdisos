import { supabase } from '@/lib/supabase/client'
import type { ActiveScope } from '@/domain/scope'

export type OperationalIdentity = {
  displayName: string
  roleName: string
  organizationName: string
  unitName: string | null
  permissionCodes: string[]
}

export async function loadOperationalIdentity(
  userId: string,
  roleId: string,
  scope: ActiveScope,
): Promise<OperationalIdentity> {
  const [
    profileResult,
    organizationResult,
    roleResult,
    unitResult,
    permissionsResult,
  ] = await Promise.all([
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
    supabase
      .from('role_permissions')
      .select('permission_code')
      .eq('role_id', roleId)
      .order('permission_code'),
  ])

  if (organizationResult.error) throw organizationResult.error
  if (roleResult.error) throw roleResult.error
  if (unitResult.error) throw unitResult.error
  if (permissionsResult.error) throw permissionsResult.error

  return {
    displayName: profileResult.data?.display_name?.trim() || 'Usuário',
    roleName: roleResult.data.name,
    organizationName: organizationResult.data.display_name,
    unitName: unitResult.data?.name ?? null,
    permissionCodes: (permissionsResult.data ?? []).map(
      (permission) => permission.permission_code,
    ),
  }
}
