import { supabase } from '@/lib/supabase/client'

export type CooperativeOnboardingInput = {
  tenantSlug: string
  tenantName: string
  organizationLegalName: string
  organizationDisplayName: string
  taxId?: string
  unitName: string
  unitCode: string
  displayName?: string
}

export type CooperativeOnboardingResult = {
  tenantId: string
  organizationId: string
  unitId: string
  membershipId: string
  roleId: string
}

export async function bootstrapCooperativeAccount(
  input: CooperativeOnboardingInput,
): Promise<CooperativeOnboardingResult> {
  const { data, error } = await supabase.rpc('bootstrap_cooperative_account', {
    p_tenant_slug: input.tenantSlug,
    p_tenant_name: input.tenantName,
    p_organization_legal_name: input.organizationLegalName,
    p_organization_display_name: input.organizationDisplayName,
    p_tax_id: input.taxId?.trim() || undefined,
    p_unit_name: input.unitName,
    p_unit_code: input.unitCode,
    p_display_name: input.displayName?.trim() || undefined,
  })

  if (error) throw error

  const row = data?.[0]
  if (!row) {
    throw new Error('O cadastro foi concluído sem retornar o novo escopo.')
  }

  return {
    tenantId: row.tenant_id,
    organizationId: row.organization_id,
    unitId: row.unit_id,
    membershipId: row.membership_id,
    roleId: row.role_id,
  }
}

export function onboardingErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)

  if (message.includes('tenant slug is unavailable')) {
    return 'Este identificador de cooperativa já está em uso. Ajuste o nome e tente novamente.'
  }
  if (message.includes('tax id is already registered')) {
    return 'Este CNPJ/CPF já está vinculado a uma organização na Verdis.'
  }
  if (message.includes('account already has an active scope')) {
    return 'Sua conta já está vinculada a uma organização. Atualize a página para continuar.'
  }
  if (message.includes('invalid tenant slug')) {
    return 'Não foi possível gerar um identificador válido para a cooperativa.'
  }

  return 'Não foi possível criar a cooperativa. Revise os dados e tente novamente.'
}
