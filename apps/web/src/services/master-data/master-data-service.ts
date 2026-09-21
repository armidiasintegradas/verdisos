import type { ActiveScope } from '@/domain/scope'
import { supabase } from '@/lib/supabase/client'

export type MasterMaterial = {
  id: string
  code: string
  name: string
  category: string
}

export type MasterCounterparty = {
  id: string
  name: string
  taxId: string | null
}

export async function loadMasterData(scope: ActiveScope): Promise<{
  materials: MasterMaterial[]
  counterparties: MasterCounterparty[]
}> {
  const [materialsResult, counterpartiesResult] = await Promise.all([
    supabase
      .from('materials')
      .select('id, code, name, category')
      .eq('tenant_id', scope.tenantId)
      .eq('active', true)
      .order('name'),
    supabase
      .from('counterparties')
      .select('id, external_name, external_tax_id')
      .eq('tenant_id', scope.tenantId)
      .eq('organization_id', scope.organizationId)
      .order('external_name'),
  ])

  if (materialsResult.error) throw materialsResult.error
  if (counterpartiesResult.error) throw counterpartiesResult.error

  return {
    materials: (materialsResult.data ?? []).map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      category: row.category,
    })),
    counterparties: (counterpartiesResult.data ?? []).flatMap((row) =>
      row.external_name
        ? [{ id: row.id, name: row.external_name, taxId: row.external_tax_id }]
        : [],
    ),
  }
}

export async function createMaterial(
  scope: ActiveScope,
  input: { code: string; name: string; category: string },
): Promise<string> {
  const { data, error } = await supabase.rpc('create_material_m1', {
    p_organization_id: scope.organizationId,
    p_code: input.code,
    p_name: input.name,
    p_category: input.category,
  })
  if (error) throw error
  return data
}

export async function createCounterparty(
  scope: ActiveScope,
  input: { name: string; taxId?: string },
): Promise<string> {
  const { data, error } = await supabase.rpc('create_counterparty_m1', {
    p_organization_id: scope.organizationId,
    p_external_name: input.name,
    p_external_tax_id: input.taxId?.trim() || undefined,
  })
  if (error) throw error
  return data
}
