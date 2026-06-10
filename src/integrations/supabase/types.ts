export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_usage_events: {
        Row: {
          audit_id: string | null
          completion_tokens: number
          cost_estimate_usd: number
          cost_known: boolean
          created_at: string
          id: string
          model: string
          paid_by: string
          prompt_tokens: number
          prompt_version: string | null
          provider: string | null
          total_tokens: number
          user_id: string | null
        }
        Insert: {
          audit_id?: string | null
          completion_tokens: number
          cost_estimate_usd: number
          cost_known?: boolean
          created_at?: string
          id?: string
          model: string
          paid_by?: string
          prompt_tokens: number
          prompt_version?: string | null
          provider?: string | null
          total_tokens?: number
          user_id?: string | null
        }
        Update: {
          audit_id?: string | null
          completion_tokens?: number
          cost_estimate_usd?: number
          cost_known?: boolean
          created_at?: string
          id?: string
          model?: string
          paid_by?: string
          prompt_tokens?: number
          prompt_version?: string | null
          provider?: string | null
          total_tokens?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_events_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audits"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_issue_feedback: {
        Row: {
          audit_id: string
          created_at: string
          engine_id: string
          id: string
          issue_index: number
          reason: string | null
          stance: string
          updated_at: string
        }
        Insert: {
          audit_id: string
          created_at?: string
          engine_id: string
          id?: string
          issue_index: number
          reason?: string | null
          stance: string
          updated_at?: string
        }
        Update: {
          audit_id?: string
          created_at?: string
          engine_id?: string
          id?: string
          issue_index?: number
          reason?: string | null
          stance?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_issue_feedback_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audits"
            referencedColumns: ["id"]
          },
        ]
      }
      audits: {
        Row: {
          ai_model: string | null
          ai_provider: string | null
          ai_report: Json | null
          analysis: string | null
          completed_at: string | null
          context_images: Json | null
          created_at: string
          error_message: string | null
          executive_content: Json | null
          export_scale: number | null
          feedback_comment: string | null
          feedback_rating: number | null
          figma_file_key: string | null
          figma_frame_names: Json | null
          figma_node_ids: Json | null
          flow_images: Json | null
          follow_up_audit_id: string | null
          id: string
          node_maps: Json | null
          overall_score: number | null
          paid_by: string | null
          project_id: string
          reaudit_explanation: string | null
          reaudit_type: string | null
          reaudit_user_note: string | null
          screen_context: string | null
          screenshot_url: string
          selected_personas: Json | null
          source: string
          status: string
          user_data: string | null
          user_id: string
          visible_in_app: boolean
        }
        Insert: {
          ai_model?: string | null
          ai_provider?: string | null
          ai_report?: Json | null
          analysis?: string | null
          completed_at?: string | null
          context_images?: Json | null
          created_at?: string
          error_message?: string | null
          executive_content?: Json | null
          export_scale?: number | null
          feedback_comment?: string | null
          feedback_rating?: number | null
          figma_file_key?: string | null
          figma_frame_names?: Json | null
          figma_node_ids?: Json | null
          flow_images?: Json | null
          follow_up_audit_id?: string | null
          id?: string
          node_maps?: Json | null
          overall_score?: number | null
          paid_by?: string | null
          project_id: string
          reaudit_explanation?: string | null
          reaudit_type?: string | null
          reaudit_user_note?: string | null
          screen_context?: string | null
          screenshot_url: string
          selected_personas?: Json | null
          source?: string
          status?: string
          user_data?: string | null
          user_id: string
          visible_in_app?: boolean
        }
        Update: {
          ai_model?: string | null
          ai_provider?: string | null
          ai_report?: Json | null
          analysis?: string | null
          completed_at?: string | null
          context_images?: Json | null
          created_at?: string
          error_message?: string | null
          executive_content?: Json | null
          export_scale?: number | null
          feedback_comment?: string | null
          feedback_rating?: number | null
          figma_file_key?: string | null
          figma_frame_names?: Json | null
          figma_node_ids?: Json | null
          flow_images?: Json | null
          follow_up_audit_id?: string | null
          id?: string
          node_maps?: Json | null
          overall_score?: number | null
          paid_by?: string | null
          project_id?: string
          reaudit_explanation?: string | null
          reaudit_type?: string | null
          reaudit_user_note?: string | null
          screen_context?: string | null
          screenshot_url?: string
          selected_personas?: Json | null
          source?: string
          status?: string
          user_data?: string | null
          user_id?: string
          visible_in_app?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "audits_follow_up_audit_id_fkey"
            columns: ["follow_up_audit_id"]
            isOneToOne: false
            referencedRelation: "audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audits_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audits_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "public_showcase_audit"
            referencedColumns: ["project_id"]
          },
        ]
      }
      crawl_jobs: {
        Row: {
          audit_id: string
          crawl_url: string
          created_at: string | null
          id: string
          project_id: string
          steel_session_id: string | null
        }
        Insert: {
          audit_id: string
          crawl_url: string
          created_at?: string | null
          id?: string
          project_id: string
          steel_session_id?: string | null
        }
        Update: {
          audit_id?: string
          crawl_url?: string
          created_at?: string | null
          id?: string
          project_id?: string
          steel_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crawl_jobs_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crawl_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crawl_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "public_showcase_audit"
            referencedColumns: ["project_id"]
          },
        ]
      }
      email_preferences: {
        Row: {
          activity_digest: boolean
          marketing: boolean
          product_updates: boolean
          unsubscribe_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_digest?: boolean
          marketing?: boolean
          product_updates?: boolean
          unsubscribe_token?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_digest?: boolean
          marketing?: boolean
          product_updates?: boolean
          unsubscribe_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_sends: {
        Row: {
          created_at: string
          email_type: string
          id: string
          sent_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_type: string
          id?: string
          sent_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_type?: string
          id?: string
          sent_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      error_events: {
        Row: {
          context: string
          created_at: string
          error_code: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          source: string
          user_id: string | null
        }
        Insert: {
          context: string
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          source: string
          user_id?: string | null
        }
        Update: {
          context?: string
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          source?: string
          user_id?: string | null
        }
        Relationships: []
      }
      interest_leads: {
        Row: {
          created_at: string
          email: string | null
          id: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      mcp_auth_state: {
        Row: {
          auth_code: string | null
          client_id: string
          code_challenge: string
          code_challenge_method: string
          created_at: string
          expires_at: string
          redirect_uri: string
          scope: string | null
          session_key: string
          state: string
          user_id: string | null
        }
        Insert: {
          auth_code?: string | null
          client_id: string
          code_challenge: string
          code_challenge_method?: string
          created_at?: string
          expires_at?: string
          redirect_uri: string
          scope?: string | null
          session_key: string
          state: string
          user_id?: string | null
        }
        Update: {
          auth_code?: string | null
          client_id?: string
          code_challenge?: string
          code_challenge_method?: string
          created_at?: string
          expires_at?: string
          redirect_uri?: string
          scope?: string | null
          session_key?: string
          state?: string
          user_id?: string | null
        }
        Relationships: []
      }
      mcp_sessions: {
        Row: {
          access_token_hash: string
          client_id: string
          created_at: string
          expires_at: string
          id: string
          refresh_expires_at: string
          refresh_token_hash: string
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          access_token_hash: string
          client_id: string
          created_at?: string
          expires_at: string
          id?: string
          refresh_expires_at: string
          refresh_token_hash: string
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          access_token_hash?: string
          client_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          refresh_expires_at?: string
          refresh_token_hash?: string
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      oauth_state: {
        Row: {
          created_at: string
          state: string
          user_id: string
        }
        Insert: {
          created_at?: string
          state: string
          user_id: string
        }
        Update: {
          created_at?: string
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      org_members: {
        Row: {
          created_at: string
          id: string
          invite_expires_at: string | null
          invite_token: string | null
          invited_email: string
          org_id: string
          role: string
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          invite_expires_at?: string | null
          invite_token?: string | null
          invited_email: string
          org_id: string
          role: string
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          invite_expires_at?: string | null
          invite_token?: string | null
          invited_email?: string
          org_id?: string
          role?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      plugin_link_codes: {
        Row: {
          created_at: string
          expires_at: string
          plugin_token: string | null
          state: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          plugin_token?: string | null
          state: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          plugin_token?: string | null
          state?: string
        }
        Relationships: []
      }
      plugin_tokens: {
        Row: {
          created_at: string
          id: string
          last_used_at: string | null
          token_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_used_at?: string | null
          token_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_used_at?: string | null
          token_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          completed_tours: Json
          created_at: string
          default_llm_provider: string | null
          display_name: string | null
          figma_access_token: string | null
          free_analysis_used_at: string | null
          has_figma_token: boolean
          id: string
          language: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          completed_tours?: Json
          created_at?: string
          default_llm_provider?: string | null
          display_name?: string | null
          figma_access_token?: string | null
          free_analysis_used_at?: string | null
          has_figma_token?: boolean
          id?: string
          language?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          completed_tours?: Json
          created_at?: string
          default_llm_provider?: string | null
          display_name?: string | null
          figma_access_token?: string | null
          free_analysis_used_at?: string | null
          has_figma_token?: boolean
          id?: string
          language?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_context_documents: {
        Row: {
          content: string
          created_at: string
          external_id: string | null
          id: string
          original_filename: string | null
          project_id: string
          source: string
          storage_path: string | null
          summary: string | null
        }
        Insert: {
          content?: string
          created_at?: string
          external_id?: string | null
          id?: string
          original_filename?: string | null
          project_id: string
          source?: string
          storage_path?: string | null
          summary?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          external_id?: string | null
          id?: string
          original_filename?: string | null
          project_id?: string
          source?: string
          storage_path?: string | null
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_context_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_context_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "public_showcase_audit"
            referencedColumns: ["project_id"]
          },
        ]
      }
      project_personas: {
        Row: {
          created_at: string
          description: string
          id: string
          name: string
          project_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          name: string
          project_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          name?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_personas_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_personas_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "public_showcase_audit"
            referencedColumns: ["project_id"]
          },
        ]
      }
      projects: {
        Row: {
          additional_context: string | null
          constraints: string | null
          created_at: string
          global_mission: string | null
          id: string
          language: string
          mission: string
          name: string
          org_id: string | null
          persona: string
          product_name: string | null
          scope: string
          updated_at: string
          user_id: string
        }
        Insert: {
          additional_context?: string | null
          constraints?: string | null
          created_at?: string
          global_mission?: string | null
          id?: string
          language?: string
          mission: string
          name: string
          org_id?: string | null
          persona: string
          product_name?: string | null
          scope?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          additional_context?: string | null
          constraints?: string | null
          created_at?: string
          global_mission?: string | null
          id?: string
          language?: string
          mission?: string
          name?: string
          org_id?: string | null
          persona?: string
          product_name?: string | null
          scope?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      showcase_audits: {
        Row: {
          audit_id: string
          created_at: string
          display_order: number
          id: string
          public_flow_images: string[]
          section: string
          slug: string
          translations: Json
          updated_at: string
        }
        Insert: {
          audit_id: string
          created_at?: string
          display_order?: number
          id?: string
          public_flow_images?: string[]
          section?: string
          slug: string
          translations?: Json
          updated_at?: string
        }
        Update: {
          audit_id?: string
          created_at?: string
          display_order?: number
          id?: string
          public_flow_images?: string[]
          section?: string
          slug?: string
          translations?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "showcase_audits_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audits"
            referencedColumns: ["id"]
          },
        ]
      }
      user_integrations: {
        Row: {
          account_name: string | null
          created_at: string
          encrypted_access_token: string
          encrypted_refresh_token: string | null
          id: string
          provider: string
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_name?: string | null
          created_at?: string
          encrypted_access_token: string
          encrypted_refresh_token?: string | null
          id?: string
          provider: string
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_name?: string | null
          created_at?: string
          encrypted_access_token?: string
          encrypted_refresh_token?: string | null
          id?: string
          provider?: string
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_llm_keys: {
        Row: {
          created_at: string
          encrypted_key: string
          id: string
          last_test_status: string | null
          last_used_at: string | null
          model_override: string | null
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          encrypted_key: string
          id?: string
          last_test_status?: string | null
          last_used_at?: string | null
          model_override?: string | null
          provider: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          encrypted_key?: string
          id?: string
          last_test_status?: string | null
          last_used_at?: string | null
          model_override?: string | null
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      profiles_public: {
        Row: {
          created_at: string | null
          has_figma_token: boolean | null
          id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          has_figma_token?: boolean | null
          id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          has_figma_token?: boolean | null
          id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      public_showcase_audit: {
        Row: {
          ai_report: Json | null
          audit_created_at: string | null
          audit_id: string | null
          display_order: number | null
          overall_score: number | null
          project_id: string | null
          project_language: string | null
          project_mission: string | null
          project_name: string | null
          project_persona: string | null
          public_flow_images: string[] | null
          screen_context: string | null
          section: string | null
          selected_personas: Json | null
          slug: string | null
          translations: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "showcase_audits_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audits"
            referencedColumns: ["id"]
          },
        ]
      }
      user_llm_keys_safe: {
        Row: {
          created_at: string | null
          id: string | null
          last_test_status: string | null
          last_used_at: string | null
          model_override: string | null
          provider: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          last_test_status?: string | null
          last_used_at?: string | null
          model_override?: string | null
          provider?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          last_test_status?: string | null
          last_used_at?: string | null
          model_override?: string | null
          provider?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_old_screenshot_paths: {
        Args: { days_old: number; max_rows?: number }
        Returns: {
          name: string
        }[]
      }
      admin_screenshots_bucket_stats: {
        Args: never
        Returns: {
          file_count: number
          oldest: string
          total_bytes: number
        }[]
      }
      audit_is_showcased: { Args: { p_audit_id: string }; Returns: boolean }
      get_member_profiles: {
        Args: { p_user_ids: string[] }
        Returns: {
          avatar_url: string
          display_name: string
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_member: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: boolean
      }
      project_has_showcased_audit: {
        Args: { p_project_id: string }
        Returns: boolean
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
