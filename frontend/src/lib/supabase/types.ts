export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          role: 'admin' | 'developer' | 'viewer'
          company: string | null
          timezone: string
          subscription_tier: 'basic' | 'premium' | 'premium_plus'
          subscription_started_at: string | null
          subscription_expires_at: string | null
          is_trial: boolean
          trial_ends_at: string | null
          scans_this_week: number
          scans_today: number
          github_token: string | null
          github_username: string | null
          github_token_hash: string | null
          github_token_added_at: string | null
          gitlab_token: string | null
          bitbucket_token: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          role?: 'admin' | 'developer' | 'viewer'
          company?: string | null
          timezone?: string
          subscription_tier?: 'basic' | 'premium' | 'premium_plus'
          is_trial?: boolean
          github_token?: string | null
          github_username?: string | null
          gitlab_token?: string | null
          bitbucket_token?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          role?: 'admin' | 'developer' | 'viewer'
          company?: string | null
          timezone?: string
          subscription_tier?: 'basic' | 'premium' | 'premium_plus'
          is_trial?: boolean
          github_token?: string | null
          github_username?: string | null
          gitlab_token?: string | null
          bitbucket_token?: string | null
          updated_at?: string
        }
      }
      repositories: {
        Row: {
          id: number
          user_id: string
          name: string
          url: string
          provider: 'github' | 'gitlab' | 'bitbucket' | 'azure'
          branch: string
          status: 'active' | 'inactive' | 'error'
          last_scan_at: string | null
          secrets_count: number
          webhook_secret: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          user_id: string
          name: string
          url: string
          provider?: 'github' | 'gitlab' | 'bitbucket' | 'azure'
          branch?: string
          status?: 'active' | 'inactive' | 'error'
          last_scan_at?: string | null
          secrets_count?: number
          webhook_secret?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          url?: string
          provider?: 'github' | 'gitlab' | 'bitbucket' | 'azure'
          branch?: string
          status?: 'active' | 'inactive' | 'error'
          last_scan_at?: string | null
          secrets_count?: number
          webhook_secret?: string | null
          updated_at?: string
        }
      }
      scans: {
        Row: {
          id: number
          scan_id: string
          repository_id: number
          user_id: string
          status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
          branch: string
          commit_hash: string | null
          trigger_type: 'manual' | 'webhook' | 'scheduled' | 'api'
          files_scanned: number
          secrets_found: number
          duration_seconds: number | null
          error_message: string | null
          started_at: string
          completed_at: string | null
          created_at: string
        }
        Insert: {
          id?: number
          scan_id?: string
          repository_id: number
          user_id: string
          status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
          branch?: string
          commit_hash?: string | null
          trigger_type?: 'manual' | 'webhook' | 'scheduled' | 'api'
          files_scanned?: number
          secrets_found?: number
          duration_seconds?: number | null
          error_message?: string | null
          started_at?: string
          completed_at?: string | null
          created_at?: string
        }
        Update: {
          status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
          branch?: string
          commit_hash?: string | null
          files_scanned?: number
          secrets_found?: number
          duration_seconds?: number | null
          error_message?: string | null
          completed_at?: string | null
        }
      }
      secrets: {
        Row: {
          id: number
          scan_id: number
          repository_id: number
          user_id: string
          type: string
          description: string | null
          risk_level: 'critical' | 'high' | 'medium' | 'low' | 'info'
          file_path: string
          line_number: number
          column_start: number | null
          column_end: number | null
          masked_value: string
          entropy_score: number | null
          status: 'active' | 'resolved' | 'ignored' | 'false_positive'
          resolved_at: string | null
          resolved_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          scan_id: number
          repository_id: number
          user_id: string
          type: string
          description?: string | null
          risk_level?: 'critical' | 'high' | 'medium' | 'low' | 'info'
          file_path: string
          line_number: number
          column_start?: number | null
          column_end?: number | null
          masked_value: string
          entropy_score?: number | null
          status?: 'active' | 'resolved' | 'ignored' | 'false_positive'
          resolved_at?: string | null
          resolved_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          type?: string
          description?: string | null
          risk_level?: 'critical' | 'high' | 'medium' | 'low' | 'info'
          status?: 'active' | 'resolved' | 'ignored' | 'false_positive'
          resolved_at?: string | null
          resolved_by?: string | null
          updated_at?: string
        }
      }
      alerts: {
        Row: {
          id: number
          user_id: string
          secret_id: number | null
          scan_id: number | null
          repository_id: number | null
          type: 'critical_secret' | 'high_secret' | 'scan_failed' | 'new_repository' | 'scan_completed'
          title: string
          message: string
          severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
          is_read: boolean
          is_dismissed: boolean
          action_url: string | null
          created_at: string
        }
        Insert: {
          id?: number
          user_id: string
          secret_id?: number | null
          scan_id?: number | null
          repository_id?: number | null
          type: 'critical_secret' | 'high_secret' | 'scan_failed' | 'new_repository' | 'scan_completed'
          title: string
          message: string
          severity?: 'critical' | 'high' | 'medium' | 'low' | 'info'
          is_read?: boolean
          is_dismissed?: boolean
          action_url?: string | null
          created_at?: string
        }
        Update: {
          is_read?: boolean
          is_dismissed?: boolean
        }
      }
      api_keys: {
        Row: {
          id: number
          user_id: string
          name: string
          key_hash: string
          key_prefix: string
          permissions: string[]
          last_used_at: string | null
          expires_at: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: number
          user_id: string
          name: string
          key_hash: string
          key_prefix: string
          permissions?: string[]
          last_used_at?: string | null
          expires_at?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          name?: string
          permissions?: string[]
          last_used_at?: string | null
          expires_at?: string | null
          is_active?: boolean
        }
      }
      integrations: {
        Row: {
          id: number
          user_id: string
          provider: 'github' | 'gitlab' | 'bitbucket' | 'slack' | 'discord' | 'jira' | 'aws'
          access_token_encrypted: string | null
          refresh_token_encrypted: string | null
          webhook_url: string | null
          settings: Json
          is_active: boolean
          connected_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          user_id: string
          provider: 'github' | 'gitlab' | 'bitbucket' | 'slack' | 'discord' | 'jira' | 'aws'
          access_token_encrypted?: string | null
          refresh_token_encrypted?: string | null
          webhook_url?: string | null
          settings?: Json
          is_active?: boolean
          connected_at?: string
          updated_at?: string
        }
        Update: {
          access_token_encrypted?: string | null
          refresh_token_encrypted?: string | null
          webhook_url?: string | null
          settings?: Json
          is_active?: boolean
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: 'admin' | 'developer' | 'viewer'
      provider_type: 'github' | 'gitlab' | 'bitbucket' | 'azure'
      scan_status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
      risk_level: 'critical' | 'high' | 'medium' | 'low' | 'info'
      secret_status: 'active' | 'resolved' | 'ignored' | 'false_positive'
      alert_type: 'critical_secret' | 'high_secret' | 'scan_failed' | 'new_repository' | 'scan_completed'
    }
  }
}

// Helper types for easier usage
export type User = Database['public']['Tables']['users']['Row']
export type Repository = Database['public']['Tables']['repositories']['Row']
export type Scan = Database['public']['Tables']['scans']['Row']
export type Secret = Database['public']['Tables']['secrets']['Row']
export type Alert = Database['public']['Tables']['alerts']['Row']
export type ApiKey = Database['public']['Tables']['api_keys']['Row']
export type Integration = Database['public']['Tables']['integrations']['Row']

export type InsertUser = Database['public']['Tables']['users']['Insert']
export type InsertRepository = Database['public']['Tables']['repositories']['Insert']
export type InsertScan = Database['public']['Tables']['scans']['Insert']
export type InsertSecret = Database['public']['Tables']['secrets']['Insert']
export type InsertAlert = Database['public']['Tables']['alerts']['Insert']
export type InsertApiKey = Database['public']['Tables']['api_keys']['Insert']
export type InsertIntegration = Database['public']['Tables']['integrations']['Insert']

export type UpdateUser = Database['public']['Tables']['users']['Update']
export type UpdateRepository = Database['public']['Tables']['repositories']['Update']
export type UpdateScan = Database['public']['Tables']['scans']['Update']
export type UpdateSecret = Database['public']['Tables']['secrets']['Update']
export type UpdateAlert = Database['public']['Tables']['alerts']['Update']
export type UpdateApiKey = Database['public']['Tables']['api_keys']['Update']
export type UpdateIntegration = Database['public']['Tables']['integrations']['Update']

// Tables type for explicit typing
export type Tables = Database['public']['Tables']
