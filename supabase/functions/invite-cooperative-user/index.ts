import { createClient } from 'npm:@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const appUrl = Deno.env.get('VERDIS_APP_URL')
  const authorization = request.headers.get('Authorization')

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !appUrl) {
    return json({ error: 'server_not_configured' }, 500)
  }

  if (!authorization?.startsWith('Bearer ')) {
    return json({ error: 'authentication_required' }, 401)
  }

  let payload: {
    email?: string
    organizationId?: string
    unitId?: string | null
    roleCode?: string
  }

  try {
    payload = await request.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const email = payload.email?.trim().toLowerCase()
  const organizationId = payload.organizationId?.trim()
  const unitId = payload.unitId?.trim() || null
  const roleCode = payload.roleCode?.trim().toLowerCase()

  if (!email || !organizationId || !roleCode) {
    return json({ error: 'email_organization_and_role_are_required' }, 400)
  }

  if (!['cooperative_manager', 'operator', 'finance', 'auditor'].includes(roleCode)) {
    return json({ error: 'role_not_allowed' }, 400)
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const {
    data: { user: caller },
    error: callerError,
  } = await callerClient.auth.getUser()

  if (callerError || !caller) {
    return json({ error: 'invalid_session' }, 401)
  }

  const { data: preflightAllowed, error: preflightError } = await callerClient.rpc(
    'authorize_cooperative_invitation_m1',
    {
      p_organization_id: organizationId,
      p_unit_id: unitId,
      p_role_code: roleCode,
    },
  )

  if (preflightError || preflightAllowed !== true) {
    return json(
      {
        error: 'invitation_not_authorized',
        message: preflightError?.message ?? 'Invitation is not authorized.',
      },
      403,
    )
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const redirectTo = appUrl
  const { data: inviteData, error: inviteError } =
    await adminClient.auth.admin.inviteUserByEmail(email, { redirectTo })

  if (inviteError || !inviteData.user) {
    return json(
      {
        error: 'invite_failed',
        message: inviteError?.message ?? 'User was not created.',
      },
      400,
    )
  }

  const invitedUserId = inviteData.user.id

  const { data: membershipId, error: membershipError } = await callerClient.rpc(
    'assign_cooperative_membership_m1',
    {
      p_user_id: invitedUserId,
      p_organization_id: organizationId,
      p_unit_id: unitId,
      p_role_code: roleCode,
    },
  )

  if (membershipError || !membershipId) {
    // The invited account was created by this request but could not be authorized
    // into the requested cooperative scope. Remove the orphan before returning.
    await adminClient.auth.admin.deleteUser(invitedUserId)

    return json(
      {
        error: 'membership_assignment_failed',
        message: membershipError?.message ?? 'Membership was not created.',
      },
      403,
    )
  }

  return json({
    invited: true,
    userId: invitedUserId,
    membershipId,
  })
})
