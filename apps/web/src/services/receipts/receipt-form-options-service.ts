import type { ActiveScope } from '@/domain/scope'
import { supabase } from '@/lib/supabase/client'

export type ReceiptFormOption = { id: string; label: string }

export async function loadReceiptFormOptions(scope: ActiveScope): Promise<{
  origins: ReceiptFormOption[]
  materials: ReceiptFormOption[]
}> {
  const [originsResult, materialsResult] = await Promise.all([
    supabase
      .from('counterparties')
      .select('id, external_name')
      .eq('tenant_id', scope.tenantId)
      .eq('organization_id', scope.organizationId)
      .order('external_name'),
    supabase
      .from('materials')
      .select('id, name')
      .eq('tenant_id', scope.tenantId)
      .eq('active', true)
      .order('name'),
  ])

  if (originsResult.error) throw originsResult.error
  if (materialsResult.error) throw materialsResult.error

  return {
    origins: (originsResult.data ?? []).flatMap((row) =>
      row.external_name ? [{ id: row.id, label: row.external_name }] : [],
    ),
    materials: (materialsResult.data ?? []).map((row) => ({
      id: row.id,
      label: row.name,
    })),
  }
}
