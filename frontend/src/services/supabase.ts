import { getSupabaseClient } from '@/lib/supabase/client'
import type {
    Alert, ApiKey,
    InsertApiKey, InsertIntegration,
    InsertRepository, InsertScan,
    Integration,
    Repository, Scan, Secret,
    UpdateAlert, UpdateApiKey, UpdateIntegration,
    UpdateRepository, UpdateScan, UpdateSecret, UpdateUser,
    User
} from '@/lib/supabase/types'

// =====================================================
// AUTH SERVICE
// =====================================================

export const authService = {
  async signUp(email: string, password: string, fullName: string) {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    })
    if (error) throw error
    return data
  },

  async signIn(email: string, password: string) {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
    return data
  },

  async signInWithOAuth(provider: 'github' | 'gitlab' | 'google') {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) throw error
    return data
  },

  async signOut() {
    const supabase = getSupabaseClient()
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },

  async resetPassword(email: string) {
    const supabase = getSupabaseClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) throw error
  },

  async updatePassword(newPassword: string) {
    const supabase = getSupabaseClient()
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })
    if (error) throw error
  },

  async getSession() {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    return data.session
  },

  async getUser() {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.auth.getUser()
    if (error) throw error
    return data.user
  },

  onAuthStateChange(callback: (event: string, session: any) => void) {
    const supabase = getSupabaseClient()
    return supabase.auth.onAuthStateChange(callback)
  },
}

// =====================================================
// USER SERVICE
// =====================================================

export const userService = {
  async getProfile(): Promise<User | null> {
    const supabase = getSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) throw error
    return data
  },

  async updateProfile(updates: Partial<User>): Promise<User> {
    const supabase = getSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('users')
      // @ts-expect-error - Supabase type inference issue with @supabase/ssr
      .update(updates as UpdateUser)
      .eq('id', user.id)
      .select()
      .single()

    if (error) throw error
    return data
  },
}

// =====================================================
// REPOSITORY SERVICE
// =====================================================

export const repositoryService = {
  async getAll(): Promise<Repository[]> {
    const supabase = getSupabaseClient()
    console.log('[REPO SERVICE] Fetching all repositories')
    
    const { data, error } = await supabase
      .from('repositories')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[REPO SERVICE] Failed to fetch repositories:', error)
      throw new Error(`Failed to fetch repositories: ${error.message}`)
    }
    
    console.log('[REPO SERVICE] Fetched repositories:', data?.length || 0)
    return data || []
  },

  async getById(id: number): Promise<Repository> {
    const supabase = getSupabaseClient()
    console.log('[REPO SERVICE] Fetching repository:', id)
    
    const { data, error } = await supabase
      .from('repositories')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('[REPO SERVICE] Failed to fetch repository:', error)
      throw new Error(`Repository not found: ${error.message}`)
    }
    return data
  },

  async create(repo: Omit<InsertRepository, 'user_id'>): Promise<Repository> {
    const supabase = getSupabaseClient()
    console.log('[REPO SERVICE] Creating repository:', repo.name, repo.url)
    
    // Get session (uses cached data, faster than getUser)
    console.log('[REPO SERVICE] Getting session...')
    let user
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) {
        console.error('[REPO SERVICE] Session error:', sessionError.message)
        throw new Error('Session error. Please log in again.')
      }
      user = session?.user
    } catch (authError: any) {
      console.error('[REPO SERVICE] Auth error:', authError.message)
      throw new Error(authError.message || 'Authentication failed. Please refresh and try again.')
    }
    
    if (!user) {
      console.error('[REPO SERVICE] User not authenticated')
      throw new Error('Not authenticated. Please log in again.')
    }
    
    console.log('[REPO SERVICE] User authenticated:', user.id)

    // Try to ensure user profile exists with timeout
    try {
      console.log('[REPO SERVICE] Checking/creating user profile...')
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('User profile check timed out')), 5000)
      )
      
      const userCheckPromise = (async () => {
        const { data: existingUser, error: userCheckError } = await supabase
          .from('users')
          .select('id')
          .eq('id', user.id)
          .single()
        
        if (userCheckError && userCheckError.code !== 'PGRST116') {
          console.log('[REPO SERVICE] User check error (non-critical):', userCheckError.message)
        }
        
        if (!existingUser) {
          console.log('[REPO SERVICE] User profile not found, creating...')
          const { error: createUserError } = await supabase
            .from('users')
            .insert({
              id: user.id,
              email: user.email || '',
              full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
              subscription_tier: 'basic',
            })
          
          if (createUserError && createUserError.code !== '23505') {
            console.warn('[REPO SERVICE] User profile creation failed (non-critical):', createUserError.message)
          } else {
            console.log('[REPO SERVICE] User profile created successfully')
          }
        }
      })()
      
      await Promise.race([userCheckPromise, timeoutPromise])
    } catch (profileError) {
      // Non-critical - continue with repository creation anyway
      console.warn('[REPO SERVICE] User profile check failed (continuing):', profileError)
    }

    // Prepare repository data with all required fields
    const repoData: InsertRepository = {
      ...repo,
      user_id: user.id,
      status: repo.status || 'active',
      secrets_count: 0,
    }
    
    console.log('[REPO SERVICE] Inserting repository data:', repoData)

    // Insert with timeout
    let data, error
    try {
      const insertPromise = supabase
        .from('repositories')
        // @ts-expect-error - Supabase type inference issue with @supabase/ssr
        .insert(repoData)
        .select()
        .single()
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Repository insert timed out. Please try again.')), 15000)
      )
      
      const result = await Promise.race([insertPromise, timeoutPromise]) as { data: any, error: any }
      data = result.data
      error = result.error
    } catch (insertError: any) {
      console.error('[REPO SERVICE] Insert error:', insertError.message)
      throw new Error(insertError.message || 'Failed to create repository. Please try again.')
    }

    if (error) {
      console.error('[REPO SERVICE] Failed to create repository:', error)
      
      // Provide user-friendly error messages
      if (error.code === '23505') {
        throw new Error('A repository with this URL already exists')
      } else if (error.code === '23503') {
        throw new Error('Invalid user reference. Please log in again.')
      } else if (error.code === '42501') {
        throw new Error('Permission denied. Check your subscription.')
      }
      
      throw new Error(`Failed to save repository: ${error.message}`)
    }
    
    if (!data) {
      console.error('[REPO SERVICE] No data returned after insert')
      throw new Error('Repository was not saved. Please try again.')
    }
    
    console.log('[REPO SERVICE] Repository created successfully:', data.id)
    return data
  },

  async update(id: number, updates: UpdateRepository): Promise<Repository> {
    const supabase = getSupabaseClient()
    console.log('[REPO SERVICE] Updating repository:', id)
    const { data, error } = await supabase
      .from('repositories')
      // @ts-expect-error - Supabase type inference issue with @supabase/ssr
      .update(updates as UpdateRepository)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async delete(id: number): Promise<void> {
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('repositories')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  async scan(id: number, maxRetries: number = 3): Promise<Scan> {
    const supabase = getSupabaseClient()
    console.log('[REPO SERVICE] Starting scan for repository:', id)
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.error('[REPO SERVICE] User not authenticated for scan')
      throw new Error('Not authenticated')
    }

    // Get repository details
    const { data: repo, error: repoError } = await supabase
      .from('repositories')
      .select('*')
      .eq('id', id)
      .single()

    if (repoError || !repo) {
      console.error('[REPO SERVICE] Repository not found for scan:', repoError)
      throw new Error('Repository not found')
    }
    
    // Type assertion for repo since Supabase type inference has issues with @supabase/ssr
    const repository = repo as Repository
    console.log('[REPO SERVICE] Repository found:', repository.name, repository.url)

    // Create a new scan record in Supabase
    const { data, error } = await supabase
      .from('scans')
      // @ts-expect-error - Supabase type inference issue with @supabase/ssr
      .insert({
        repository_id: id,
        user_id: user.id,
        status: 'pending',
        trigger_type: 'manual',
        branch: repository.branch || 'main',
      } as InsertScan)
      .select()
      .single()

    if (error) {
      console.error('[REPO SERVICE] Failed to create scan record:', error)
      throw new Error(`Failed to create scan: ${error.message}`)
    }
    if (!data) {
      console.error('[REPO SERVICE] No scan data returned')
      throw new Error('Failed to create scan')
    }
    
    // Type assertion for scan data since Supabase type inference has issues with @supabase/ssr
    const scanData = data as Scan
    console.log('[REPO SERVICE] Scan record created:', scanData.id)

    // Update repository last_scan_at
    await supabase
      .from('repositories')
      // @ts-expect-error - Supabase type inference issue with @supabase/ssr
      .update({ last_scan_at: new Date().toISOString() } as UpdateRepository)
      .eq('id', id)

    // Call backend API to trigger the actual scan with retry logic
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'
    
    // Get user's access token for backend to use with Supabase (RLS)
    const { data: { session } } = await supabase.auth.getSession()
    const accessToken = session?.access_token || ''
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[REPO SERVICE] Triggering scan API (attempt ${attempt}/${maxRetries})`)
        
        const response = await fetch(`${apiUrl}/scans/trigger`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({
            scan_id: scanData.id,
            repository_id: id,
            repository_url: repository.url,
            branch: repository.branch || 'main',
          }),
        })
        
        if (response.ok) {
          console.log('[REPO SERVICE] Scan triggered successfully')
          break
        }
        
        // Check for rate limit
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After')
          const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : attempt * 2000
          console.warn(`[REPO SERVICE] Rate limited, waiting ${waitTime}ms before retry`)
          await new Promise(resolve => setTimeout(resolve, waitTime))
          continue
        }
        
        // Other errors
        const errorText = await response.text()
        console.error(`[REPO SERVICE] Scan trigger failed (${response.status}):`, errorText)
        
        if (attempt === maxRetries) {
          console.warn('[REPO SERVICE] All retry attempts failed, scan created in Supabase only')
        }
        
      } catch (err) {
        console.warn(`[REPO SERVICE] Scan trigger attempt ${attempt} failed:`, err)
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, attempt * 1000))
        } else {
          console.warn('[REPO SERVICE] Backend API not available, scan created in Supabase only')
        }
      }
    }

    return scanData
  },
}

// =====================================================
// SCAN SERVICE
// =====================================================

export const scanService = {
  async getAll(): Promise<(Scan & { repository_name?: string })[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('scans')
      .select(`
        *,
        repositories (name)
      `)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data || []).map((scan: any) => ({
      ...scan,
      repository_name: scan.repositories?.name,
    }))
  },

  async getById(id: number): Promise<Scan> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('scans')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },

  async getByScanId(scanId: string): Promise<Scan> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('scans')
      .select('*')
      .eq('scan_id', scanId)
      .single()

    if (error) throw error
    return data
  },

  async getByRepository(repositoryId: number): Promise<Scan[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('scans')
      .select('*')
      .eq('repository_id', repositoryId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async update(id: number, updates: UpdateScan): Promise<Scan> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('scans')
      // @ts-expect-error - Supabase type inference issue
      .update(updates as UpdateScan)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data as Scan
  },

  async cancel(id: number): Promise<void> {
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('scans')
      // @ts-expect-error - Supabase type inference issue
      .update({ status: 'cancelled', completed_at: new Date().toISOString() } as UpdateScan)
      .eq('id', id)

    if (error) throw error
  },

  async getRecentScans(limit: number = 5): Promise<Scan[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('scans')
      .select(`
        *,
        repositories (name)
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return (data || []).map((scan: any) => ({
      ...scan,
      repository_name: scan.repositories?.name,
    }))
  },
}

// =====================================================
// SECRET SERVICE
// =====================================================

export const secretService = {
  async getAll(): Promise<(Secret & { repository_name?: string })[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('secrets')
      .select(`
        *,
        repositories (name)
      `)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data || []).map((secret: any) => ({
      ...secret,
      repository_name: secret.repositories?.name,
    }))
  },

  async getById(id: number): Promise<Secret> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('secrets')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },

  async getByScan(scanId: number): Promise<Secret[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('secrets')
      .select('*')
      .eq('scan_id', scanId)
      .order('risk_level', { ascending: true })

    if (error) throw error
    return data || []
  },

  async getByRepository(repositoryId: number): Promise<Secret[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('secrets')
      .select('*')
      .eq('repository_id', repositoryId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async updateStatus(id: number, status: Secret['status'], notes?: string): Promise<Secret> {
    const supabase = getSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    const updates: UpdateSecret = {
      status,
      updated_at: new Date().toISOString(),
    }

    if (status === 'resolved' || status === 'ignored' || status === 'false_positive') {
      updates.resolved_at = new Date().toISOString()
      updates.resolved_by = user?.id
    }

    const { data, error } = await supabase
      .from('secrets')
      // @ts-expect-error - Supabase type inference issue
      .update(updates as UpdateSecret)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data as Secret
  },

  async getTopSecrets(limit: number = 5): Promise<Secret[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('secrets')
      .select(`
        *,
        repositories (name)
      `)
      .eq('status', 'active')
      .order('risk_level', { ascending: true }) // critical first
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return (data || []).map((secret: any) => ({
      ...secret,
      repository_name: secret.repositories?.name,
    }))
  },
}

// =====================================================
// ALERT SERVICE
// =====================================================

export const alertService = {
  async getAll(): Promise<Alert[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('alerts')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async getUnread(): Promise<Alert[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('alerts')
      .select('*')
      .eq('is_read', false)
      .eq('is_dismissed', false)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async getUnreadCount(): Promise<number> {
    const supabase = getSupabaseClient()
    const { count, error } = await supabase
      .from('alerts')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false)
      .eq('is_dismissed', false)

    if (error) throw error
    return count || 0
  },

  async markAsRead(id: number): Promise<void> {
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('alerts')
      // @ts-expect-error - Supabase type inference issue
      .update({ is_read: true } as UpdateAlert)
      .eq('id', id)

    if (error) throw error
  },

  async markAllAsRead(): Promise<void> {
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('alerts')
      // @ts-expect-error - Supabase type inference issue
      .update({ is_read: true } as UpdateAlert)
      .eq('is_read', false)

    if (error) throw error
  },

  async dismiss(id: number): Promise<void> {
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('alerts')
      // @ts-expect-error - Supabase type inference issue
      .update({ is_dismissed: true } as UpdateAlert)
      .eq('id', id)

    if (error) throw error
  },

  async delete(id: number): Promise<void> {
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('alerts')
      .delete()
      .eq('id', id)

    if (error) throw error
  },
}

// =====================================================
// DASHBOARD SERVICE
// =====================================================

export const dashboardService = {
  async getStats() {
    const supabase = getSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Get stats in parallel
    const [
      { count: totalScans },
      { count: secretsFound },
      { count: highRiskIssues },
      { count: repositoriesMonitored },
      { count: scansThisWeek },
      { count: secretsResolved },
    ] = await Promise.all([
      supabase.from('scans').select('*', { count: 'exact', head: true }),
      supabase.from('secrets').select('*', { count: 'exact', head: true }),
      supabase.from('secrets').select('*', { count: 'exact', head: true })
        .in('risk_level', ['critical', 'high']).eq('status', 'active'),
      supabase.from('repositories').select('*', { count: 'exact', head: true }),
      supabase.from('scans').select('*', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      supabase.from('secrets').select('*', { count: 'exact', head: true })
        .eq('status', 'resolved'),
    ])

    return {
      total_scans: totalScans || 0,
      secrets_found: secretsFound || 0,
      high_risk_issues: highRiskIssues || 0,
      repositories_monitored: repositoriesMonitored || 0,
      scans_this_week: scansThisWeek || 0,
      secrets_resolved: secretsResolved || 0,
    }
  },

  async getRiskDistribution() {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('secrets')
      .select('risk_level')
      .eq('status', 'active')

    if (error) throw error

    const distribution = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    }

    ;(data as { risk_level: keyof typeof distribution }[] | null)?.forEach(secret => {
      if (secret.risk_level in distribution) {
        distribution[secret.risk_level]++
      }
    })

    return distribution
  },

  async getScanActivity(days: number = 7) {
    const supabase = getSupabaseClient()
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const { data, error } = await supabase
      .from('scans')
      .select('created_at, secrets_found')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true })

    if (error) throw error

    // Group by date
    const activityByDate: Record<string, { scans: number; secrets_found: number }> = {}
    
    ;(data as { created_at: string; secrets_found: number }[] | null)?.forEach(scan => {
      const date = new Date(scan.created_at).toLocaleDateString('en-US', { weekday: 'short' })
      if (!activityByDate[date]) {
        activityByDate[date] = { scans: 0, secrets_found: 0 }
      }
      activityByDate[date].scans++
      activityByDate[date].secrets_found += scan.secrets_found
    })

    return Object.entries(activityByDate).map(([date, data]) => ({
      date,
      ...data,
    }))
  },

  async getDashboardData() {
    const [stats, riskDistribution, scanActivity, recentScans, topSecrets] = await Promise.all([
      this.getStats(),
      this.getRiskDistribution(),
      this.getScanActivity(),
      scanService.getRecentScans(5),
      secretService.getTopSecrets(5),
    ])

    return {
      stats,
      risk_distribution: riskDistribution,
      scan_activity: scanActivity,
      recent_scans: recentScans,
      top_secrets: topSecrets,
    }
  },
}

// =====================================================
// API KEY SERVICE
// =====================================================

export const apiKeyService = {
  async getAll(): Promise<ApiKey[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async create(name: string, permissions: string[] = ['read']): Promise<{ key: string; apiKey: ApiKey }> {
    const supabase = getSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Generate a random API key
    const key = `ss_${crypto.randomUUID().replace(/-/g, '')}`
    const keyPrefix = key.substring(0, 10)
    
    // Hash the key (in production, use proper server-side hashing)
    const keyHash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(key)
    ).then(hash => 
      Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
    )

    const { data, error } = await supabase
      .from('api_keys')
      // @ts-expect-error - Supabase type inference issue
      .insert({
        user_id: user.id,
        name,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        permissions,
      } as InsertApiKey)
      .select()
      .single()

    if (error) throw error
    return { key, apiKey: data as ApiKey }
  },

  async revoke(id: number): Promise<void> {
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('api_keys')
      // @ts-expect-error - Supabase type inference issue
      .update({ is_active: false } as UpdateApiKey)
      .eq('id', id)

    if (error) throw error
  },

  async delete(id: number): Promise<void> {
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('api_keys')
      .delete()
      .eq('id', id)

    if (error) throw error
  },
}

// =====================================================
// INTEGRATION SERVICE
// =====================================================

export const integrationService = {
  async getAll(): Promise<Integration[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('integrations')
      .select('*')
      .order('connected_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async connect(provider: Integration['provider'], settings: Record<string, any> = {}): Promise<Integration> {
    const supabase = getSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('integrations')
      // @ts-expect-error - Supabase type inference issue
      .upsert({
        user_id: user.id,
        provider,
        settings,
        is_active: true,
      } as InsertIntegration)
      .select()
      .single()

    if (error) throw error
    return data as Integration
  },

  async disconnect(id: number): Promise<void> {
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('integrations')
      // @ts-expect-error - Supabase type inference issue
      .update({ is_active: false } as UpdateIntegration)
      .eq('id', id)

    if (error) throw error
  },

  async updateSettings(id: number, settings: Record<string, any>): Promise<Integration> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('integrations')
      // @ts-expect-error - Supabase type inference issue
      .update({ settings } as UpdateIntegration)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data as Integration
  },
}

// =====================================================
// REALTIME SUBSCRIPTIONS
// =====================================================

export const realtimeService = {
  subscribeToScans(callback: (scan: Scan) => void) {
    const supabase = getSupabaseClient()
    return supabase
      .channel('scans-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scans' },
        (payload) => callback(payload.new as Scan)
      )
      .subscribe()
  },

  subscribeToAlerts(callback: (alert: Alert) => void) {
    const supabase = getSupabaseClient()
    return supabase
      .channel('alerts-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alerts' },
        (payload) => callback(payload.new as Alert)
      )
      .subscribe()
  },

  subscribeToSecrets(repositoryId: number, callback: (secret: Secret) => void) {
    const supabase = getSupabaseClient()
    return supabase
      .channel(`secrets-${repositoryId}`)
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'secrets',
          filter: `repository_id=eq.${repositoryId}`
        },
        (payload) => callback(payload.new as Secret)
      )
      .subscribe()
  },

  unsubscribe(channel: ReturnType<typeof getSupabaseClient>['channel'] extends (name: string) => infer R ? R : never) {
    const supabase = getSupabaseClient()
    supabase.removeChannel(channel as any)
  },
}
