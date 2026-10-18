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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          category: string
          code: string
          created_at: string
          criteria: Json
          description: string
          icon: string
          is_active: boolean
          name: string
          sort_order: number
          tier: number
          title_text: string | null
        }
        Insert: {
          category: string
          code: string
          created_at?: string
          criteria?: Json
          description?: string
          icon?: string
          is_active?: boolean
          name: string
          sort_order?: number
          tier?: number
          title_text?: string | null
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          criteria?: Json
          description?: string
          icon?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          tier?: number
          title_text?: string | null
        }
        Relationships: []
      }
      action_types: {
        Row: {
          base_impact_score: number
          category: string | null
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          pillar_group: string
          updated_at: string
        }
        Insert: {
          base_impact_score?: number
          category?: string | null
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          pillar_group?: string
          updated_at?: string
        }
        Update: {
          base_impact_score?: number
          category?: string | null
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          pillar_group?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_prompt_templates: {
        Row: {
          active: boolean
          body: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          scope: string
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          scope: string
          updated_at?: string
          version?: number
        }
        Update: {
          active?: boolean
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          scope?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      ai_prompt_versions: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          template_id: string
          version: number
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          template_id: string
          version: number
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          template_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_prompt_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "ai_prompt_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_provider_usage_log: {
        Row: {
          created_at: string
          estimated_input_tokens: number | null
          estimated_output_tokens: number | null
          function_name: string
          id: string
          metadata: Json
          model: string | null
          provider: string
          status: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          estimated_input_tokens?: number | null
          estimated_output_tokens?: number | null
          function_name: string
          id?: string
          metadata?: Json
          model?: string | null
          provider: string
          status?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          estimated_input_tokens?: number | null
          estimated_output_tokens?: number | null
          function_name?: string
          id?: string
          metadata?: Json
          model?: string | null
          provider?: string
          status?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      ai_routing_log: {
        Row: {
          client_id: string | null
          created_at: string
          error_message: string | null
          fallback_triggered: boolean
          finish_reason: string | null
          id: string
          intent: string
          latency_ms: number | null
          metadata: Json | null
          model_used: string
          provider: string | null
          status: string
          tokens_in: number | null
          tokens_out: number | null
          truncated_hint: boolean | null
          user_id: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          error_message?: string | null
          fallback_triggered?: boolean
          finish_reason?: string | null
          id?: string
          intent: string
          latency_ms?: number | null
          metadata?: Json | null
          model_used: string
          provider?: string | null
          status?: string
          tokens_in?: number | null
          tokens_out?: number | null
          truncated_hint?: boolean | null
          user_id?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          error_message?: string | null
          fallback_triggered?: boolean
          finish_reason?: string | null
          id?: string
          intent?: string
          latency_ms?: number | null
          metadata?: Json | null
          model_used?: string
          provider?: string | null
          status?: string
          tokens_in?: number | null
          tokens_out?: number | null
          truncated_hint?: boolean | null
          user_id?: string | null
        }
        Relationships: []
      }
      ai_routing_policy: {
        Row: {
          active: boolean
          description: string | null
          fallback_model: string | null
          id: string
          intent: string
          model: string
          priority: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          description?: string | null
          fallback_model?: string | null
          id?: string
          intent: string
          model: string
          priority?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          description?: string | null
          fallback_model?: string | null
          id?: string
          intent?: string
          model?: string
          priority?: number
          updated_at?: string
        }
        Relationships: []
      }
      ai_usage_tracking: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          usage_count: number
          usage_date: string
          usage_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
          usage_count?: number
          usage_date?: string
          usage_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          usage_count?: number
          usage_date?: string
          usage_type?: string
          user_id?: string
        }
        Relationships: []
      }
      angel_evolution_log: {
        Row: {
          build_passed: boolean | null
          coordinator_id: string
          created_at: string
          github_status: number | null
          id: string
          phase: string
          pr_branch: string | null
          pr_url: string | null
          reflection: string | null
          reject_reason: string | null
          status: string
          tool_call: Json
          updated_at: string
        }
        Insert: {
          build_passed?: boolean | null
          coordinator_id: string
          created_at?: string
          github_status?: number | null
          id?: string
          phase?: string
          pr_branch?: string | null
          pr_url?: string | null
          reflection?: string | null
          reject_reason?: string | null
          status: string
          tool_call: Json
          updated_at?: string
        }
        Update: {
          build_passed?: boolean | null
          coordinator_id?: string
          created_at?: string
          github_status?: number | null
          id?: string
          phase?: string
          pr_branch?: string | null
          pr_url?: string | null
          reflection?: string | null
          reject_reason?: string | null
          status?: string
          tool_call?: Json
          updated_at?: string
        }
        Relationships: []
      }
      anti_whale_cap_reports: {
        Row: {
          configured_ratio: number
          created_at: string
          cycle_id: string | null
          cycle_number: number | null
          expected_ratio: number
          generated_at: string
          id: string
          max_fun_per_user: number
          pct_of_total_pool: number | null
          period: string | null
          ratio_match: boolean
          raw_report: Json | null
          status: string | null
          total_pool: number
          user_reward_pool: number
          verification: string
        }
        Insert: {
          configured_ratio: number
          created_at?: string
          cycle_id?: string | null
          cycle_number?: number | null
          expected_ratio?: number
          generated_at?: string
          id?: string
          max_fun_per_user: number
          pct_of_total_pool?: number | null
          period?: string | null
          ratio_match: boolean
          raw_report?: Json | null
          status?: string | null
          total_pool: number
          user_reward_pool: number
          verification: string
        }
        Update: {
          configured_ratio?: number
          created_at?: string
          cycle_id?: string | null
          cycle_number?: number | null
          expected_ratio?: number
          generated_at?: string
          id?: string
          max_fun_per_user?: number
          pct_of_total_pool?: number | null
          period?: string | null
          ratio_match?: boolean
          raw_report?: Json | null
          status?: string | null
          total_pool?: number
          user_reward_pool?: number
          verification?: string
        }
        Relationships: []
      }
      api_key_usage: {
        Row: {
          api_key_id: string
          id: string
          request_count: number
          tokens_used: number
          usage_date: string
        }
        Insert: {
          api_key_id: string
          id?: string
          request_count?: number
          tokens_used?: number
          usage_date?: string
        }
        Update: {
          api_key_id?: string
          id?: string
          request_count?: number
          tokens_used?: number
          usage_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_key_usage_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "user_api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_embed_clients: {
        Row: {
          active: boolean
          allowed_origins: string[]
          client_id: string
          created_at: string
          name: string
          scopes: string[]
          updated_at: string
        }
        Insert: {
          active?: boolean
          allowed_origins?: string[]
          client_id: string
          created_at?: string
          name: string
          scopes?: string[]
          updated_at?: string
        }
        Update: {
          active?: boolean
          allowed_origins?: string[]
          client_id?: string
          created_at?: string
          name?: string
          scopes?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      assistant_embed_token_audit: {
        Row: {
          client_id: string
          created_at: string
          id: string
          ip: string | null
          origin: string | null
          status: string
          user_agent: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          ip?: string | null
          origin?: string | null
          status?: string
          user_agent?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          ip?: string | null
          origin?: string | null
          status?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      attendance_events: {
        Row: {
          created_at: string
          description: string | null
          duration_minutes: number
          event_date: string
          event_proof_score: number | null
          event_type: string
          host_user_id: string
          id: string
          livestream_link: string | null
          meeting_id: string | null
          metadata: Json | null
          status: string
          title: string
          updated_at: string
          zoom_link: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_minutes?: number
          event_date: string
          event_proof_score?: number | null
          event_type?: string
          host_user_id: string
          id?: string
          livestream_link?: string | null
          meeting_id?: string | null
          metadata?: Json | null
          status?: string
          title: string
          updated_at?: string
          zoom_link?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_minutes?: number
          event_date?: string
          event_proof_score?: number | null
          event_type?: string
          host_user_id?: string
          id?: string
          livestream_link?: string | null
          meeting_id?: string | null
          metadata?: Json | null
          status?: string
          title?: string
          updated_at?: string
          zoom_link?: string | null
        }
        Relationships: []
      }
      attestation_abuse_flags: {
        Row: {
          created_at: string
          details: Json
          did_id: string
          flag_type: string
          id: string
          is_resolved: boolean
          related_attestation_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: number
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: Json
          did_id: string
          flag_type: string
          id?: string
          is_resolved?: boolean
          related_attestation_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: number
          user_id: string
        }
        Update: {
          created_at?: string
          details?: Json
          did_id?: string
          flag_type?: string
          id?: string
          is_resolved?: boolean
          related_attestation_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attestation_abuse_flags_did_id_fkey"
            columns: ["did_id"]
            isOneToOne: false
            referencedRelation: "user_dids"
            referencedColumns: ["id"]
          },
        ]
      }
      attestation_log: {
        Row: {
          attestation_type: string
          created_at: string
          evidence: Json
          expires_at: string | null
          from_did: string | null
          from_system: string | null
          id: string
          status: string
          to_did: string
          weight: number
        }
        Insert: {
          attestation_type: string
          created_at?: string
          evidence?: Json
          expires_at?: string | null
          from_did?: string | null
          from_system?: string | null
          id?: string
          status?: string
          to_did: string
          weight?: number
        }
        Update: {
          attestation_type?: string
          created_at?: string
          evidence?: Json
          expires_at?: string | null
          from_did?: string | null
          from_system?: string | null
          id?: string
          status?: string
          to_did?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "attestation_log_from_did_fkey"
            columns: ["from_did"]
            isOneToOne: false
            referencedRelation: "user_dids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attestation_log_to_did_fkey"
            columns: ["to_did"]
            isOneToOne: false
            referencedRelation: "user_dids"
            referencedColumns: ["id"]
          },
        ]
      }
      bounty_submissions: {
        Row: {
          admin_feedback: string | null
          created_at: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          reward_earned: number | null
          status: string
          submission_content: string
          submission_url: string | null
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_feedback?: string | null
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reward_earned?: number | null
          status?: string
          submission_content: string
          submission_url?: string | null
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_feedback?: string | null
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reward_earned?: number | null
          status?: string
          submission_content?: string
          submission_url?: string | null
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bounty_submissions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "bounty_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      bounty_tasks: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          current_completions: number
          deadline: string | null
          description: string
          difficulty_level: string
          id: string
          max_completions: number | null
          requirements: string | null
          reward_amount: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          current_completions?: number
          deadline?: string | null
          description: string
          difficulty_level?: string
          id?: string
          max_completions?: number | null
          requirements?: string | null
          reward_amount?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          current_completions?: number
          deadline?: string | null
          description?: string
          difficulty_level?: string
          id?: string
          max_completions?: number | null
          requirements?: string | null
          reward_amount?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      box_function_error_log: {
        Row: {
          context: Json | null
          created_at: string
          function_name: string
          id: string
          message: string
          severity: string
          sqlstate: string | null
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string
          function_name: string
          id?: string
          message: string
          severity?: string
          sqlstate?: string | null
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string
          function_name?: string
          id?: string
          message?: string
          severity?: string
          sqlstate?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      box_tickets: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          reveal_hash: string | null
          revealed_at: string | null
          reward_camly: number | null
          reward_nft_id: string | null
          server_seed: string
          source: string
          source_ref: string | null
          status: string
          tier_code: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          reveal_hash?: string | null
          revealed_at?: string | null
          reward_camly?: number | null
          reward_nft_id?: string | null
          server_seed: string
          source: string
          source_ref?: string | null
          status?: string
          tier_code: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          reveal_hash?: string | null
          revealed_at?: string | null
          reward_camly?: number | null
          reward_nft_id?: string | null
          server_seed?: string
          source?: string
          source_ref?: string | null
          status?: string
          tier_code?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "box_tickets_tier_code_fkey"
            columns: ["tier_code"]
            isOneToOne: false
            referencedRelation: "box_tiers"
            referencedColumns: ["code"]
          },
        ]
      }
      box_tiers: {
        Row: {
          active: boolean | null
          code: string
          color_hex: string | null
          created_at: string
          display_name: string
          drop_rate: number
          id: string
          max_camly: number
          min_camly: number
          nft_chance: number
          sort_order: number | null
        }
        Insert: {
          active?: boolean | null
          code: string
          color_hex?: string | null
          created_at?: string
          display_name: string
          drop_rate: number
          id?: string
          max_camly?: number
          min_camly?: number
          nft_chance?: number
          sort_order?: number | null
        }
        Update: {
          active?: boolean | null
          code?: string
          color_hex?: string | null
          created_at?: string
          display_name?: string
          drop_rate?: number
          id?: string
          max_camly?: number
          min_camly?: number
          nft_chance?: number
          sort_order?: number | null
        }
        Relationships: []
      }
      bridge_login_audit: {
        Row: {
          angel_user_id: string | null
          created_at: string
          email: string | null
          failure_reason: string | null
          fun_user_id: string | null
          id: string
          ip_address: string | null
          success: boolean
          token_hash: string | null
          user_agent: string | null
        }
        Insert: {
          angel_user_id?: string | null
          created_at?: string
          email?: string | null
          failure_reason?: string | null
          fun_user_id?: string | null
          id?: string
          ip_address?: string | null
          success?: boolean
          token_hash?: string | null
          user_agent?: string | null
        }
        Update: {
          angel_user_id?: string | null
          created_at?: string
          email?: string | null
          failure_reason?: string | null
          fun_user_id?: string | null
          id?: string
          ip_address?: string | null
          success?: boolean
          token_hash?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      build_ideas: {
        Row: {
          admin_feedback: string | null
          category: string | null
          created_at: string
          description: string
          id: string
          is_rewarded: boolean | null
          reviewed_at: string | null
          reviewed_by: string | null
          reward_amount: number | null
          status: string
          title: string
          updated_at: string
          user_id: string
          votes_count: number
        }
        Insert: {
          admin_feedback?: string | null
          category?: string | null
          created_at?: string
          description: string
          id?: string
          is_rewarded?: boolean | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reward_amount?: number | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
          votes_count?: number
        }
        Update: {
          admin_feedback?: string | null
          category?: string | null
          created_at?: string
          description?: string
          id?: string
          is_rewarded?: boolean | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reward_amount?: number | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          votes_count?: number
        }
        Relationships: []
      }
      cached_responses: {
        Row: {
          created_at: string | null
          hit_count: number | null
          id: string
          last_used_at: string | null
          question_keywords: string[]
          question_normalized: string
          response: string
        }
        Insert: {
          created_at?: string | null
          hit_count?: number | null
          id?: string
          last_used_at?: string | null
          question_keywords: string[]
          question_normalized: string
          response: string
        }
        Update: {
          created_at?: string | null
          hit_count?: number | null
          id?: string
          last_used_at?: string | null
          question_keywords?: string[]
          question_normalized?: string
          response?: string
        }
        Relationships: []
      }
      camly_coin_balances: {
        Row: {
          balance: number
          created_at: string
          id: string
          lifetime_earned: number
          lifetime_spent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          lifetime_earned?: number
          lifetime_spent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          lifetime_earned?: number
          lifetime_spent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      camly_coin_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          purity_score: number | null
          source_ref: string | null
          transaction_type: Database["public"]["Enums"]["coin_transaction_type"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          purity_score?: number | null
          source_ref?: string | null
          transaction_type: Database["public"]["Enums"]["coin_transaction_type"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          purity_score?: number | null
          source_ref?: string | null
          transaction_type?: Database["public"]["Enums"]["coin_transaction_type"]
          user_id?: string
        }
        Relationships: []
      }
      chat_feedback: {
        Row: {
          admin_note: string | null
          answer_text: string
          created_at: string
          feedback_reason: string | null
          feedback_type: string
          id: string
          linked_document_id: string | null
          question_text: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          answer_text: string
          created_at?: string
          feedback_reason?: string | null
          feedback_type: string
          id?: string
          linked_document_id?: string | null
          question_text: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          answer_text?: string
          created_at?: string
          feedback_reason?: string | null
          feedback_type?: string
          id?: string
          linked_document_id?: string | null
          question_text?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_feedback_linked_document_id_fkey"
            columns: ["linked_document_id"]
            isOneToOne: false
            referencedRelation: "knowledge_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_folders: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_history: {
        Row: {
          answer_text: string
          created_at: string
          folder_id: string | null
          id: string
          is_rewarded: boolean | null
          purity_score: number | null
          question_id: string | null
          question_text: string
          reward_amount: number | null
          session_id: string | null
          user_id: string
        }
        Insert: {
          answer_text: string
          created_at?: string
          folder_id?: string | null
          id?: string
          is_rewarded?: boolean | null
          purity_score?: number | null
          question_id?: string | null
          question_text: string
          reward_amount?: number | null
          session_id?: string | null
          user_id: string
        }
        Update: {
          answer_text?: string
          created_at?: string
          folder_id?: string | null
          id?: string
          is_rewarded?: boolean | null
          purity_score?: number | null
          question_id?: string | null
          question_text?: string
          reward_amount?: number | null
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_history_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "chat_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_history_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "chat_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_history_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_questions: {
        Row: {
          ai_response_preview: string | null
          created_at: string
          id: string
          is_greeting: boolean | null
          is_response_recycled: boolean | null
          is_rewarded: boolean | null
          is_spam: boolean | null
          likes_count: number | null
          purity_score: number | null
          question_hash: string
          question_text: string
          recycling_similarity_score: number | null
          replies_count: number | null
          reward_amount: number | null
          user_id: string
        }
        Insert: {
          ai_response_preview?: string | null
          created_at?: string
          id?: string
          is_greeting?: boolean | null
          is_response_recycled?: boolean | null
          is_rewarded?: boolean | null
          is_spam?: boolean | null
          likes_count?: number | null
          purity_score?: number | null
          question_hash: string
          question_text: string
          recycling_similarity_score?: number | null
          replies_count?: number | null
          reward_amount?: number | null
          user_id: string
        }
        Update: {
          ai_response_preview?: string | null
          created_at?: string
          id?: string
          is_greeting?: boolean | null
          is_response_recycled?: boolean | null
          is_rewarded?: boolean | null
          is_spam?: boolean | null
          likes_count?: number | null
          purity_score?: number | null
          question_hash?: string
          question_text?: string
          recycling_similarity_score?: number | null
          replies_count?: number | null
          reward_amount?: number | null
          user_id?: string
        }
        Relationships: []
      }
      chat_sessions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          last_message_at: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_message_at?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_message_at?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      circle_members: {
        Row: {
          circle_id: string
          id: string
          invited_by: string | null
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          circle_id: string
          id?: string
          invited_by?: string | null
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          circle_id?: string
          id?: string
          invited_by?: string | null
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_members_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "community_circles"
            referencedColumns: ["id"]
          },
        ]
      }
      cloud_usage_snapshots: {
        Row: {
          avg_ms: number | null
          bucket_start: string
          created_at: string
          error_count: number
          estimated_cost_usd: number
          function_name: string
          granularity: string
          id: string
          invocations: number
          total_ms: number
        }
        Insert: {
          avg_ms?: number | null
          bucket_start: string
          created_at?: string
          error_count?: number
          estimated_cost_usd?: number
          function_name: string
          granularity?: string
          id?: string
          invocations?: number
          total_ms?: number
        }
        Update: {
          avg_ms?: number | null
          bucket_start?: string
          created_at?: string
          error_count?: number
          estimated_cost_usd?: number
          function_name?: string
          granularity?: string
          id?: string
          invocations?: number
          total_ms?: number
        }
        Relationships: []
      }
      coin_gifts: {
        Row: {
          amount: number
          context_id: string | null
          context_type: string
          created_at: string
          gift_type: string
          id: string
          message: string | null
          receipt_public_id: string | null
          receiver_id: string
          sender_id: string
          tx_hash: string | null
        }
        Insert: {
          amount: number
          context_id?: string | null
          context_type?: string
          created_at?: string
          gift_type?: string
          id?: string
          message?: string | null
          receipt_public_id?: string | null
          receiver_id: string
          sender_id: string
          tx_hash?: string | null
        }
        Update: {
          amount?: number
          context_id?: string | null
          context_type?: string
          created_at?: string
          gift_type?: string
          id?: string
          message?: string | null
          receipt_public_id?: string | null
          receiver_id?: string
          sender_id?: string
          tx_hash?: string | null
        }
        Relationships: []
      }
      coin_withdrawals: {
        Row: {
          admin_notes: string | null
          amount: number
          celebrated_at: string | null
          created_at: string
          error_message: string | null
          id: string
          processed_at: string | null
          processed_by: string | null
          retry_count: number | null
          status: string
          tx_hash: string | null
          updated_at: string
          user_id: string
          wallet_address: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          celebrated_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          retry_count?: number | null
          status?: string
          tx_hash?: string | null
          updated_at?: string
          user_id: string
          wallet_address: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          celebrated_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          retry_count?: number | null
          status?: string
          tx_hash?: string | null
          updated_at?: string
          user_id?: string
          wallet_address?: string
        }
        Relationships: []
      }
      community_circles: {
        Row: {
          circle_type: string
          color: string | null
          created_at: string
          created_by: string
          description: string | null
          icon: string | null
          id: string
          is_official: boolean | null
          max_members: number | null
          name: string
          updated_at: string
        }
        Insert: {
          circle_type?: string
          color?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          icon?: string | null
          id?: string
          is_official?: boolean | null
          max_members?: number | null
          name: string
          updated_at?: string
        }
        Update: {
          circle_type?: string
          color?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_official?: boolean | null
          max_members?: number | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      community_comments: {
        Row: {
          content: string
          content_length: number
          created_at: string
          id: string
          is_rewarded: boolean | null
          post_id: string
          reward_amount: number | null
          user_id: string
        }
        Insert: {
          content: string
          content_length: number
          created_at?: string
          id?: string
          is_rewarded?: boolean | null
          post_id: string
          reward_amount?: number | null
          user_id: string
        }
        Update: {
          content?: string
          content_length?: number
          created_at?: string
          id?: string
          is_rewarded?: boolean | null
          post_id?: string
          reward_amount?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_helps: {
        Row: {
          coins_earned: number | null
          created_at: string
          help_content: string | null
          help_type: string
          helped_user_id: string
          helper_id: string
          id: string
          is_rewarded: boolean | null
          is_verified: boolean | null
          question_id: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          coins_earned?: number | null
          created_at?: string
          help_content?: string | null
          help_type: string
          helped_user_id: string
          helper_id: string
          id?: string
          is_rewarded?: boolean | null
          is_verified?: boolean | null
          question_id?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          coins_earned?: number | null
          created_at?: string
          help_content?: string | null
          help_type?: string
          helped_user_id?: string
          helper_id?: string
          id?: string
          is_rewarded?: boolean | null
          is_verified?: boolean | null
          question_id?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_helps_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "chat_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      community_post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          comments_count: number | null
          content: string
          created_at: string
          expires_at: string | null
          id: string
          image_url: string | null
          image_urls: string[] | null
          is_rewarded: boolean | null
          likes_count: number | null
          metadata: Json | null
          post_type: string
          reward_amount: number | null
          shares_count: number | null
          slug: string
          updated_at: string
          user_id: string
          video_url: string | null
        }
        Insert: {
          comments_count?: number | null
          content: string
          created_at?: string
          expires_at?: string | null
          id?: string
          image_url?: string | null
          image_urls?: string[] | null
          is_rewarded?: boolean | null
          likes_count?: number | null
          metadata?: Json | null
          post_type?: string
          reward_amount?: number | null
          shares_count?: number | null
          slug: string
          updated_at?: string
          user_id: string
          video_url?: string | null
        }
        Update: {
          comments_count?: number | null
          content?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          image_url?: string | null
          image_urls?: string[] | null
          is_rewarded?: boolean | null
          likes_count?: number | null
          metadata?: Json | null
          post_type?: string
          reward_amount?: number | null
          shares_count?: number | null
          slug?: string
          updated_at?: string
          user_id?: string
          video_url?: string | null
        }
        Relationships: []
      }
      community_shares: {
        Row: {
          created_at: string
          id: string
          post_id: string
          post_owner_rewarded: boolean | null
          sharer_id: string
          sharer_rewarded: boolean | null
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          post_owner_rewarded?: boolean | null
          sharer_id: string
          sharer_rewarded?: boolean | null
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          post_owner_rewarded?: boolean | null
          sharer_id?: string
          sharer_rewarded?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "community_shares_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_stories: {
        Row: {
          caption: string | null
          created_at: string
          expires_at: string
          id: string
          media_type: string
          media_url: string
          user_id: string
          views_count: number | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_type?: string
          media_url: string
          user_id: string
          views_count?: number | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_type?: string
          media_url?: string
          user_id?: string
          views_count?: number | null
        }
        Relationships: []
      }
      community_story_views: {
        Row: {
          id: string
          story_id: string
          viewed_at: string
          viewer_id: string
        }
        Insert: {
          id?: string
          story_id: string
          viewed_at?: string
          viewer_id: string
        }
        Update: {
          id?: string
          story_id?: string
          viewed_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "community_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      connector_disputes: {
        Row: {
          connector_id: string
          created_at: string
          evidence: Json
          id: string
          raised_by: string
          reason: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          connector_id: string
          created_at?: string
          evidence?: Json
          id?: string
          raised_by: string
          reason: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          connector_id?: string
          created_at?: string
          evidence?: Json
          id?: string
          raised_by?: string
          reason?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "connector_disputes_connector_id_fkey"
            columns: ["connector_id"]
            isOneToOne: false
            referencedRelation: "connectors"
            referencedColumns: ["id"]
          },
        ]
      }
      connector_events: {
        Row: {
          candidate_wallet: string | null
          created_at: string
          id: string
          newcomer_user_id: string
          payload: Json
          reason: string
          tx_hash: string | null
        }
        Insert: {
          candidate_wallet?: string | null
          created_at?: string
          id?: string
          newcomer_user_id: string
          payload?: Json
          reason: string
          tx_hash?: string | null
        }
        Update: {
          candidate_wallet?: string | null
          created_at?: string
          id?: string
          newcomer_user_id?: string
          payload?: Json
          reason?: string
          tx_hash?: string | null
        }
        Relationships: []
      }
      connector_rewards_log: {
        Row: {
          applied_at: string
          connector_id: string
          connector_user_id: string
          id: string
          newcomer_user_id: string
          pillar: string
          pplp_action_id: string | null
          reverted: boolean
          reverted_at: string | null
          reverted_reason: string | null
          sbt_queued: boolean
          sbt_token_id: string | null
          score_added: number
        }
        Insert: {
          applied_at?: string
          connector_id: string
          connector_user_id: string
          id?: string
          newcomer_user_id: string
          pillar?: string
          pplp_action_id?: string | null
          reverted?: boolean
          reverted_at?: string | null
          reverted_reason?: string | null
          sbt_queued?: boolean
          sbt_token_id?: string | null
          score_added?: number
        }
        Update: {
          applied_at?: string
          connector_id?: string
          connector_user_id?: string
          id?: string
          newcomer_user_id?: string
          pillar?: string
          pplp_action_id?: string | null
          reverted?: boolean
          reverted_at?: string | null
          reverted_reason?: string | null
          sbt_queued?: boolean
          sbt_token_id?: string | null
          score_added?: number
        }
        Relationships: [
          {
            foreignKeyName: "connector_rewards_log_connector_id_fkey"
            columns: ["connector_id"]
            isOneToOne: false
            referencedRelation: "connectors"
            referencedColumns: ["id"]
          },
        ]
      }
      connector_token_whitelist: {
        Row: {
          active: boolean
          chain_id: number
          created_at: string
          decimals: number
          id: string
          min_value_raw: number
          notes: string | null
          symbol: string
          token_address: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          chain_id?: number
          created_at?: string
          decimals?: number
          id?: string
          min_value_raw?: number
          notes?: string | null
          symbol: string
          token_address: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          chain_id?: number
          created_at?: string
          decimals?: number
          id?: string
          min_value_raw?: number
          notes?: string | null
          symbol?: string
          token_address?: string
          updated_at?: string
        }
        Relationships: []
      }
      connectors: {
        Row: {
          block_number: number
          chain_id: number
          confirmed_at: string | null
          connector_user_id: string | null
          connector_wallet: string
          created_at: string
          detected_at: string
          evidence_hash: string | null
          id: string
          newcomer_did: string | null
          newcomer_user_id: string
          revoke_reason: string | null
          status: string
          token_amount: number
          token_symbol: string
          tx_hash: string
          tx_index: number
          updated_at: string
        }
        Insert: {
          block_number: number
          chain_id?: number
          confirmed_at?: string | null
          connector_user_id?: string | null
          connector_wallet: string
          created_at?: string
          detected_at?: string
          evidence_hash?: string | null
          id?: string
          newcomer_did?: string | null
          newcomer_user_id: string
          revoke_reason?: string | null
          status?: string
          token_amount: number
          token_symbol: string
          tx_hash: string
          tx_index?: number
          updated_at?: string
        }
        Update: {
          block_number?: number
          chain_id?: number
          confirmed_at?: string | null
          connector_user_id?: string | null
          connector_wallet?: string
          created_at?: string
          detected_at?: string
          evidence_hash?: string | null
          id?: string
          newcomer_did?: string | null
          newcomer_user_id?: string
          revoke_reason?: string | null
          status?: string
          token_amount?: number
          token_symbol?: string
          tx_hash?: string
          tx_index?: number
          updated_at?: string
        }
        Relationships: []
      }
      content_shares: {
        Row: {
          coins_earned: number | null
          content_id: string | null
          content_type: string
          created_at: string
          id: string
          is_verified: boolean | null
          share_type: string
          share_url: string | null
          user_id: string
          verified_at: string | null
        }
        Insert: {
          coins_earned?: number | null
          content_id?: string | null
          content_type: string
          created_at?: string
          id?: string
          is_verified?: boolean | null
          share_type: string
          share_url?: string | null
          user_id: string
          verified_at?: string | null
        }
        Update: {
          coins_earned?: number | null
          content_id?: string | null
          content_type?: string
          created_at?: string
          id?: string
          is_verified?: boolean | null
          share_type?: string
          share_url?: string | null
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      coordinator_chat_messages: {
        Row: {
          ai_role: string | null
          content: string
          created_at: string
          id: string
          mode: string | null
          project_id: string
          role: string
          user_id: string
        }
        Insert: {
          ai_role?: string | null
          content: string
          created_at?: string
          id?: string
          mode?: string | null
          project_id: string
          role?: string
          user_id: string
        }
        Update: {
          ai_role?: string | null
          content?: string
          created_at?: string
          id?: string
          mode?: string | null
          project_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coordinator_chat_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "coordinator_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      coordinator_project_versions: {
        Row: {
          change_summary: string | null
          created_at: string
          id: string
          project_id: string
          snapshot_data: Json | null
          version_number: number
        }
        Insert: {
          change_summary?: string | null
          created_at?: string
          id?: string
          project_id: string
          snapshot_data?: Json | null
          version_number?: number
        }
        Update: {
          change_summary?: string | null
          created_at?: string
          id?: string
          project_id?: string
          snapshot_data?: Json | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "coordinator_project_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "coordinator_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      coordinator_projects: {
        Row: {
          created_at: string
          id: string
          metadata: Json | null
          name: string
          platform_type: string
          status: string
          token_flow_model: string | null
          updated_at: string
          user_id: string
          value_model: string | null
          vision_statement: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          name: string
          platform_type?: string
          status?: string
          token_flow_model?: string | null
          updated_at?: string
          user_id: string
          value_model?: string | null
          vision_statement?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          name?: string
          platform_type?: string
          status?: string
          token_flow_model?: string | null
          updated_at?: string
          user_id?: string
          value_model?: string | null
          vision_statement?: string | null
        }
        Relationships: []
      }
      cosmic_riddle_attempts: {
        Row: {
          ai_reason: string | null
          ai_score: number
          answer: string
          created_at: string
          id: string
          reward_camly: number
          reward_sparks: number
          reward_xp: number
          riddle_id: string
          user_id: string
        }
        Insert: {
          ai_reason?: string | null
          ai_score?: number
          answer: string
          created_at?: string
          id?: string
          reward_camly?: number
          reward_sparks?: number
          reward_xp?: number
          riddle_id: string
          user_id: string
        }
        Update: {
          ai_reason?: string | null
          ai_score?: number
          answer?: string
          created_at?: string
          id?: string
          reward_camly?: number
          reward_sparks?: number
          reward_xp?: number
          riddle_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cosmic_riddle_attempts_riddle_id_fkey"
            columns: ["riddle_id"]
            isOneToOne: false
            referencedRelation: "cosmic_riddles"
            referencedColumns: ["id"]
          },
        ]
      }
      cosmic_riddles: {
        Row: {
          created_at: string
          expected_keywords: string[] | null
          hint: string | null
          id: string
          idx: number
          meaning: string | null
          prompt: string
          published: boolean
          riddle_date: string
          theme: string
        }
        Insert: {
          created_at?: string
          expected_keywords?: string[] | null
          hint?: string | null
          id?: string
          idx: number
          meaning?: string | null
          prompt: string
          published?: boolean
          riddle_date: string
          theme: string
        }
        Update: {
          created_at?: string
          expected_keywords?: string[] | null
          hint?: string | null
          id?: string
          idx?: number
          meaning?: string | null
          prompt?: string
          published?: boolean
          riddle_date?: string
          theme?: string
        }
        Relationships: []
      }
      daily_camly_cap_ledger: {
        Row: {
          cap_date: string
          clipped_total: number
          earned_total: number
          hit_cap_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cap_date: string
          clipped_total?: number
          earned_total?: number
          hit_cap_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cap_date?: string
          clipped_total?: number
          earned_total?: number
          hit_cap_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_gratitude: {
        Row: {
          created_at: string
          gratitude_text: string
          id: string
          light_points_earned: number | null
          sentiment_score: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          gratitude_text: string
          id?: string
          light_points_earned?: number | null
          sentiment_score?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          gratitude_text?: string
          id?: string
          light_points_earned?: number | null
          sentiment_score?: number | null
          user_id?: string
        }
        Relationships: []
      }
      daily_login_tracking: {
        Row: {
          coins_earned: number
          created_at: string
          id: string
          login_date: string
          streak_count: number
          user_id: string
        }
        Insert: {
          coins_earned?: number
          created_at?: string
          id?: string
          login_date?: string
          streak_count?: number
          user_id: string
        }
        Update: {
          coins_earned?: number
          created_at?: string
          id?: string
          login_date?: string
          streak_count?: number
          user_id?: string
        }
        Relationships: []
      }
      daily_reward_tracking: {
        Row: {
          comments_rewarded: number | null
          community_helps_rewarded: number
          created_at: string
          feedbacks_rewarded: number
          id: string
          ideas_submitted: number
          journals_rewarded: number
          knowledge_uploads: number
          logins_rewarded: number
          posts_rewarded: number | null
          question_hashes: string[] | null
          questions_rewarded: number
          reward_date: string
          shares_rewarded: number
          total_coins_today: number
          updated_at: string
          user_id: string
        }
        Insert: {
          comments_rewarded?: number | null
          community_helps_rewarded?: number
          created_at?: string
          feedbacks_rewarded?: number
          id?: string
          ideas_submitted?: number
          journals_rewarded?: number
          knowledge_uploads?: number
          logins_rewarded?: number
          posts_rewarded?: number | null
          question_hashes?: string[] | null
          questions_rewarded?: number
          reward_date?: string
          shares_rewarded?: number
          total_coins_today?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          comments_rewarded?: number | null
          community_helps_rewarded?: number
          created_at?: string
          feedbacks_rewarded?: number
          id?: string
          ideas_submitted?: number
          journals_rewarded?: number
          knowledge_uploads?: number
          logins_rewarded?: number
          posts_rewarded?: number | null
          question_hashes?: string[] | null
          questions_rewarded?: number
          reward_date?: string
          shares_rewarded?: number
          total_coins_today?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dib_profile: {
        Row: {
          contribution_vault_hash: string | null
          created_at: string
          credential_vault_hash: string | null
          did_id: string
          economic_access_hash: string | null
          governance_vault_hash: string | null
          id: string
          identity_vault_hash: string | null
          last_snapshot_at: string | null
          reputation_vault_hash: string | null
          snapshot_root_hash: string | null
          trust_vault_hash: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          contribution_vault_hash?: string | null
          created_at?: string
          credential_vault_hash?: string | null
          did_id: string
          economic_access_hash?: string | null
          governance_vault_hash?: string | null
          id?: string
          identity_vault_hash?: string | null
          last_snapshot_at?: string | null
          reputation_vault_hash?: string | null
          snapshot_root_hash?: string | null
          trust_vault_hash?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          contribution_vault_hash?: string | null
          created_at?: string
          credential_vault_hash?: string | null
          did_id?: string
          economic_access_hash?: string | null
          governance_vault_hash?: string | null
          id?: string
          identity_vault_hash?: string | null
          last_snapshot_at?: string | null
          reputation_vault_hash?: string | null
          snapshot_root_hash?: string | null
          trust_vault_hash?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dib_profile_did_id_fkey"
            columns: ["did_id"]
            isOneToOne: true
            referencedRelation: "user_dids"
            referencedColumns: ["id"]
          },
        ]
      }
      did_events: {
        Row: {
          created_at: string
          did_id: string
          event_data: Json | null
          event_type: string
          id: string
          on_chain_hash: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          did_id: string
          event_data?: Json | null
          event_type: string
          id?: string
          on_chain_hash?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          did_id?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          on_chain_hash?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "did_events_did_id_fkey"
            columns: ["did_id"]
            isOneToOne: false
            referencedRelation: "user_dids"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_messages: {
        Row: {
          content: string
          created_at: string
          deleted_at: string | null
          id: string
          image_url: string | null
          is_deleted: boolean | null
          is_read: boolean
          message_type: string | null
          metadata: Json | null
          reactions: Json | null
          read_at: string | null
          receiver_id: string
          reply_to_id: string | null
          sender_id: string
          tip_gift_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          image_url?: string | null
          is_deleted?: boolean | null
          is_read?: boolean
          message_type?: string | null
          metadata?: Json | null
          reactions?: Json | null
          read_at?: string | null
          receiver_id: string
          reply_to_id?: string | null
          sender_id: string
          tip_gift_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          image_url?: string | null
          is_deleted?: boolean | null
          is_read?: boolean
          message_type?: string | null
          metadata?: Json | null
          reactions?: Json | null
          read_at?: string | null
          receiver_id?: string
          reply_to_id?: string | null
          sender_id?: string
          tip_gift_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "direct_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_tip_gift_id_fkey"
            columns: ["tip_gift_id"]
            isOneToOne: false
            referencedRelation: "coin_gifts"
            referencedColumns: ["id"]
          },
        ]
      }
      early_adopter_rewards: {
        Row: {
          created_at: string
          id: string
          is_rewarded: boolean
          registered_at: string
          reward_amount: number
          rewarded_at: string | null
          updated_at: string
          user_id: string
          valid_questions_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_rewarded?: boolean
          registered_at?: string
          reward_amount?: number
          rewarded_at?: string | null
          updated_at?: string
          user_id: string
          valid_questions_count?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_rewarded?: boolean
          registered_at?: string
          reward_amount?: number
          rewarded_at?: string | null
          updated_at?: string
          user_id?: string
          valid_questions_count?: number
        }
        Relationships: []
      }
      edge_function_feature_map: {
        Row: {
          category: string
          cost_weight: number
          created_at: string
          feature: string
          function_name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          category?: string
          cost_weight?: number
          created_at?: string
          feature?: string
          function_name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          cost_weight?: number
          created_at?: string
          feature?: string
          function_name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      epoch_config: {
        Row: {
          config_key: string
          config_value: Json
          created_at: string | null
          description: string | null
          id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          config_key: string
          config_value: Json
          created_at?: string | null
          description?: string | null
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          config_key?: string
          config_value?: Json
          created_at?: string | null
          description?: string | null
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      epoch_metrics: {
        Row: {
          created_at: string | null
          epoch_id: string
          id: string
          metric_data: Json
          metric_type: string
        }
        Insert: {
          created_at?: string | null
          epoch_id: string
          id?: string
          metric_data: Json
          metric_type: string
        }
        Update: {
          created_at?: string | null
          epoch_id?: string
          id?: string
          metric_data?: Json
          metric_type?: string
        }
        Relationships: []
      }
      epoch_snapshots: {
        Row: {
          burst_penalty: number | null
          created_at: string | null
          cross_window_bonus: number | null
          deduped_activity_count: number | null
          epoch_id: string
          epoch_type: string
          finalized_score: number | null
          fraud_factor: number | null
          id: string
          instant_amount: number | null
          late_window_suppression: number | null
          locked_amount: number | null
          preview_score: number | null
          raw_activity_count: number | null
          reward_allocation: number | null
          timing_adjusted_score: number | null
          trust_factor: number | null
          updated_at: string | null
          user_id: string
          validated_score: number | null
          window_end: string
          window_start: string
        }
        Insert: {
          burst_penalty?: number | null
          created_at?: string | null
          cross_window_bonus?: number | null
          deduped_activity_count?: number | null
          epoch_id: string
          epoch_type?: string
          finalized_score?: number | null
          fraud_factor?: number | null
          id?: string
          instant_amount?: number | null
          late_window_suppression?: number | null
          locked_amount?: number | null
          preview_score?: number | null
          raw_activity_count?: number | null
          reward_allocation?: number | null
          timing_adjusted_score?: number | null
          trust_factor?: number | null
          updated_at?: string | null
          user_id: string
          validated_score?: number | null
          window_end: string
          window_start: string
        }
        Update: {
          burst_penalty?: number | null
          created_at?: string | null
          cross_window_bonus?: number | null
          deduped_activity_count?: number | null
          epoch_id?: string
          epoch_type?: string
          finalized_score?: number | null
          fraud_factor?: number | null
          id?: string
          instant_amount?: number | null
          late_window_suppression?: number | null
          locked_amount?: number | null
          preview_score?: number | null
          raw_activity_count?: number | null
          reward_allocation?: number | null
          timing_adjusted_score?: number | null
          trust_factor?: number | null
          updated_at?: string | null
          user_id?: string
          validated_score?: number | null
          window_end?: string
          window_start?: string
        }
        Relationships: []
      }
      features_user_day: {
        Row: {
          actions_last_48h: number | null
          anti_farm_risk: number | null
          avg_rating_weighted: number | null
          base_action_score: number | null
          burst_penalty: number | null
          consistency_multiplier: number | null
          consistency_streak: number | null
          content_score: number | null
          count_comments: number | null
          count_help: number | null
          count_journals: number | null
          count_logins: number | null
          count_posts: number | null
          count_questions: number | null
          count_reports_valid: number | null
          cross_window_bonus: number | null
          daily_light_score: number | null
          date: string
          integrity_penalty: number | null
          late_window_weight: number | null
          onchain_value_score: number | null
          reputation_weight: number | null
          sequence_count: number | null
          sequence_multiplier: number | null
          timing_adjusted_score: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          actions_last_48h?: number | null
          anti_farm_risk?: number | null
          avg_rating_weighted?: number | null
          base_action_score?: number | null
          burst_penalty?: number | null
          consistency_multiplier?: number | null
          consistency_streak?: number | null
          content_score?: number | null
          count_comments?: number | null
          count_help?: number | null
          count_journals?: number | null
          count_logins?: number | null
          count_posts?: number | null
          count_questions?: number | null
          count_reports_valid?: number | null
          cross_window_bonus?: number | null
          daily_light_score?: number | null
          date: string
          integrity_penalty?: number | null
          late_window_weight?: number | null
          onchain_value_score?: number | null
          reputation_weight?: number | null
          sequence_count?: number | null
          sequence_multiplier?: number | null
          timing_adjusted_score?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          actions_last_48h?: number | null
          anti_farm_risk?: number | null
          avg_rating_weighted?: number | null
          base_action_score?: number | null
          burst_penalty?: number | null
          consistency_multiplier?: number | null
          consistency_streak?: number | null
          content_score?: number | null
          count_comments?: number | null
          count_help?: number | null
          count_journals?: number | null
          count_logins?: number | null
          count_posts?: number | null
          count_questions?: number | null
          count_reports_valid?: number | null
          cross_window_bonus?: number | null
          daily_light_score?: number | null
          date?: string
          integrity_penalty?: number | null
          late_window_weight?: number | null
          onchain_value_score?: number | null
          reputation_weight?: number | null
          sequence_count?: number | null
          sequence_multiplier?: number | null
          timing_adjusted_score?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      fraud_alerts: {
        Row: {
          action_taken: string | null
          alert_type: string
          created_at: string | null
          details: Json | null
          id: string
          is_reviewed: boolean | null
          matched_pattern: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string
          user_id: string
        }
        Insert: {
          action_taken?: string | null
          alert_type: string
          created_at?: string | null
          details?: Json | null
          id?: string
          is_reviewed?: boolean | null
          matched_pattern?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          user_id: string
        }
        Update: {
          action_taken?: string | null
          alert_type?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          is_reviewed?: boolean | null
          matched_pattern?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          user_id?: string
        }
        Relationships: []
      }
      fraud_whitelist: {
        Row: {
          created_at: string
          id: string
          reason: string
          user_id: string
          whitelisted_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          reason?: string
          user_id: string
          whitelisted_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          user_id?: string
          whitelisted_by?: string | null
        }
        Relationships: []
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: string
          updated_at: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      fun_distribution_logs: {
        Row: {
          action_id: string
          actor_id: string
          created_at: string
          fund_processed_at: string | null
          fund_processing_status: string
          fund_tx_hashes: Json | null
          genesis_amount: number
          genesis_percentage: number
          id: string
          mint_request_id: string | null
          partners_amount: number
          partners_percentage: number
          platform_amount: number
          platform_percentage: number
          total_reward: number
          user_amount: number
          user_percentage: number
        }
        Insert: {
          action_id: string
          actor_id: string
          created_at?: string
          fund_processed_at?: string | null
          fund_processing_status?: string
          fund_tx_hashes?: Json | null
          genesis_amount?: number
          genesis_percentage?: number
          id?: string
          mint_request_id?: string | null
          partners_amount?: number
          partners_percentage?: number
          platform_amount?: number
          platform_percentage?: number
          total_reward: number
          user_amount: number
          user_percentage: number
        }
        Update: {
          action_id?: string
          actor_id?: string
          created_at?: string
          fund_processed_at?: string | null
          fund_processing_status?: string
          fund_tx_hashes?: Json | null
          genesis_amount?: number
          genesis_percentage?: number
          id?: string
          mint_request_id?: string | null
          partners_amount?: number
          partners_percentage?: number
          platform_amount?: number
          platform_percentage?: number
          total_reward?: number
          user_amount?: number
          user_percentage?: number
        }
        Relationships: [
          {
            foreignKeyName: "fun_distribution_logs_mint_request_id_fkey"
            columns: ["mint_request_id"]
            isOneToOne: false
            referencedRelation: "pplp_mint_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      fun_id_links: {
        Row: {
          angel_user_id: string
          created_at: string
          fun_profile_user_id: string | null
          id: string
          linked_at: string
          status: string
          updated_at: string
          wallet_address: string | null
        }
        Insert: {
          angel_user_id: string
          created_at?: string
          fun_profile_user_id?: string | null
          id?: string
          linked_at?: string
          status?: string
          updated_at?: string
          wallet_address?: string | null
        }
        Update: {
          angel_user_id?: string
          created_at?: string
          fun_profile_user_id?: string | null
          id?: string
          linked_at?: string
          status?: string
          updated_at?: string
          wallet_address?: string | null
        }
        Relationships: []
      }
      fun_pool_config: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          pool_label: string
          pool_name: string
          retention_rate: number
          tier_order: number
          updated_at: string
          wallet_address: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          pool_label: string
          pool_name: string
          retention_rate?: number
          tier_order?: number
          updated_at?: string
          wallet_address?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          pool_label?: string
          pool_name?: string
          retention_rate?: number
          tier_order?: number
          updated_at?: string
          wallet_address?: string | null
        }
        Relationships: []
      }
      game_seasons: {
        Row: {
          code: string
          created_at: string
          description: string | null
          ends_at: string
          id: string
          is_active: boolean
          max_level: number
          name: string
          premium_price_camly: number
          starts_at: string
          theme: string | null
          xp_per_level: number
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          ends_at: string
          id?: string
          is_active?: boolean
          max_level?: number
          name: string
          premium_price_camly?: number
          starts_at: string
          theme?: string | null
          xp_per_level?: number
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          ends_at?: string
          id?: string
          is_active?: boolean
          max_level?: number
          name?: string
          premium_price_camly?: number
          starts_at?: string
          theme?: string | null
          xp_per_level?: number
        }
        Relationships: []
      }
      gratitude_journal: {
        Row: {
          content: string
          content_length: number
          created_at: string
          id: string
          is_rewarded: boolean | null
          journal_date: string
          journal_type: string
          purity_score: number | null
          reward_amount: number | null
          user_id: string
        }
        Insert: {
          content: string
          content_length: number
          created_at?: string
          id?: string
          is_rewarded?: boolean | null
          journal_date?: string
          journal_type: string
          purity_score?: number | null
          reward_amount?: number | null
          user_id: string
        }
        Update: {
          content?: string
          content_length?: number
          created_at?: string
          id?: string
          is_rewarded?: boolean | null
          journal_date?: string
          journal_type?: string
          purity_score?: number | null
          reward_amount?: number | null
          user_id?: string
        }
        Relationships: []
      }
      handle_audit_log: {
        Row: {
          created_at: string
          id: string
          new_handle: string
          old_handle: string | null
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          new_handle: string
          old_handle?: string | null
          source?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          new_handle?: string
          old_handle?: string | null
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      healing_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_read: boolean | null
          message_type: string
          read_at: string | null
          title: string
          triggered_by: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          message_type: string
          read_at?: string | null
          title: string
          triggered_by?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          message_type?: string
          read_at?: string | null
          title?: string
          triggered_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      idea_votes: {
        Row: {
          created_at: string
          id: string
          idea_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          idea_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          idea_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "idea_votes_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "build_ideas"
            referencedColumns: ["id"]
          },
        ]
      }
      identity_metadata: {
        Row: {
          created_at: string
          data_hash: string
          data_type: string
          did_id: string
          encrypted_data: string | null
          expires_at: string | null
          id: string
          is_current: boolean
          on_chain_hash: string | null
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          data_hash: string
          data_type: string
          did_id: string
          encrypted_data?: string | null
          expires_at?: string | null
          id?: string
          is_current?: boolean
          on_chain_hash?: string | null
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          created_at?: string
          data_hash?: string
          data_type?: string
          did_id?: string
          encrypted_data?: string | null
          expires_at?: string | null
          id?: string
          is_current?: boolean
          on_chain_hash?: string | null
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "identity_metadata_did_id_fkey"
            columns: ["did_id"]
            isOneToOne: false
            referencedRelation: "user_dids"
            referencedColumns: ["id"]
          },
        ]
      }
      identity_recovery_log: {
        Row: {
          completed_at: string | null
          cooldown_until: string | null
          created_at: string
          did_id: string
          id: string
          metadata: Json
          recovery_type: string
          risk_delta: number
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          cooldown_until?: string | null
          created_at?: string
          did_id: string
          id?: string
          metadata?: Json
          recovery_type: string
          risk_delta?: number
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          cooldown_until?: string | null
          created_at?: string
          did_id?: string
          id?: string
          metadata?: Json
          recovery_type?: string
          risk_delta?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "identity_recovery_log_did_id_fkey"
            columns: ["did_id"]
            isOneToOne: false
            referencedRelation: "user_dids"
            referencedColumns: ["id"]
          },
        ]
      }
      image_history: {
        Row: {
          created_at: string
          id: string
          image_type: string
          image_url: string
          prompt: string
          response_text: string | null
          style: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_type: string
          image_url: string
          prompt: string
          response_text?: string | null
          style?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_type?: string
          image_url?: string
          prompt?: string
          response_text?: string | null
          style?: string | null
          user_id?: string
        }
        Relationships: []
      }
      inflation_health_metrics: {
        Row: {
          active_quality_user_growth: number | null
          claim_efficiency_ratio: number | null
          created_at: string | null
          fraud_pressure_ratio: number | null
          id: string
          locked_circulating_ratio: number | null
          locked_stability_ratio: number | null
          metric_date: string
          raw_data: Json | null
          retention_quality_ratio: number | null
          retention_ratio: number | null
          safe_mode_active: boolean | null
          safe_mode_reason: string | null
          supply_growth_rate: number | null
          treasury_health_ratio: number | null
          utility_absorption_ratio: number | null
          utility_growth_rate: number | null
          value_expansion_ratio: number | null
        }
        Insert: {
          active_quality_user_growth?: number | null
          claim_efficiency_ratio?: number | null
          created_at?: string | null
          fraud_pressure_ratio?: number | null
          id?: string
          locked_circulating_ratio?: number | null
          locked_stability_ratio?: number | null
          metric_date: string
          raw_data?: Json | null
          retention_quality_ratio?: number | null
          retention_ratio?: number | null
          safe_mode_active?: boolean | null
          safe_mode_reason?: string | null
          supply_growth_rate?: number | null
          treasury_health_ratio?: number | null
          utility_absorption_ratio?: number | null
          utility_growth_rate?: number | null
          value_expansion_ratio?: number | null
        }
        Update: {
          active_quality_user_growth?: number | null
          claim_efficiency_ratio?: number | null
          created_at?: string | null
          fraud_pressure_ratio?: number | null
          id?: string
          locked_circulating_ratio?: number | null
          locked_stability_ratio?: number | null
          metric_date?: string
          raw_data?: Json | null
          retention_quality_ratio?: number | null
          retention_ratio?: number | null
          safe_mode_active?: boolean | null
          safe_mode_reason?: string | null
          supply_growth_rate?: number | null
          treasury_health_ratio?: number | null
          utility_absorption_ratio?: number | null
          utility_growth_rate?: number | null
          value_expansion_ratio?: number | null
        }
        Relationships: []
      }
      internal_config: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      knowledge_admin_audit: {
        Row: {
          action: string
          admin_id: string
          before_snapshot: Json | null
          context: Json | null
          created_at: string
          document_id: string | null
          id: string
        }
        Insert: {
          action: string
          admin_id: string
          before_snapshot?: Json | null
          context?: Json | null
          created_at?: string
          document_id?: string | null
          id?: string
        }
        Update: {
          action?: string
          admin_id?: string
          before_snapshot?: Json | null
          context?: Json | null
          created_at?: string
          document_id?: string | null
          id?: string
        }
        Relationships: []
      }
      knowledge_chunks: {
        Row: {
          category: string | null
          chunk_content_hash: string | null
          chunk_order: number | null
          chunk_text: string
          chunk_type: string
          created_at: string | null
          doc_title: string | null
          document_id: string | null
          embed_model: string | null
          embedded_at: string | null
          embedding: string | null
          folder_name: string | null
          id: string
          keywords: string[] | null
          paragraph_end: string | null
          paragraph_ids: string[] | null
          paragraph_start: string | null
          section_number: number | null
          section_title: string | null
          staging_status: string | null
          token_count: number | null
          version_id: string | null
        }
        Insert: {
          category?: string | null
          chunk_content_hash?: string | null
          chunk_order?: number | null
          chunk_text: string
          chunk_type?: string
          created_at?: string | null
          doc_title?: string | null
          document_id?: string | null
          embed_model?: string | null
          embedded_at?: string | null
          embedding?: string | null
          folder_name?: string | null
          id?: string
          keywords?: string[] | null
          paragraph_end?: string | null
          paragraph_ids?: string[] | null
          paragraph_start?: string | null
          section_number?: number | null
          section_title?: string | null
          staging_status?: string | null
          token_count?: number | null
          version_id?: string | null
        }
        Update: {
          category?: string | null
          chunk_content_hash?: string | null
          chunk_order?: number | null
          chunk_text?: string
          chunk_type?: string
          created_at?: string | null
          doc_title?: string | null
          document_id?: string | null
          embed_model?: string | null
          embedded_at?: string | null
          embedding?: string | null
          folder_name?: string | null
          id?: string
          keywords?: string[] | null
          paragraph_end?: string | null
          paragraph_ids?: string[] | null
          paragraph_start?: string | null
          section_number?: number | null
          section_title?: string | null
          staging_status?: string | null
          token_count?: number | null
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "knowledge_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_chunks_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "knowledge_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_collection_audit: {
        Row: {
          action: string
          actor_id: string | null
          collection_id: string | null
          created_at: string
          id: number
          reason_code: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          collection_id?: string | null
          created_at?: string
          id?: never
          reason_code: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          collection_id?: string | null
          created_at?: string
          id?: never
          reason_code?: string
        }
        Relationships: []
      }
      knowledge_collection_evaluations: {
        Row: {
          collection_id: string
          evaluated_at: string
          evaluation_type: string
          evaluator_version: string
          evidence_hash: string
          id: string
          status: string
        }
        Insert: {
          collection_id: string
          evaluated_at?: string
          evaluation_type: string
          evaluator_version: string
          evidence_hash: string
          id?: string
          status: string
        }
        Update: {
          collection_id?: string
          evaluated_at?: string
          evaluation_type?: string
          evaluator_version?: string
          evidence_hash?: string
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_collection_evaluations_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "knowledge_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_collections: {
        Row: {
          activated_at: string | null
          corpus: string
          created_at: string
          created_by: string | null
          edition: string
          id: string
          is_active: boolean
          language: string
          source_version: string
          updated_at: string
          version_status: string
        }
        Insert: {
          activated_at?: string | null
          corpus: string
          created_at?: string
          created_by?: string | null
          edition: string
          id?: string
          is_active?: boolean
          language: string
          source_version: string
          updated_at?: string
          version_status?: string
        }
        Update: {
          activated_at?: string | null
          corpus?: string
          created_at?: string
          created_by?: string | null
          edition?: string
          id?: string
          is_active?: boolean
          language?: string
          source_version?: string
          updated_at?: string
          version_status?: string
        }
        Relationships: []
      }
      knowledge_document_backups: {
        Row: {
          chunk_count: number | null
          content_hash: string | null
          created_at: string
          doc_id: string
          folder_id: string | null
          id: string
          payload: Json
          snapshot_date: string
          source: string | null
          title: string | null
        }
        Insert: {
          chunk_count?: number | null
          content_hash?: string | null
          created_at?: string
          doc_id: string
          folder_id?: string | null
          id?: string
          payload: Json
          snapshot_date?: string
          source?: string | null
          title?: string | null
        }
        Update: {
          chunk_count?: number | null
          content_hash?: string | null
          created_at?: string
          doc_id?: string
          folder_id?: string | null
          id?: string
          payload?: Json
          snapshot_date?: string
          source?: string | null
          title?: string | null
        }
        Relationships: []
      }
      knowledge_documents: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          chunk_count: number | null
          collection_id: string | null
          content_hash: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deprecated_at: string | null
          deprecation_reason: string | null
          description: string | null
          effective_from: string | null
          effective_until: string | null
          extracted_content: string | null
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          folder_id: string | null
          id: string
          ingest_error: string | null
          ingest_status: string | null
          ingested_at: string | null
          ingestion_batch_id: string | null
          is_processed: boolean
          knowledge_status: string
          language: string | null
          metadata: Json
          paper_number: number | null
          paper_title: string | null
          part_number: number | null
          reviewed_at: string | null
          reviewed_by: string | null
          source: string | null
          source_hash: string | null
          source_name: string | null
          source_ref: string | null
          source_uri: string | null
          source_url: string | null
          source_version: string | null
          supersedes_document_id: string | null
          title: string
          updated_at: string
          urantia_paper_number: number | null
          version: number
          version_group_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          chunk_count?: number | null
          collection_id?: string | null
          content_hash?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deprecated_at?: string | null
          deprecation_reason?: string | null
          description?: string | null
          effective_from?: string | null
          effective_until?: string | null
          extracted_content?: string | null
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          folder_id?: string | null
          id?: string
          ingest_error?: string | null
          ingest_status?: string | null
          ingested_at?: string | null
          ingestion_batch_id?: string | null
          is_processed?: boolean
          knowledge_status?: string
          language?: string | null
          metadata?: Json
          paper_number?: number | null
          paper_title?: string | null
          part_number?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string | null
          source_hash?: string | null
          source_name?: string | null
          source_ref?: string | null
          source_uri?: string | null
          source_url?: string | null
          source_version?: string | null
          supersedes_document_id?: string | null
          title: string
          updated_at?: string
          urantia_paper_number?: number | null
          version?: number
          version_group_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          chunk_count?: number | null
          collection_id?: string | null
          content_hash?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deprecated_at?: string | null
          deprecation_reason?: string | null
          description?: string | null
          effective_from?: string | null
          effective_until?: string | null
          extracted_content?: string | null
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          folder_id?: string | null
          id?: string
          ingest_error?: string | null
          ingest_status?: string | null
          ingested_at?: string | null
          ingestion_batch_id?: string | null
          is_processed?: boolean
          knowledge_status?: string
          language?: string | null
          metadata?: Json
          paper_number?: number | null
          paper_title?: string | null
          part_number?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string | null
          source_hash?: string | null
          source_name?: string | null
          source_ref?: string | null
          source_uri?: string | null
          source_url?: string | null
          source_version?: string | null
          supersedes_document_id?: string | null
          title?: string
          updated_at?: string
          urantia_paper_number?: number | null
          version?: number
          version_group_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_documents_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "knowledge_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_documents_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "knowledge_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_documents_ingestion_batch_id_fkey"
            columns: ["ingestion_batch_id"]
            isOneToOne: false
            referencedRelation: "knowledge_ingestion_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_documents_supersedes_document_id_fkey"
            columns: ["supersedes_document_id"]
            isOneToOne: false
            referencedRelation: "knowledge_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_folders: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
          parent_id: string | null
          platform_key: string | null
          slug: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          parent_id?: string | null
          platform_key?: string | null
          slug?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          platform_key?: string | null
          slug?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "knowledge_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_ingest_audit: {
        Row: {
          action: string
          api_key_hash: string
          created_at: string
          created_count: number
          docs_count: number
          duplicate_count: number
          duration_ms: number | null
          error_count: number
          http_status: number
          id: string
          ip_hash: string | null
          low_content_count: number
          request_bytes: number | null
          sample_error: string | null
          sample_source: string | null
          sample_source_ref: string | null
          skipped_count: number
          success_count: number
          updated_count: number
          user_agent: string | null
        }
        Insert: {
          action: string
          api_key_hash: string
          created_at?: string
          created_count?: number
          docs_count?: number
          duplicate_count?: number
          duration_ms?: number | null
          error_count?: number
          http_status?: number
          id?: string
          ip_hash?: string | null
          low_content_count?: number
          request_bytes?: number | null
          sample_error?: string | null
          sample_source?: string | null
          sample_source_ref?: string | null
          skipped_count?: number
          success_count?: number
          updated_count?: number
          user_agent?: string | null
        }
        Update: {
          action?: string
          api_key_hash?: string
          created_at?: string
          created_count?: number
          docs_count?: number
          duplicate_count?: number
          duration_ms?: number | null
          error_count?: number
          http_status?: number
          id?: string
          ip_hash?: string | null
          low_content_count?: number
          request_bytes?: number | null
          sample_error?: string | null
          sample_source?: string | null
          sample_source_ref?: string | null
          skipped_count?: number
          success_count?: number
          updated_count?: number
          user_agent?: string | null
        }
        Relationships: []
      }
      knowledge_ingest_rate_limit: {
        Row: {
          api_key_hash: string
          count: number
          window_start: string
        }
        Insert: {
          api_key_hash: string
          count?: number
          window_start: string
        }
        Update: {
          api_key_hash?: string
          count?: number
          window_start?: string
        }
        Relationships: []
      }
      knowledge_ingest_sync_audit: {
        Row: {
          context: string | null
          detected_at: string
          document_id: string | null
          fixed: boolean
          id: string
          ingest_status: string | null
          is_processed_after: boolean | null
          is_processed_before: boolean | null
          source: string | null
        }
        Insert: {
          context?: string | null
          detected_at?: string
          document_id?: string | null
          fixed?: boolean
          id?: string
          ingest_status?: string | null
          is_processed_after?: boolean | null
          is_processed_before?: boolean | null
          source?: string | null
        }
        Update: {
          context?: string | null
          detected_at?: string
          document_id?: string | null
          fixed?: boolean
          id?: string
          ingest_status?: string | null
          is_processed_after?: boolean | null
          is_processed_before?: boolean | null
          source?: string | null
        }
        Relationships: []
      }
      knowledge_ingestion_batches: {
        Row: {
          checkpoint: Json
          collection_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          manifest: Json
          retry_count: number
          safe_error_code: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          checkpoint?: Json
          collection_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          manifest?: Json
          retry_count?: number
          safe_error_code?: string | null
          started_at?: string | null
          status?: string
        }
        Update: {
          checkpoint?: Json
          collection_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          manifest?: Json
          retry_count?: number
          safe_error_code?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_ingestion_batches_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "knowledge_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_source_routing: {
        Row: {
          created_at: string
          folder_id: string | null
          id: string
          match_value: string | null
          note: string | null
          source_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          folder_id?: string | null
          id?: string
          match_value?: string | null
          note?: string | null
          source_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          folder_id?: string | null
          id?: string
          match_value?: string | null
          note?: string | null
          source_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_source_routing_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "knowledge_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      lantern_path_progress: {
        Row: {
          ai_score: number
          camly_awarded: number
          completed_at: string
          day_idx: number
          evidence: string
          id: string
          theme_key: string
          user_id: string
          week_start: string
          xp_awarded: number
        }
        Insert: {
          ai_score: number
          camly_awarded?: number
          completed_at?: string
          day_idx: number
          evidence: string
          id?: string
          theme_key: string
          user_id: string
          week_start: string
          xp_awarded?: number
        }
        Update: {
          ai_score?: number
          camly_awarded?: number
          completed_at?: string
          day_idx?: number
          evidence?: string
          id?: string
          theme_key?: string
          user_id?: string
          week_start?: string
          xp_awarded?: number
        }
        Relationships: []
      }
      lantern_weekly_bonus: {
        Row: {
          camly_awarded: number
          claimed_at: string
          id: string
          user_id: string
          week_start: string
          xp_awarded: number
        }
        Insert: {
          camly_awarded?: number
          claimed_at?: string
          id?: string
          user_id: string
          week_start: string
          xp_awarded?: number
        }
        Update: {
          camly_awarded?: number
          claimed_at?: string
          id?: string
          user_id?: string
          week_start?: string
          xp_awarded?: number
        }
        Relationships: []
      }
      light_circle_chat_messages: {
        Row: {
          body: string
          circle_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          body: string
          circle_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          body?: string
          circle_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "light_circle_chat_messages_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "light_circles"
            referencedColumns: ["id"]
          },
        ]
      }
      light_circle_invites: {
        Row: {
          circle_id: string
          code: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
          uses_left: number
        }
        Insert: {
          circle_id: string
          code: string
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          uses_left?: number
        }
        Update: {
          circle_id?: string
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          uses_left?: number
        }
        Relationships: [
          {
            foreignKeyName: "light_circle_invites_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "light_circles"
            referencedColumns: ["id"]
          },
        ]
      }
      light_circle_lamp_contributions: {
        Row: {
          amount: number
          circle_id: string
          created_at: string
          id: string
          lamp_id: string
          user_id: string
        }
        Insert: {
          amount: number
          circle_id: string
          created_at?: string
          id?: string
          lamp_id: string
          user_id: string
        }
        Update: {
          amount?: number
          circle_id?: string
          created_at?: string
          id?: string
          lamp_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "light_circle_lamp_contributions_lamp_id_fkey"
            columns: ["lamp_id"]
            isOneToOne: false
            referencedRelation: "light_circle_lamps"
            referencedColumns: ["id"]
          },
        ]
      }
      light_circle_lamp_loot: {
        Row: {
          base_box_count: number
          base_box_tier: string
          base_camly: number
          base_xp: number
          circle_id: string
          distributed_at: string
          id: string
          lamp_id: string
          total_contributors: number
          total_light: number
        }
        Insert: {
          base_box_count?: number
          base_box_tier?: string
          base_camly?: number
          base_xp?: number
          circle_id: string
          distributed_at?: string
          id?: string
          lamp_id: string
          total_contributors?: number
          total_light?: number
        }
        Update: {
          base_box_count?: number
          base_box_tier?: string
          base_camly?: number
          base_xp?: number
          circle_id?: string
          distributed_at?: string
          id?: string
          lamp_id?: string
          total_contributors?: number
          total_light?: number
        }
        Relationships: [
          {
            foreignKeyName: "light_circle_lamp_loot_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "light_circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "light_circle_lamp_loot_lamp_id_fkey"
            columns: ["lamp_id"]
            isOneToOne: true
            referencedRelation: "light_circle_lamps"
            referencedColumns: ["id"]
          },
        ]
      }
      light_circle_lamp_loot_grants: {
        Row: {
          box_tickets_granted: number
          camly_granted: number
          circle_id: string
          claimed_at: string | null
          contribution: number
          created_at: string
          id: string
          lamp_id: string
          share_pct: number
          user_id: string
          xp_granted: number
        }
        Insert: {
          box_tickets_granted: number
          camly_granted: number
          circle_id: string
          claimed_at?: string | null
          contribution: number
          created_at?: string
          id?: string
          lamp_id: string
          share_pct: number
          user_id: string
          xp_granted: number
        }
        Update: {
          box_tickets_granted?: number
          camly_granted?: number
          circle_id?: string
          claimed_at?: string | null
          contribution?: number
          created_at?: string
          id?: string
          lamp_id?: string
          share_pct?: number
          user_id?: string
          xp_granted?: number
        }
        Relationships: [
          {
            foreignKeyName: "light_circle_lamp_loot_grants_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "light_circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "light_circle_lamp_loot_grants_lamp_id_fkey"
            columns: ["lamp_id"]
            isOneToOne: false
            referencedRelation: "light_circle_lamps"
            referencedColumns: ["id"]
          },
        ]
      }
      light_circle_lamps: {
        Row: {
          circle_id: string
          completed_at: string | null
          created_at: string
          created_by: string
          current_light: number
          ends_at: string | null
          id: string
          loot_tier: string
          name: string
          starts_at: string
          status: string
          target_light: number
        }
        Insert: {
          circle_id: string
          completed_at?: string | null
          created_at?: string
          created_by: string
          current_light?: number
          ends_at?: string | null
          id?: string
          loot_tier?: string
          name: string
          starts_at?: string
          status?: string
          target_light: number
        }
        Update: {
          circle_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          current_light?: number
          ends_at?: string | null
          id?: string
          loot_tier?: string
          name?: string
          starts_at?: string
          status?: string
          target_light?: number
        }
        Relationships: [
          {
            foreignKeyName: "light_circle_lamps_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "light_circles"
            referencedColumns: ["id"]
          },
        ]
      }
      light_circle_members: {
        Row: {
          circle_id: string
          contributed_light: number
          joined_at: string
          role: Database["public"]["Enums"]["light_circle_role"]
          user_id: string
        }
        Insert: {
          circle_id: string
          contributed_light?: number
          joined_at?: string
          role?: Database["public"]["Enums"]["light_circle_role"]
          user_id: string
        }
        Update: {
          circle_id?: string
          contributed_light?: number
          joined_at?: string
          role?: Database["public"]["Enums"]["light_circle_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "light_circle_members_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "light_circles"
            referencedColumns: ["id"]
          },
        ]
      }
      light_circles: {
        Row: {
          avatar_emoji: string
          code: string
          created_at: string
          created_by: string
          id: string
          is_open: boolean
          light_pool: number
          max_members: number
          member_count: number
          motto: string | null
          name: string
        }
        Insert: {
          avatar_emoji?: string
          code: string
          created_at?: string
          created_by: string
          id?: string
          is_open?: boolean
          light_pool?: number
          max_members?: number
          member_count?: number
          motto?: string | null
          name: string
        }
        Update: {
          avatar_emoji?: string
          code?: string
          created_at?: string
          created_by?: string
          id?: string
          is_open?: boolean
          light_pool?: number
          max_members?: number
          member_count?: number
          motto?: string | null
          name?: string
        }
        Relationships: []
      }
      light_forge_log: {
        Row: {
          camly_burned: number
          created_at: string
          echo_granted: boolean
          id: string
          input_nft_ids: string[]
          output_nft_id: string | null
          recipe_id: string
          user_id: string
          xp_awarded: number
        }
        Insert: {
          camly_burned: number
          created_at?: string
          echo_granted?: boolean
          id?: string
          input_nft_ids: string[]
          output_nft_id?: string | null
          recipe_id: string
          user_id: string
          xp_awarded?: number
        }
        Update: {
          camly_burned?: number
          created_at?: string
          echo_granted?: boolean
          id?: string
          input_nft_ids?: string[]
          output_nft_id?: string | null
          recipe_id?: string
          user_id?: string
          xp_awarded?: number
        }
        Relationships: [
          {
            foreignKeyName: "light_forge_log_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "light_forge_recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      light_forge_recipes: {
        Row: {
          camly_cost: number
          created_at: string
          echo_chance: number
          enabled: boolean
          id: string
          input_count: number
          input_tier: string
          output_collection: string
          output_tier: string
          xp_reward: number
        }
        Insert: {
          camly_cost: number
          created_at?: string
          echo_chance?: number
          enabled?: boolean
          id?: string
          input_count?: number
          input_tier: string
          output_collection?: string
          output_tier: string
          xp_reward?: number
        }
        Update: {
          camly_cost?: number
          created_at?: string
          echo_chance?: number
          enabled?: boolean
          id?: string
          input_count?: number
          input_tier?: string
          output_collection?: string
          output_tier?: string
          xp_reward?: number
        }
        Relationships: []
      }
      light_points: {
        Row: {
          created_at: string
          id: string
          points: number
          reason: string
          source_type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          points: number
          reason: string
          source_type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          points?: number
          reason?: string
          source_type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      light_score_ledger: {
        Row: {
          base_score: number | null
          computed_at: string | null
          consistency_multiplier: number | null
          explain_ref: string | null
          final_light_score: number | null
          id: string
          integrity_penalty: number | null
          level: string | null
          period: string
          period_end: string
          period_start: string
          reason_codes: string[] | null
          reputation_weight: number | null
          rule_version: string | null
          sequence_multiplier: number | null
          trend: string | null
          user_id: string
          vvu_total: number | null
        }
        Insert: {
          base_score?: number | null
          computed_at?: string | null
          consistency_multiplier?: number | null
          explain_ref?: string | null
          final_light_score?: number | null
          id?: string
          integrity_penalty?: number | null
          level?: string | null
          period?: string
          period_end: string
          period_start: string
          reason_codes?: string[] | null
          reputation_weight?: number | null
          rule_version?: string | null
          sequence_multiplier?: number | null
          trend?: string | null
          user_id: string
          vvu_total?: number | null
        }
        Update: {
          base_score?: number | null
          computed_at?: string | null
          consistency_multiplier?: number | null
          explain_ref?: string | null
          final_light_score?: number | null
          id?: string
          integrity_penalty?: number | null
          level?: string | null
          period?: string
          period_end?: string
          period_start?: string
          reason_codes?: string[] | null
          reputation_weight?: number | null
          rule_version?: string | null
          sequence_multiplier?: number | null
          trend?: string | null
          user_id?: string
          vvu_total?: number | null
        }
        Relationships: []
      }
      light_score_snapshots: {
        Row: {
          active_sbt_count: number | null
          created_at: string
          dib_state_root: string | null
          did_id: string | null
          did_level: number | null
          id: string
          light_score: number
          on_chain_anchor_block: number | null
          on_chain_anchor_hash: string | null
          pillar_c: number
          pillar_h: number
          pillar_s: number
          pillar_t: number
          pillar_u: number
          snapshot_epoch: string
          snapshot_hash: string
          sybil_risk: string | null
          tc: number | null
          time_decay_factor: number
          total_actions: number
          trust_multiplier: number
          trust_tier: string | null
          user_id: string
        }
        Insert: {
          active_sbt_count?: number | null
          created_at?: string
          dib_state_root?: string | null
          did_id?: string | null
          did_level?: number | null
          id?: string
          light_score: number
          on_chain_anchor_block?: number | null
          on_chain_anchor_hash?: string | null
          pillar_c?: number
          pillar_h?: number
          pillar_s?: number
          pillar_t?: number
          pillar_u?: number
          snapshot_epoch: string
          snapshot_hash: string
          sybil_risk?: string | null
          tc?: number | null
          time_decay_factor?: number
          total_actions?: number
          trust_multiplier?: number
          trust_tier?: string | null
          user_id: string
        }
        Update: {
          active_sbt_count?: number | null
          created_at?: string
          dib_state_root?: string | null
          did_id?: string | null
          did_level?: number | null
          id?: string
          light_score?: number
          on_chain_anchor_block?: number | null
          on_chain_anchor_hash?: string | null
          pillar_c?: number
          pillar_h?: number
          pillar_s?: number
          pillar_t?: number
          pillar_u?: number
          snapshot_epoch?: string
          snapshot_hash?: string
          sybil_risk?: string | null
          tc?: number | null
          time_decay_factor?: number
          total_actions?: number
          trust_multiplier?: number
          trust_tier?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "light_score_snapshots_did_id_fkey"
            columns: ["did_id"]
            isOneToOne: false
            referencedRelation: "user_dids"
            referencedColumns: ["id"]
          },
        ]
      }
      lixi_claims: {
        Row: {
          camly_amount: number
          claimed_at: string
          error_message: string | null
          fun_amount: number
          id: string
          notification_id: string
          processed_at: string | null
          processed_by: string | null
          status: string
          tx_hash: string | null
          user_id: string
          wallet_address: string | null
        }
        Insert: {
          camly_amount: number
          claimed_at?: string
          error_message?: string | null
          fun_amount: number
          id?: string
          notification_id: string
          processed_at?: string | null
          processed_by?: string | null
          status?: string
          tx_hash?: string | null
          user_id: string
          wallet_address?: string | null
        }
        Update: {
          camly_amount?: number
          claimed_at?: string
          error_message?: string | null
          fun_amount?: number
          id?: string
          notification_id?: string
          processed_at?: string | null
          processed_by?: string | null
          status?: string
          tx_hash?: string | null
          user_id?: string
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lixi_claims_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      mastery_perk_catalog: {
        Row: {
          created_at: string
          description: string | null
          level: number
          options: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          level: number
          options: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          level?: number
          options?: Json
        }
        Relationships: []
      }
      mint_allocations: {
        Row: {
          allocation_amount: number
          contribution_ratio: number
          created_at: string
          eligible: boolean
          epoch_id: string
          id: string
          light_score: number
          onchain_tx_hash: string | null
          reason_codes: string[] | null
          user_id: string
        }
        Insert: {
          allocation_amount?: number
          contribution_ratio?: number
          created_at?: string
          eligible?: boolean
          epoch_id: string
          id?: string
          light_score?: number
          onchain_tx_hash?: string | null
          reason_codes?: string[] | null
          user_id: string
        }
        Update: {
          allocation_amount?: number
          contribution_ratio?: number
          created_at?: string
          eligible?: boolean
          epoch_id?: string
          id?: string
          light_score?: number
          onchain_tx_hash?: string | null
          reason_codes?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mint_allocations_epoch_id_fkey"
            columns: ["epoch_id"]
            isOneToOne: false
            referencedRelation: "mint_epochs"
            referencedColumns: ["id"]
          },
        ]
      }
      mint_epochs: {
        Row: {
          created_at: string
          epoch_label: string
          finalized_at: string | null
          id: string
          mint_pool_amount: number
          onchain_tx_hash: string | null
          period_end: string
          period_start: string
          rules_version: string
          status: string
          total_light: number
          updated_at: string
          user_count: number
        }
        Insert: {
          created_at?: string
          epoch_label: string
          finalized_at?: string | null
          id?: string
          mint_pool_amount?: number
          onchain_tx_hash?: string | null
          period_end: string
          period_start: string
          rules_version?: string
          status?: string
          total_light?: number
          updated_at?: string
          user_count?: number
        }
        Update: {
          created_at?: string
          epoch_label?: string
          finalized_at?: string | null
          id?: string
          mint_pool_amount?: number
          onchain_tx_hash?: string | null
          period_end?: string
          period_start?: string
          rules_version?: string
          status?: string
          total_light?: number
          updated_at?: string
          user_count?: number
        }
        Relationships: []
      }
      nft_collections: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string | null
          image_url: string | null
          name: string
          soulbound: boolean
          supply_max: number | null
          supply_minted: number
          traits_schema: Json
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description?: string | null
          image_url?: string | null
          name: string
          soulbound?: boolean
          supply_max?: number | null
          supply_minted?: number
          traits_schema?: Json
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string | null
          image_url?: string | null
          name?: string
          soulbound?: boolean
          supply_max?: number | null
          supply_minted?: number
          traits_schema?: Json
        }
        Relationships: []
      }
      nft_items: {
        Row: {
          collection_code: string
          created_at: string
          id: string
          mint_status: string
          minted_at: string | null
          owner_user_id: string
          source_ref: string | null
          source_type: string
          token_id: number
          traits: Json
          tx_hash: string | null
        }
        Insert: {
          collection_code: string
          created_at?: string
          id?: string
          mint_status?: string
          minted_at?: string | null
          owner_user_id: string
          source_ref?: string | null
          source_type: string
          token_id: number
          traits?: Json
          tx_hash?: string | null
        }
        Update: {
          collection_code?: string
          created_at?: string
          id?: string
          mint_status?: string
          minted_at?: string | null
          owner_user_id?: string
          source_ref?: string | null
          source_type?: string
          token_id?: number
          traits?: Json
          tx_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nft_items_collection_code_fkey"
            columns: ["collection_code"]
            isOneToOne: false
            referencedRelation: "nft_collections"
            referencedColumns: ["code"]
          },
        ]
      }
      nft_mint_queue: {
        Row: {
          attempts: number
          created_at: string
          id: string
          item_id: string
          last_error: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          item_id: string
          last_error?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          item_id?: string
          last_error?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nft_mint_queue_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "nft_items"
            referencedColumns: ["id"]
          },
        ]
      }
      nft_pet_evolution_log: {
        Row: {
          evolved_at: string
          from_stage: string | null
          id: string
          level_at_evolve: number | null
          nft_item_id: string
          pet_id: string
          to_stage: string
          user_id: string
        }
        Insert: {
          evolved_at?: string
          from_stage?: string | null
          id?: string
          level_at_evolve?: number | null
          nft_item_id: string
          pet_id: string
          to_stage: string
          user_id: string
        }
        Update: {
          evolved_at?: string
          from_stage?: string | null
          id?: string
          level_at_evolve?: number | null
          nft_item_id?: string
          pet_id?: string
          to_stage?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nft_pet_evolution_log_nft_item_id_fkey"
            columns: ["nft_item_id"]
            isOneToOne: false
            referencedRelation: "nft_items"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_broadcasts: {
        Row: {
          audience: string
          created_at: string
          cycle_id: string | null
          cycle_label: string | null
          error: string | null
          id: string
          recipients_count: number
          sent_by: string | null
          sent_count: number
          skipped_count: number
          status: string
          template_id: string | null
        }
        Insert: {
          audience: string
          created_at?: string
          cycle_id?: string | null
          cycle_label?: string | null
          error?: string | null
          id?: string
          recipients_count?: number
          sent_by?: string | null
          sent_count?: number
          skipped_count?: number
          status?: string
          template_id?: string | null
        }
        Update: {
          audience?: string
          created_at?: string
          cycle_id?: string | null
          cycle_label?: string | null
          error?: string | null
          id?: string
          recipients_count?: number
          sent_by?: string | null
          sent_count?: number
          skipped_count?: number
          status?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_broadcasts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "notification_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_templates: {
        Row: {
          audience: string
          content_template: string
          created_at: string
          created_by: string | null
          cta_label: string
          cta_url: string
          cycle_type: string
          id: string
          is_active: boolean
          metadata: Json
          name: string
          notification_type: string
          title: string
          updated_at: string
        }
        Insert: {
          audience?: string
          content_template: string
          created_at?: string
          created_by?: string | null
          cta_label?: string
          cta_url?: string
          cycle_type?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          name: string
          notification_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          audience?: string
          content_template?: string
          created_at?: string
          created_by?: string | null
          cta_label?: string
          cta_url?: string
          cycle_type?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          name?: string
          notification_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string | null
          content: string
          created_at: string
          id: string
          is_read: boolean
          metadata: Json | null
          read_at: string | null
          reference_id: string | null
          reference_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          content: string
          created_at?: string
          id?: string
          is_read?: boolean
          metadata?: Json | null
          read_at?: string | null
          reference_id?: string | null
          reference_type?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean
          metadata?: Json | null
          read_at?: string | null
          reference_id?: string | null
          reference_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      onboarding_responses: {
        Row: {
          analyzed_at: string | null
          answer: string
          created_at: string
          energy_keywords: string[] | null
          id: string
          question_key: string
          question_text: string
          sentiment_score: number | null
          user_id: string
        }
        Insert: {
          analyzed_at?: string | null
          answer: string
          created_at?: string
          energy_keywords?: string[] | null
          id?: string
          question_key: string
          question_text: string
          sentiment_score?: number | null
          user_id: string
        }
        Update: {
          analyzed_at?: string | null
          answer?: string
          created_at?: string
          energy_keywords?: string[] | null
          id?: string
          question_key?: string
          question_text?: string
          sentiment_score?: number | null
          user_id?: string
        }
        Relationships: []
      }
      org_profiles: {
        Row: {
          banner_url: string | null
          category: string
          created_at: string
          description: string | null
          did_id: string
          display_name: string
          id: string
          is_verified: boolean
          logo_url: string | null
          member_count: number
          metadata: Json
          slug: string | null
          updated_at: string
          user_id: string
          verified_at: string | null
          website: string | null
        }
        Insert: {
          banner_url?: string | null
          category?: string
          created_at?: string
          description?: string | null
          did_id: string
          display_name: string
          id?: string
          is_verified?: boolean
          logo_url?: string | null
          member_count?: number
          metadata?: Json
          slug?: string | null
          updated_at?: string
          user_id: string
          verified_at?: string | null
          website?: string | null
        }
        Update: {
          banner_url?: string | null
          category?: string
          created_at?: string
          description?: string | null
          did_id?: string
          display_name?: string
          id?: string
          is_verified?: boolean
          logo_url?: string | null
          member_count?: number
          metadata?: Json
          slug?: string | null
          updated_at?: string
          user_id?: string
          verified_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_profiles_did_id_fkey"
            columns: ["did_id"]
            isOneToOne: true
            referencedRelation: "user_dids"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_rewards: {
        Row: {
          amount: number
          cancelled_at: string | null
          created_at: string
          description: string | null
          frozen_reason: string | null
          id: string
          metadata: Json | null
          purity_score: number | null
          reason: string
          release_at: string
          released_at: string | null
          status: string
          transaction_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          cancelled_at?: string | null
          created_at?: string
          description?: string | null
          frozen_reason?: string | null
          id?: string
          metadata?: Json | null
          purity_score?: number | null
          reason?: string
          release_at: string
          released_at?: string | null
          status?: string
          transaction_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          cancelled_at?: string | null
          created_at?: string
          description?: string | null
          frozen_reason?: string | null
          id?: string
          metadata?: Json | null
          purity_score?: number | null
          reason?: string
          release_at?: string
          released_at?: string | null
          status?: string
          transaction_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pet_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          pet_id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          pet_id: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          pet_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pet_chat_messages_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_xp_ledger: {
        Row: {
          created_at: string
          id: string
          level_after: number
          pet_id: string
          source: string
          source_ref: string | null
          user_id: string
          xp_delta: number
        }
        Insert: {
          created_at?: string
          id?: string
          level_after: number
          pet_id: string
          source: string
          source_ref?: string | null
          user_id: string
          xp_delta: number
        }
        Update: {
          created_at?: string
          id?: string
          level_after?: number
          pet_id?: string
          source?: string
          source_ref?: string | null
          user_id?: string
          xp_delta?: number
        }
        Relationships: [
          {
            foreignKeyName: "pet_xp_ledger_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      pets: {
        Row: {
          aura: number
          created_at: string
          element: Database["public"]["Enums"]["pet_element"]
          energy: number
          evolution: Database["public"]["Enums"]["pet_evolution"]
          id: string
          last_chat_at: string | null
          last_fed_at: string | null
          level: number
          mood: number
          name: string
          personality: Database["public"]["Enums"]["pet_personality"]
          total_xp: number
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          aura?: number
          created_at?: string
          element: Database["public"]["Enums"]["pet_element"]
          energy?: number
          evolution?: Database["public"]["Enums"]["pet_evolution"]
          id?: string
          last_chat_at?: string | null
          last_fed_at?: string | null
          level?: number
          mood?: number
          name: string
          personality: Database["public"]["Enums"]["pet_personality"]
          total_xp?: number
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          aura?: number
          created_at?: string
          element?: Database["public"]["Enums"]["pet_element"]
          energy?: number
          evolution?: Database["public"]["Enums"]["pet_evolution"]
          id?: string
          last_chat_at?: string | null
          last_fed_at?: string | null
          level?: number
          mood?: number
          name?: string
          personality?: Database["public"]["Enums"]["pet_personality"]
          total_xp?: number
          updated_at?: string
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
      pplp_action_caps: {
        Row: {
          action_type: string
          base_reward: number
          cooldown_seconds: number | null
          created_at: string
          diminishing_factor: number | null
          diminishing_threshold: number | null
          id: string
          is_active: boolean
          max_global_daily: number | null
          max_per_user_daily: number | null
          max_per_user_weekly: number | null
          min_quality_score: number | null
          multiplier_ranges: Json
          platform_id: string
          thresholds: Json
          updated_at: string
        }
        Insert: {
          action_type: string
          base_reward?: number
          cooldown_seconds?: number | null
          created_at?: string
          diminishing_factor?: number | null
          diminishing_threshold?: number | null
          id?: string
          is_active?: boolean
          max_global_daily?: number | null
          max_per_user_daily?: number | null
          max_per_user_weekly?: number | null
          min_quality_score?: number | null
          multiplier_ranges?: Json
          platform_id?: string
          thresholds?: Json
          updated_at?: string
        }
        Update: {
          action_type?: string
          base_reward?: number
          cooldown_seconds?: number | null
          created_at?: string
          diminishing_factor?: number | null
          diminishing_threshold?: number | null
          id?: string
          is_active?: boolean
          max_global_daily?: number | null
          max_per_user_daily?: number | null
          max_per_user_weekly?: number | null
          min_quality_score?: number | null
          multiplier_ranges?: Json
          platform_id?: string
          thresholds?: Json
          updated_at?: string
        }
        Relationships: []
      }
      pplp_actions: {
        Row: {
          action_type: string
          action_type_enum:
            | Database["public"]["Enums"]["pplp_action_type"]
            | null
          actor_id: string
          canonical_hash: string | null
          created_at: string
          evidence_hash: string | null
          id: string
          impact: Json
          integrity: Json
          metadata: Json
          mint_request_hash: string | null
          minted_at: string | null
          platform_id: string
          policy_snapshot: Json | null
          policy_version: string
          scored_at: string | null
          status: Database["public"]["Enums"]["pplp_action_status"]
          synced_at: string | null
          synced_to_fun_rich: boolean
          target_id: string | null
        }
        Insert: {
          action_type: string
          action_type_enum?:
            | Database["public"]["Enums"]["pplp_action_type"]
            | null
          actor_id: string
          canonical_hash?: string | null
          created_at?: string
          evidence_hash?: string | null
          id?: string
          impact?: Json
          integrity?: Json
          metadata?: Json
          mint_request_hash?: string | null
          minted_at?: string | null
          platform_id?: string
          policy_snapshot?: Json | null
          policy_version?: string
          scored_at?: string | null
          status?: Database["public"]["Enums"]["pplp_action_status"]
          synced_at?: string | null
          synced_to_fun_rich?: boolean
          target_id?: string | null
        }
        Update: {
          action_type?: string
          action_type_enum?:
            | Database["public"]["Enums"]["pplp_action_type"]
            | null
          actor_id?: string
          canonical_hash?: string | null
          created_at?: string
          evidence_hash?: string | null
          id?: string
          impact?: Json
          integrity?: Json
          metadata?: Json
          mint_request_hash?: string | null
          minted_at?: string | null
          platform_id?: string
          policy_snapshot?: Json | null
          policy_version?: string
          scored_at?: string | null
          status?: Database["public"]["Enums"]["pplp_action_status"]
          synced_at?: string | null
          synced_to_fun_rich?: boolean
          target_id?: string | null
        }
        Relationships: []
      }
      pplp_activity_categories: {
        Row: {
          action_type: string
          base_weight: number
          category: string
          created_at: string
          description_en: string | null
          description_vi: string | null
          is_active: boolean
          subcategory: string | null
        }
        Insert: {
          action_type: string
          base_weight?: number
          category: string
          created_at?: string
          description_en?: string | null
          description_vi?: string | null
          is_active?: boolean
          subcategory?: string | null
        }
        Update: {
          action_type?: string
          base_weight?: number
          category?: string
          created_at?: string
          description_en?: string | null
          description_vi?: string | null
          is_active?: boolean
          subcategory?: string | null
        }
        Relationships: []
      }
      pplp_attendance: {
        Row: {
          action_id: string | null
          app_check_in: string | null
          app_check_out: string | null
          created_at: string
          duration_estimate: number | null
          event_id: string
          group_id: string | null
          host_confirmed: boolean
          id: string
          light_score_earned: number | null
          metadata: Json | null
          optional_presence_signal: boolean
          participation_factor: number
          reflection_submitted: boolean
          reflection_text: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          action_id?: string | null
          app_check_in?: string | null
          app_check_out?: string | null
          created_at?: string
          duration_estimate?: number | null
          event_id: string
          group_id?: string | null
          host_confirmed?: boolean
          id?: string
          light_score_earned?: number | null
          metadata?: Json | null
          optional_presence_signal?: boolean
          participation_factor?: number
          reflection_submitted?: boolean
          reflection_text?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          action_id?: string | null
          app_check_in?: string | null
          app_check_out?: string | null
          created_at?: string
          duration_estimate?: number | null
          event_id?: string
          group_id?: string | null
          host_confirmed?: boolean
          id?: string
          light_score_earned?: number | null
          metadata?: Json | null
          optional_presence_signal?: boolean
          participation_factor?: number
          reflection_submitted?: boolean
          reflection_text?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pplp_attendance_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "pplp_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pplp_attendance_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "user_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pplp_attendance_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "attendance_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pplp_attendance_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "pplp_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      pplp_audits: {
        Row: {
          action_id: string | null
          action_taken: string | null
          actor_id: string
          audit_status: string
          audit_type: string
          audited_score: Json | null
          auditor_id: string | null
          completed_at: string | null
          created_at: string
          finding: string | null
          id: string
          original_score: Json | null
          penalty_amount: number | null
        }
        Insert: {
          action_id?: string | null
          action_taken?: string | null
          actor_id: string
          audit_status?: string
          audit_type: string
          audited_score?: Json | null
          auditor_id?: string | null
          completed_at?: string | null
          created_at?: string
          finding?: string | null
          id?: string
          original_score?: Json | null
          penalty_amount?: number | null
        }
        Update: {
          action_id?: string | null
          action_taken?: string | null
          actor_id?: string
          audit_status?: string
          audit_type?: string
          audited_score?: Json | null
          auditor_id?: string | null
          completed_at?: string | null
          created_at?: string
          finding?: string | null
          id?: string
          original_score?: Json | null
          penalty_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pplp_audits_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "pplp_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pplp_audits_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "user_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      pplp_backlog_audit: {
        Row: {
          allocation_count: number
          audit_group: string
          audit_run_id: string
          audited_at: string
          id: string
          metadata: Json | null
          notes: string | null
          pending_fun: number
          user_id: string
        }
        Insert: {
          allocation_count?: number
          audit_group: string
          audit_run_id?: string
          audited_at?: string
          id?: string
          metadata?: Json | null
          notes?: string | null
          pending_fun?: number
          user_id: string
        }
        Update: {
          allocation_count?: number
          audit_group?: string
          audit_run_id?: string
          audited_at?: string
          id?: string
          metadata?: Json | null
          notes?: string | null
          pending_fun?: number
          user_id?: string
        }
        Relationships: []
      }
      pplp_behavior_sequences: {
        Row: {
          actions: string[] | null
          completed_at: string | null
          created_at: string
          expires_at: string
          id: string
          max_stage: number
          sequence_multiplier: number
          sequence_type: string
          stage: number
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          actions?: string[] | null
          completed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          max_stage?: number
          sequence_multiplier?: number
          sequence_type: string
          stage?: number
          started_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          actions?: string[] | null
          completed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          max_stage?: number
          sequence_multiplier?: number
          sequence_type?: string
          stage?: number
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pplp_device_registry: {
        Row: {
          device_hash: string
          first_seen: string
          flag_reason: string | null
          id: string
          is_flagged: boolean
          last_seen: string
          usage_count: number
          user_id: string
        }
        Insert: {
          device_hash: string
          first_seen?: string
          flag_reason?: string | null
          id?: string
          is_flagged?: boolean
          last_seen?: string
          usage_count?: number
          user_id: string
        }
        Update: {
          device_hash?: string
          first_seen?: string
          flag_reason?: string | null
          id?: string
          is_flagged?: boolean
          last_seen?: string
          usage_count?: number
          user_id?: string
        }
        Relationships: []
      }
      pplp_disputes: {
        Row: {
          action_id: string
          assigned_to: string | null
          created_at: string
          evidence: Json
          id: string
          reason: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["pplp_dispute_status"]
          submitted_by: string
          updated_at: string
        }
        Insert: {
          action_id: string
          assigned_to?: string | null
          created_at?: string
          evidence?: Json
          id?: string
          reason: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["pplp_dispute_status"]
          submitted_by: string
          updated_at?: string
        }
        Update: {
          action_id?: string
          assigned_to?: string | null
          created_at?: string
          evidence?: Json
          id?: string
          reason?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["pplp_dispute_status"]
          submitted_by?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pplp_disputes_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "pplp_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pplp_disputes_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "user_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      pplp_epoch_caps: {
        Row: {
          action_counts: Json
          created_at: string
          epoch_date: string
          epoch_type: string
          id: string
          total_minted: number
          unique_users: number
          updated_at: string
        }
        Insert: {
          action_counts?: Json
          created_at?: string
          epoch_date?: string
          epoch_type?: string
          id?: string
          total_minted?: number
          unique_users?: number
          updated_at?: string
        }
        Update: {
          action_counts?: Json
          created_at?: string
          epoch_date?: string
          epoch_type?: string
          id?: string
          total_minted?: number
          unique_users?: number
          updated_at?: string
        }
        Relationships: []
      }
      pplp_events: {
        Row: {
          actor_user_id: string
          context_id: string | null
          created_at: string
          event_id: string
          event_type: string
          ingest_hash: string | null
          occurred_at: string
          payload_json: Json | null
          scoring_tags: string[] | null
          signature: string | null
          source: string | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          actor_user_id: string
          context_id?: string | null
          created_at?: string
          event_id?: string
          event_type: string
          ingest_hash?: string | null
          occurred_at?: string
          payload_json?: Json | null
          scoring_tags?: string[] | null
          signature?: string | null
          source?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          actor_user_id?: string
          context_id?: string | null
          created_at?: string
          event_id?: string
          event_type?: string
          ingest_hash?: string | null
          occurred_at?: string
          payload_json?: Json | null
          scoring_tags?: string[] | null
          signature?: string | null
          source?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      pplp_evidences: {
        Row: {
          action_id: string
          anchor_chain: string | null
          anchor_tx_hash: string | null
          anchored_at: string | null
          content_hash: string
          created_at: string
          evidence_type: string
          evidence_type_enum:
            | Database["public"]["Enums"]["pplp_evidence_type"]
            | null
          id: string
          metadata: Json
          uri: string | null
        }
        Insert: {
          action_id: string
          anchor_chain?: string | null
          anchor_tx_hash?: string | null
          anchored_at?: string | null
          content_hash: string
          created_at?: string
          evidence_type: string
          evidence_type_enum?:
            | Database["public"]["Enums"]["pplp_evidence_type"]
            | null
          id?: string
          metadata?: Json
          uri?: string | null
        }
        Update: {
          action_id?: string
          anchor_chain?: string | null
          anchor_tx_hash?: string | null
          anchored_at?: string | null
          content_hash?: string
          created_at?: string
          evidence_type?: string
          evidence_type_enum?:
            | Database["public"]["Enums"]["pplp_evidence_type"]
            | null
          id?: string
          metadata?: Json
          uri?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pplp_evidences_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "pplp_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pplp_evidences_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "user_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      pplp_fraud_signals: {
        Row: {
          action_id: string | null
          actor_id: string
          created_at: string
          details: Json
          id: string
          is_resolved: boolean
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: number
          signal_type: string
          source: string
        }
        Insert: {
          action_id?: string | null
          actor_id: string
          created_at?: string
          details?: Json
          id?: string
          is_resolved?: boolean
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: number
          signal_type: string
          source?: string
        }
        Update: {
          action_id?: string | null
          actor_id?: string
          created_at?: string
          details?: Json
          id?: string
          is_resolved?: boolean
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: number
          signal_type?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "pplp_fraud_signals_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "pplp_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pplp_fraud_signals_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "user_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      pplp_groups: {
        Row: {
          created_at: string
          event_id: string
          group_confidence: number
          group_name: string
          id: string
          leader_confirmed: boolean
          leader_user_id: string
          metadata: Json | null
          participant_estimate: number
          photo_proof_url: string | null
          updated_at: string
          video_proof_url: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          group_confidence?: number
          group_name: string
          id?: string
          leader_confirmed?: boolean
          leader_user_id: string
          metadata?: Json | null
          participant_estimate?: number
          photo_proof_url?: string | null
          updated_at?: string
          video_proof_url?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          group_confidence?: number
          group_name?: string
          id?: string
          leader_confirmed?: boolean
          leader_user_id?: string
          metadata?: Json | null
          participant_estimate?: number
          photo_proof_url?: string | null
          updated_at?: string
          video_proof_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pplp_groups_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "attendance_events"
            referencedColumns: ["id"]
          },
        ]
      }
      pplp_light_levels: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          level: number
          max_score: number | null
          min_score: number
          name_en: string
          name_vi: string
          perks: Json | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          level: number
          max_score?: number | null
          min_score?: number
          name_en: string
          name_vi: string
          perks?: Json | null
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          level?: number
          max_score?: number | null
          min_score?: number
          name_en?: string
          name_vi?: string
          perks?: Json | null
        }
        Relationships: []
      }
      pplp_mint_allocations: {
        Row: {
          allocation_ratio: number
          created_at: string
          cycle_id: string
          eligible: boolean | null
          fun_allocated: number
          id: string
          ineligibility_reason: string | null
          status: string
          updated_at: string
          user_id: string
          user_light_contribution: number
        }
        Insert: {
          allocation_ratio?: number
          created_at?: string
          cycle_id: string
          eligible?: boolean | null
          fun_allocated?: number
          id?: string
          ineligibility_reason?: string | null
          status?: string
          updated_at?: string
          user_id: string
          user_light_contribution?: number
        }
        Update: {
          allocation_ratio?: number
          created_at?: string
          cycle_id?: string
          eligible?: boolean | null
          fun_allocated?: number
          id?: string
          ineligibility_reason?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          user_light_contribution?: number
        }
        Relationships: [
          {
            foreignKeyName: "pplp_mint_allocations_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "pplp_mint_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      pplp_mint_audit: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          reason: string | null
          request_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          reason?: string | null
          request_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          reason?: string | null
          request_id?: string
        }
        Relationships: []
      }
      pplp_mint_cycle_snapshots: {
        Row: {
          allocations: Json
          created_at: string
          cycle_id: string
          cycle_number: number
          cycle_type: string
          end_date: string
          id: string
          max_fun_per_user: number
          max_share_per_user: number
          min_fun_per_user: number
          note: string | null
          start_date: string
          total_fun_distributed: number
          total_light_contribution: number
          total_mint_pool: number
          users_capped: number
          users_eligible: number
          users_total: number
        }
        Insert: {
          allocations: Json
          created_at?: string
          cycle_id: string
          cycle_number: number
          cycle_type: string
          end_date: string
          id?: string
          max_fun_per_user: number
          max_share_per_user: number
          min_fun_per_user: number
          note?: string | null
          start_date: string
          total_fun_distributed: number
          total_light_contribution: number
          total_mint_pool: number
          users_capped: number
          users_eligible: number
          users_total: number
        }
        Update: {
          allocations?: Json
          created_at?: string
          cycle_id?: string
          cycle_number?: number
          cycle_type?: string
          end_date?: string
          id?: string
          max_fun_per_user?: number
          max_share_per_user?: number
          min_fun_per_user?: number
          note?: string | null
          start_date?: string
          total_fun_distributed?: number
          total_light_contribution?: number
          total_mint_pool?: number
          users_capped?: number
          users_eligible?: number
          users_total?: number
        }
        Relationships: []
      }
      pplp_mint_cycles: {
        Row: {
          created_at: string
          cycle_number: number
          cycle_type: string
          end_date: string
          id: string
          max_share_per_user: number
          start_date: string
          status: string
          total_light_contribution: number
          total_mint_pool: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          cycle_number: number
          cycle_type?: string
          end_date: string
          id?: string
          max_share_per_user?: number
          start_date: string
          status?: string
          total_light_contribution?: number
          total_mint_pool?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          cycle_number?: number
          cycle_type?: string
          end_date?: string
          id?: string
          max_share_per_user?: number
          start_date?: string
          status?: string
          total_light_contribution?: number
          total_mint_pool?: number
          updated_at?: string
        }
        Relationships: []
      }
      pplp_mint_requests: {
        Row: {
          action_hash: string
          action_id: string
          actor_id: string
          amount: number
          amount_wei: string | null
          created_at: string
          destination_note: string | null
          evidence_hash: string
          fun_profile_sync_status: string | null
          id: string
          mint_destination: string
          minted_at: string | null
          multisig_completed_groups: string[] | null
          multisig_required_groups: string[] | null
          multisig_signatures: Json | null
          nonce: number
          on_chain_error: string | null
          platform_id: string | null
          policy_version: number
          recipient_address: string
          signature: string | null
          signer_address: string | null
          status: string
          tx_hash: string | null
          updated_at: string
          valid_after: string
          valid_before: string
        }
        Insert: {
          action_hash: string
          action_id: string
          actor_id: string
          amount: number
          amount_wei?: string | null
          created_at?: string
          destination_note?: string | null
          evidence_hash: string
          fun_profile_sync_status?: string | null
          id?: string
          mint_destination?: string
          minted_at?: string | null
          multisig_completed_groups?: string[] | null
          multisig_required_groups?: string[] | null
          multisig_signatures?: Json | null
          nonce: number
          on_chain_error?: string | null
          platform_id?: string | null
          policy_version?: number
          recipient_address: string
          signature?: string | null
          signer_address?: string | null
          status?: string
          tx_hash?: string | null
          updated_at?: string
          valid_after?: string
          valid_before?: string
        }
        Update: {
          action_hash?: string
          action_id?: string
          actor_id?: string
          amount?: number
          amount_wei?: string | null
          created_at?: string
          destination_note?: string | null
          evidence_hash?: string
          fun_profile_sync_status?: string | null
          id?: string
          mint_destination?: string
          minted_at?: string | null
          multisig_completed_groups?: string[] | null
          multisig_required_groups?: string[] | null
          multisig_signatures?: Json | null
          nonce?: number
          on_chain_error?: string | null
          platform_id?: string | null
          policy_version?: number
          recipient_address?: string
          signature?: string | null
          signer_address?: string | null
          status?: string
          tx_hash?: string | null
          updated_at?: string
          valid_after?: string
          valid_before?: string
        }
        Relationships: [
          {
            foreignKeyName: "pplp_mint_requests_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: true
            referencedRelation: "pplp_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pplp_mint_requests_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: true
            referencedRelation: "user_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      pplp_parameter_config: {
        Row: {
          description: string | null
          key: string
          phase: string | null
          updated_at: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          phase?: string | null
          updated_at?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          phase?: string | null
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      pplp_policies: {
        Row: {
          action_configs: Json | null
          activated_at: string | null
          approved_by: string[] | null
          arweave_tx: string | null
          caps: Json | null
          changelog: string | null
          created_at: string
          created_by: string | null
          deprecated_at: string | null
          deprecation_reason: string | null
          description: string | null
          formulas: Json | null
          ipfs_cid: string | null
          is_active: boolean
          policy_hash: string | null
          policy_json: Json
          required_approvals: number | null
          thresholds: Json | null
          updated_at: string | null
          version: string
          version_int: number | null
        }
        Insert: {
          action_configs?: Json | null
          activated_at?: string | null
          approved_by?: string[] | null
          arweave_tx?: string | null
          caps?: Json | null
          changelog?: string | null
          created_at?: string
          created_by?: string | null
          deprecated_at?: string | null
          deprecation_reason?: string | null
          description?: string | null
          formulas?: Json | null
          ipfs_cid?: string | null
          is_active?: boolean
          policy_hash?: string | null
          policy_json: Json
          required_approvals?: number | null
          thresholds?: Json | null
          updated_at?: string | null
          version: string
          version_int?: number | null
        }
        Update: {
          action_configs?: Json | null
          activated_at?: string | null
          approved_by?: string[] | null
          arweave_tx?: string | null
          caps?: Json | null
          changelog?: string | null
          created_at?: string
          created_by?: string | null
          deprecated_at?: string | null
          deprecation_reason?: string | null
          description?: string | null
          formulas?: Json | null
          ipfs_cid?: string | null
          is_active?: boolean
          policy_hash?: string | null
          policy_json?: Json
          required_approvals?: number | null
          thresholds?: Json | null
          updated_at?: string | null
          version?: string
          version_int?: number | null
        }
        Relationships: []
      }
      pplp_policy_changes: {
        Row: {
          block_number: number | null
          change_type: string
          changed_at: string
          changed_by: string | null
          field_changed: string | null
          id: string
          new_value: Json | null
          old_value: Json | null
          policy_version: string
          reason: string | null
          tx_hash: string | null
        }
        Insert: {
          block_number?: number | null
          change_type: string
          changed_at?: string
          changed_by?: string | null
          field_changed?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          policy_version: string
          reason?: string | null
          tx_hash?: string | null
        }
        Update: {
          block_number?: number | null
          change_type?: string
          changed_at?: string
          changed_by?: string | null
          field_changed?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          policy_version?: string
          reason?: string | null
          tx_hash?: string | null
        }
        Relationships: []
      }
      pplp_policy_onchain: {
        Row: {
          block_number: number
          chain_id: number
          contract_address: string
          id: string
          policy_hash: string
          policy_version: string
          registered_at: string
          signer_address: string
          tx_hash: string
        }
        Insert: {
          block_number: number
          chain_id?: number
          contract_address: string
          id?: string
          policy_hash: string
          policy_version: string
          registered_at?: string
          signer_address: string
          tx_hash: string
        }
        Update: {
          block_number?: number
          chain_id?: number
          contract_address?: string
          id?: string
          policy_hash?: string
          policy_version?: string
          registered_at?: string
          signer_address?: string
          tx_hash?: string
        }
        Relationships: []
      }
      pplp_ratings: {
        Row: {
          comment: string | null
          content_id: string
          created_at: string
          id: string
          pillar_heal_love: number
          pillar_life_service: number
          pillar_sustain: number
          pillar_truth: number
          pillar_unity_source: number
          rater_user_id: string
          weight_applied: number | null
        }
        Insert: {
          comment?: string | null
          content_id: string
          created_at?: string
          id?: string
          pillar_heal_love?: number
          pillar_life_service?: number
          pillar_sustain?: number
          pillar_truth?: number
          pillar_unity_source?: number
          rater_user_id: string
          weight_applied?: number | null
        }
        Update: {
          comment?: string | null
          content_id?: string
          created_at?: string
          id?: string
          pillar_heal_love?: number
          pillar_life_service?: number
          pillar_sustain?: number
          pillar_truth?: number
          pillar_unity_source?: number
          rater_user_id?: string
          weight_applied?: number | null
        }
        Relationships: []
      }
      pplp_scores: {
        Row: {
          action_id: string
          anti_abuse_factor: number | null
          authenticity_score: number | null
          base_reward: number
          base_value: number | null
          consistency_multiplier: number | null
          created_at: string
          decision: Database["public"]["Enums"]["pplp_decision"]
          decision_reason: string | null
          depth_score: number | null
          ego_signal: number | null
          event_reputation_premium: number | null
          final_reward: number
          id: string
          impact_multiplier: number | null
          impact_score: number | null
          integrity_penalty: number | null
          intent_integrity_score: number | null
          intent_score: number | null
          light_score: number
          love_tone: number | null
          multiplier_i: number
          multiplier_k: number
          multiplier_q: number
          pillar_c: number
          pillar_giving: number | null
          pillar_gratitude: number | null
          pillar_h: number
          pillar_helping: number | null
          pillar_repentance: number | null
          pillar_s: number
          pillar_service: number | null
          pillar_t: number
          pillar_u: number
          policy_version: string
          quality_factor: number | null
          reputation_weight: number | null
          scored_by: string
          scoring_engine_version: string | null
          trust_context: number | null
          trust_factor: number | null
          vvu_score: number | null
        }
        Insert: {
          action_id: string
          anti_abuse_factor?: number | null
          authenticity_score?: number | null
          base_reward?: number
          base_value?: number | null
          consistency_multiplier?: number | null
          created_at?: string
          decision?: Database["public"]["Enums"]["pplp_decision"]
          decision_reason?: string | null
          depth_score?: number | null
          ego_signal?: number | null
          event_reputation_premium?: number | null
          final_reward?: number
          id?: string
          impact_multiplier?: number | null
          impact_score?: number | null
          integrity_penalty?: number | null
          intent_integrity_score?: number | null
          intent_score?: number | null
          light_score?: number
          love_tone?: number | null
          multiplier_i?: number
          multiplier_k?: number
          multiplier_q?: number
          pillar_c?: number
          pillar_giving?: number | null
          pillar_gratitude?: number | null
          pillar_h?: number
          pillar_helping?: number | null
          pillar_repentance?: number | null
          pillar_s?: number
          pillar_service?: number | null
          pillar_t?: number
          pillar_u?: number
          policy_version?: string
          quality_factor?: number | null
          reputation_weight?: number | null
          scored_by?: string
          scoring_engine_version?: string | null
          trust_context?: number | null
          trust_factor?: number | null
          vvu_score?: number | null
        }
        Update: {
          action_id?: string
          anti_abuse_factor?: number | null
          authenticity_score?: number | null
          base_reward?: number
          base_value?: number | null
          consistency_multiplier?: number | null
          created_at?: string
          decision?: Database["public"]["Enums"]["pplp_decision"]
          decision_reason?: string | null
          depth_score?: number | null
          ego_signal?: number | null
          event_reputation_premium?: number | null
          final_reward?: number
          id?: string
          impact_multiplier?: number | null
          impact_score?: number | null
          integrity_penalty?: number | null
          intent_integrity_score?: number | null
          intent_score?: number | null
          light_score?: number
          love_tone?: number | null
          multiplier_i?: number
          multiplier_k?: number
          multiplier_q?: number
          pillar_c?: number
          pillar_giving?: number | null
          pillar_gratitude?: number | null
          pillar_h?: number
          pillar_helping?: number | null
          pillar_repentance?: number | null
          pillar_s?: number
          pillar_service?: number | null
          pillar_t?: number
          pillar_u?: number
          policy_version?: string
          quality_factor?: number | null
          reputation_weight?: number | null
          scored_by?: string
          scoring_engine_version?: string | null
          trust_context?: number | null
          trust_factor?: number | null
          vvu_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pplp_scores_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: true
            referencedRelation: "pplp_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pplp_scores_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: true
            referencedRelation: "user_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      pplp_signers: {
        Row: {
          address: string
          created_at: string
          deactivated_at: string | null
          id: string
          is_active: boolean
          name: string
          weight: number
        }
        Insert: {
          address: string
          created_at?: string
          deactivated_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          weight?: number
        }
        Update: {
          address?: string
          created_at?: string
          deactivated_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          weight?: number
        }
        Relationships: []
      }
      pplp_threshold_audit: {
        Row: {
          action_type: string
          changed_at: string
          changed_by: string | null
          environment: string
          id: string
          new_thresholds: Json
          old_thresholds: Json | null
          platform_id: string
          reason: string | null
        }
        Insert: {
          action_type: string
          changed_at?: string
          changed_by?: string | null
          environment?: string
          id?: string
          new_thresholds: Json
          old_thresholds?: Json | null
          platform_id?: string
          reason?: string | null
        }
        Update: {
          action_type?: string
          changed_at?: string
          changed_by?: string | null
          environment?: string
          id?: string
          new_thresholds?: Json
          old_thresholds?: Json | null
          platform_id?: string
          reason?: string | null
        }
        Relationships: []
      }
      pplp_user_caps: {
        Row: {
          action_counts: Json
          created_at: string
          epoch_date: string
          epoch_type: string
          id: string
          last_action_at: string | null
          total_minted: number
          updated_at: string
          user_id: string
        }
        Insert: {
          action_counts?: Json
          created_at?: string
          epoch_date?: string
          epoch_type?: string
          id?: string
          last_action_at?: string | null
          total_minted?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          action_counts?: Json
          created_at?: string
          epoch_date?: string
          epoch_type?: string
          id?: string
          last_action_at?: string | null
          total_minted?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pplp_user_nonces: {
        Row: {
          current_nonce: number
          last_used_at: string
          user_id: string
        }
        Insert: {
          current_nonce?: number
          last_used_at?: string
          user_id: string
        }
        Update: {
          current_nonce?: number
          last_used_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pplp_user_tiers: {
        Row: {
          cap_multiplier: number
          community_vouches: number
          contribution_days_30: number | null
          contribution_days_90: number | null
          created_at: string
          failed_actions: number
          fraud_flags: number
          known_device_hashes: string[] | null
          last_device_hash: string | null
          last_tier_change: string | null
          passed_actions: number
          stake_locked_until: string | null
          staked_amount: number
          tier: number
          tier_change_reason: string | null
          total_actions_scored: number
          trust_score: number
          updated_at: string
          user_id: string
          verified_connections: number
        }
        Insert: {
          cap_multiplier?: number
          community_vouches?: number
          contribution_days_30?: number | null
          contribution_days_90?: number | null
          created_at?: string
          failed_actions?: number
          fraud_flags?: number
          known_device_hashes?: string[] | null
          last_device_hash?: string | null
          last_tier_change?: string | null
          passed_actions?: number
          stake_locked_until?: string | null
          staked_amount?: number
          tier?: number
          tier_change_reason?: string | null
          total_actions_scored?: number
          trust_score?: number
          updated_at?: string
          user_id: string
          verified_connections?: number
        }
        Update: {
          cap_multiplier?: number
          community_vouches?: number
          contribution_days_30?: number | null
          contribution_days_90?: number | null
          created_at?: string
          failed_actions?: number
          fraud_flags?: number
          known_device_hashes?: string[] | null
          last_device_hash?: string | null
          last_tier_change?: string | null
          passed_actions?: number
          stake_locked_until?: string | null
          staked_amount?: number
          tier?: number
          tier_change_reason?: string | null
          total_actions_scored?: number
          trust_score?: number
          updated_at?: string
          user_id?: string
          verified_connections?: number
        }
        Relationships: []
      }
      profile_public_settings: {
        Row: {
          allow_public_follow: boolean
          allow_public_message: boolean
          allow_public_transfer: boolean
          badge_type: string | null
          created_at: string
          enabled_modules: Json | null
          featured_items: Json | null
          public_profile_enabled: boolean
          show_donation_button: boolean
          show_friends_count: boolean
          show_modules: boolean
          show_stats: boolean
          tagline: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          allow_public_follow?: boolean
          allow_public_message?: boolean
          allow_public_transfer?: boolean
          badge_type?: string | null
          created_at?: string
          enabled_modules?: Json | null
          featured_items?: Json | null
          public_profile_enabled?: boolean
          show_donation_button?: boolean
          show_friends_count?: boolean
          show_modules?: boolean
          show_stats?: boolean
          tagline?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          allow_public_follow?: boolean
          allow_public_message?: boolean
          allow_public_transfer?: boolean
          badge_type?: string | null
          created_at?: string
          enabled_modules?: Json | null
          featured_items?: Json | null
          public_profile_enabled?: boolean
          show_donation_button?: boolean
          show_friends_count?: boolean
          show_modules?: boolean
          show_stats?: boolean
          tagline?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profile_view_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          profile_user_id: string
          referrer_handle: string | null
          viewer_user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          profile_user_id: string
          referrer_handle?: string | null
          viewer_user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          profile_user_id?: string
          referrer_handle?: string | null
          viewer_user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active_achievement_code: string | null
          active_title: string | null
          ascension_tier: number
          avatar_url: string | null
          bio: string | null
          connector_count: number
          connector_window_expires_at: string | null
          cover_photo_url: string | null
          created_at: string
          display_name: string | null
          handle: string | null
          handle_updated_at: string | null
          has_connector: boolean
          id: string
          mantra_ack_at: string | null
          popl_badge_level: string | null
          popl_verified: boolean | null
          popl_verified_at: string | null
          pplp_accepted_at: string | null
          pplp_version: string | null
          referred_by: string | null
          reputation_level: string | null
          reputation_score: number | null
          response_style: string | null
          social_links: Json | null
          soul_tags: string[] | null
          total_fun_minted: number
          trust_level: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active_achievement_code?: string | null
          active_title?: string | null
          ascension_tier?: number
          avatar_url?: string | null
          bio?: string | null
          connector_count?: number
          connector_window_expires_at?: string | null
          cover_photo_url?: string | null
          created_at?: string
          display_name?: string | null
          handle?: string | null
          handle_updated_at?: string | null
          has_connector?: boolean
          id?: string
          mantra_ack_at?: string | null
          popl_badge_level?: string | null
          popl_verified?: boolean | null
          popl_verified_at?: string | null
          pplp_accepted_at?: string | null
          pplp_version?: string | null
          referred_by?: string | null
          reputation_level?: string | null
          reputation_score?: number | null
          response_style?: string | null
          social_links?: Json | null
          soul_tags?: string[] | null
          total_fun_minted?: number
          trust_level?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active_achievement_code?: string | null
          active_title?: string | null
          ascension_tier?: number
          avatar_url?: string | null
          bio?: string | null
          connector_count?: number
          connector_window_expires_at?: string | null
          cover_photo_url?: string | null
          created_at?: string
          display_name?: string | null
          handle?: string | null
          handle_updated_at?: string | null
          has_connector?: boolean
          id?: string
          mantra_ack_at?: string | null
          popl_badge_level?: string | null
          popl_verified?: boolean | null
          popl_verified_at?: string | null
          pplp_accepted_at?: string | null
          pplp_version?: string | null
          referred_by?: string | null
          reputation_level?: string | null
          reputation_score?: number | null
          response_style?: string | null
          social_links?: Json | null
          soul_tags?: string[] | null
          total_fun_minted?: number
          trust_level?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_donations: {
        Row: {
          amount: number
          created_at: string
          donation_type: string
          donor_id: string
          id: string
          message: string | null
          status: string
          tx_hash: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          donation_type?: string
          donor_id: string
          id?: string
          message?: string | null
          status?: string
          tx_hash?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          donation_type?: string
          donor_id?: string
          id?: string
          message?: string | null
          status?: string
          tx_hash?: string | null
        }
        Relationships: []
      }
      project_fund: {
        Row: {
          balance: number
          created_at: string
          id: string
          total_distributed: number
          total_received: number
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          total_distributed?: number
          total_received?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          total_distributed?: number
          total_received?: number
          updated_at?: string
        }
        Relationships: []
      }
      pronoun_audit_log: {
        Row: {
          context: string | null
          created_at: string
          full_message: string
          function_name: string
          id: string
          is_reviewed: boolean
          message_preview: string
          severity: string
          target_user_id: string | null
          user_id: string | null
          violations: Json
        }
        Insert: {
          context?: string | null
          created_at?: string
          full_message: string
          function_name: string
          id?: string
          is_reviewed?: boolean
          message_preview: string
          severity?: string
          target_user_id?: string | null
          user_id?: string | null
          violations?: Json
        }
        Update: {
          context?: string | null
          created_at?: string
          full_message?: string
          function_name?: string
          id?: string
          is_reviewed?: boolean
          message_preview?: string
          severity?: string
          target_user_id?: string | null
          user_id?: string | null
          violations?: Json
        }
        Relationships: []
      }
      proofs: {
        Row: {
          action_id: string
          created_at: string
          file_hash: string | null
          id: string
          metadata: Json | null
          proof_type: string
          proof_url: string | null
          status: string
          updated_at: string
          user_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          action_id: string
          created_at?: string
          file_hash?: string | null
          id?: string
          metadata?: Json | null
          proof_type?: string
          proof_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          action_id?: string
          created_at?: string
          file_hash?: string | null
          id?: string
          metadata?: Json | null
          proof_type?: string
          proof_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proofs_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "pplp_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proofs_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "user_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      quest_evidence_audit: {
        Row: {
          ai_model: string | null
          ai_score: number | null
          claim_id: string
          decision: string
          id: string
          raw_response: Json | null
          reviewed_at: string
          risk_score: number | null
        }
        Insert: {
          ai_model?: string | null
          ai_score?: number | null
          claim_id: string
          decision: string
          id?: string
          raw_response?: Json | null
          reviewed_at?: string
          risk_score?: number | null
        }
        Update: {
          ai_model?: string | null
          ai_score?: number | null
          claim_id?: string
          decision?: string
          id?: string
          raw_response?: Json | null
          reviewed_at?: string
          risk_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quest_evidence_audit_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "user_daily_quests"
            referencedColumns: ["id"]
          },
        ]
      }
      quest_rotate_runs: {
        Row: {
          assigned_count: number
          created_at: string
          error_text: string | null
          id: string
          mode: string
          success: boolean
          user_id: string | null
          users_count: number
        }
        Insert: {
          assigned_count?: number
          created_at?: string
          error_text?: string | null
          id?: string
          mode: string
          success?: boolean
          user_id?: string | null
          users_count?: number
        }
        Update: {
          assigned_count?: number
          created_at?: string
          error_text?: string | null
          id?: string
          mode?: string
          success?: boolean
          user_id?: string | null
          users_count?: number
        }
        Relationships: []
      }
      quest_templates: {
        Row: {
          active: boolean
          base_camly: number
          base_xp: number
          code: string
          created_at: string
          daily_cap: number
          description_en: string | null
          description_vi: string | null
          dimension: string
          evidence_type: string | null
          icon: string | null
          id: string
          phase: number
          requires_evidence: boolean
          title_en: string
          title_vi: string
          weight: number
        }
        Insert: {
          active?: boolean
          base_camly?: number
          base_xp?: number
          code: string
          created_at?: string
          daily_cap?: number
          description_en?: string | null
          description_vi?: string | null
          dimension: string
          evidence_type?: string | null
          icon?: string | null
          id?: string
          phase?: number
          requires_evidence?: boolean
          title_en: string
          title_vi: string
          weight?: number
        }
        Update: {
          active?: boolean
          base_camly?: number
          base_xp?: number
          code?: string
          created_at?: string
          daily_cap?: number
          description_en?: string | null
          description_vi?: string | null
          dimension?: string
          evidence_type?: string | null
          icon?: string | null
          id?: string
          phase?: number
          requires_evidence?: boolean
          title_en?: string
          title_vi?: string
          weight?: number
        }
        Relationships: []
      }
      question_likes: {
        Row: {
          created_at: string
          id: string
          question_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          question_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          question_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_likes_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "chat_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      rag_health_events: {
        Row: {
          created_at: string
          detail: Json
          id: string
          status: string
        }
        Insert: {
          created_at?: string
          detail?: Json
          id?: string
          status: string
        }
        Update: {
          created_at?: string
          detail?: Json
          id?: string
          status?: string
        }
        Relationships: []
      }
      raid_attacks: {
        Row: {
          boss_id: string
          created_at: string
          damage: number
          id: string
          ref_id: string
          source: string
          user_id: string
        }
        Insert: {
          boss_id: string
          created_at?: string
          damage: number
          id?: string
          ref_id: string
          source: string
          user_id: string
        }
        Update: {
          boss_id?: string
          created_at?: string
          damage?: number
          id?: string
          ref_id?: string
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "raid_attacks_boss_id_fkey"
            columns: ["boss_id"]
            isOneToOne: false
            referencedRelation: "raid_bosses"
            referencedColumns: ["id"]
          },
        ]
      }
      raid_bosses: {
        Row: {
          art_url: string | null
          code: string
          created_at: string
          current_hp: number
          defeated_at: string | null
          ends_at: string
          id: string
          lore: string | null
          name: string
          season_id: string | null
          starts_at: string
          status: string
          total_hp: number
        }
        Insert: {
          art_url?: string | null
          code: string
          created_at?: string
          current_hp: number
          defeated_at?: string | null
          ends_at: string
          id?: string
          lore?: string | null
          name: string
          season_id?: string | null
          starts_at?: string
          status?: string
          total_hp: number
        }
        Update: {
          art_url?: string | null
          code?: string
          created_at?: string
          current_hp?: number
          defeated_at?: string | null
          ends_at?: string
          id?: string
          lore?: string | null
          name?: string
          season_id?: string | null
          starts_at?: string
          status?: string
          total_hp?: number
        }
        Relationships: [
          {
            foreignKeyName: "raid_bosses_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "game_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      raid_contributions: {
        Row: {
          attack_count: number
          boss_id: string
          last_hit_at: string | null
          total_damage: number
          user_id: string
        }
        Insert: {
          attack_count?: number
          boss_id: string
          last_hit_at?: string | null
          total_damage?: number
          user_id: string
        }
        Update: {
          attack_count?: number
          boss_id?: string
          last_hit_at?: string | null
          total_damage?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "raid_contributions_boss_id_fkey"
            columns: ["boss_id"]
            isOneToOne: false
            referencedRelation: "raid_bosses"
            referencedColumns: ["id"]
          },
        ]
      }
      raid_loot_claims: {
        Row: {
          boss_id: string
          claimed_at: string
          id: string
          loot_id: string
          user_id: string
        }
        Insert: {
          boss_id: string
          claimed_at?: string
          id?: string
          loot_id: string
          user_id: string
        }
        Update: {
          boss_id?: string
          claimed_at?: string
          id?: string
          loot_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "raid_loot_claims_boss_id_fkey"
            columns: ["boss_id"]
            isOneToOne: false
            referencedRelation: "raid_bosses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raid_loot_claims_loot_id_fkey"
            columns: ["loot_id"]
            isOneToOne: false
            referencedRelation: "raid_loot_table"
            referencedColumns: ["id"]
          },
        ]
      }
      raid_loot_table: {
        Row: {
          boss_id: string
          created_at: string
          expired_eligible: boolean
          id: string
          label: string
          min_contribution_pct: number
          position: number
          reward_type: string
          reward_value: Json
          tier: string
        }
        Insert: {
          boss_id: string
          created_at?: string
          expired_eligible?: boolean
          id?: string
          label: string
          min_contribution_pct: number
          position?: number
          reward_type: string
          reward_value?: Json
          tier: string
        }
        Update: {
          boss_id?: string
          created_at?: string
          expired_eligible?: boolean
          id?: string
          label?: string
          min_contribution_pct?: number
          position?: number
          reward_type?: string
          reward_value?: Json
          tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "raid_loot_table_boss_id_fkey"
            columns: ["boss_id"]
            isOneToOne: false
            referencedRelation: "raid_bosses"
            referencedColumns: ["id"]
          },
        ]
      }
      recovery_approvals: {
        Row: {
          created_at: string
          decision: string
          guardian_user_id: string
          id: string
          reason: string | null
          request_id: string
        }
        Insert: {
          created_at?: string
          decision: string
          guardian_user_id: string
          id?: string
          reason?: string | null
          request_id: string
        }
        Update: {
          created_at?: string
          decision?: string
          guardian_user_id?: string
          id?: string
          reason?: string | null
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recovery_approvals_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "recovery_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      recovery_requests: {
        Row: {
          approvals_count: number
          approved_at: string | null
          created_at: string
          executed_at: string | null
          expires_at: string
          id: string
          payload: Json
          reason: string | null
          rejections_count: number
          request_type: string
          required_approvals: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approvals_count?: number
          approved_at?: string | null
          created_at?: string
          executed_at?: string | null
          expires_at?: string
          id?: string
          payload?: Json
          reason?: string | null
          rejections_count?: number
          request_type: string
          required_approvals?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approvals_count?: number
          approved_at?: string | null
          created_at?: string
          executed_at?: string | null
          expires_at?: string
          id?: string
          payload?: Json
          reason?: string | null
          rejections_count?: number
          request_type?: string
          required_approvals?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reserved_handles: {
        Row: {
          created_at: string
          word: string
        }
        Insert: {
          created_at?: string
          word: string
        }
        Update: {
          created_at?: string
          word?: string
        }
        Relationships: []
      }
      reward_vesting_schedules: {
        Row: {
          base_vesting_days: number
          claimable_amount: number
          claimed_amount: number
          created_at: string
          cycle_id: string | null
          dormant_at: string | null
          epoch_id: string
          fully_unlocked_at: string | null
          id: string
          instant_amount: number
          last_unlock_check_at: string | null
          locked_amount: number
          next_unlock_at: string | null
          status: string
          total_amount: number
          unlock_check_interval_days: number
          unlock_method: string
          unlocked_so_far: number
          updated_at: string
          user_id: string
        }
        Insert: {
          base_vesting_days?: number
          claimable_amount?: number
          claimed_amount?: number
          created_at?: string
          cycle_id?: string | null
          dormant_at?: string | null
          epoch_id: string
          fully_unlocked_at?: string | null
          id?: string
          instant_amount: number
          last_unlock_check_at?: string | null
          locked_amount: number
          next_unlock_at?: string | null
          status?: string
          total_amount: number
          unlock_check_interval_days?: number
          unlock_method?: string
          unlocked_so_far?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          base_vesting_days?: number
          claimable_amount?: number
          claimed_amount?: number
          created_at?: string
          cycle_id?: string | null
          dormant_at?: string | null
          epoch_id?: string
          fully_unlocked_at?: string | null
          id?: string
          instant_amount?: number
          last_unlock_check_at?: string | null
          locked_amount?: number
          next_unlock_at?: string | null
          status?: string
          total_amount?: number
          unlock_check_interval_days?: number
          unlock_method?: string
          unlocked_so_far?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sbt_onchain_queue: {
        Row: {
          block_number: number | null
          contract_address: string | null
          created_at: string
          did_id: string
          enqueued_at: string
          error_message: string | null
          id: string
          metadata_uri: string | null
          minted_at: string | null
          network: string
          on_chain_token_id: string | null
          processed_at: string | null
          retry_count: number
          sbt_id: string
          status: string
          tx_hash: string | null
          user_id: string
          wallet_address: string
        }
        Insert: {
          block_number?: number | null
          contract_address?: string | null
          created_at?: string
          did_id: string
          enqueued_at?: string
          error_message?: string | null
          id?: string
          metadata_uri?: string | null
          minted_at?: string | null
          network?: string
          on_chain_token_id?: string | null
          processed_at?: string | null
          retry_count?: number
          sbt_id: string
          status?: string
          tx_hash?: string | null
          user_id: string
          wallet_address: string
        }
        Update: {
          block_number?: number | null
          contract_address?: string | null
          created_at?: string
          did_id?: string
          enqueued_at?: string
          error_message?: string | null
          id?: string
          metadata_uri?: string | null
          minted_at?: string | null
          network?: string
          on_chain_token_id?: string | null
          processed_at?: string | null
          retry_count?: number
          sbt_id?: string
          status?: string
          tx_hash?: string | null
          user_id?: string
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "sbt_onchain_queue_did_id_fkey"
            columns: ["did_id"]
            isOneToOne: false
            referencedRelation: "user_dids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sbt_onchain_queue_sbt_id_fkey"
            columns: ["sbt_id"]
            isOneToOne: false
            referencedRelation: "sbt_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      sbt_registry: {
        Row: {
          created_at: string
          did_id: string
          evidence_hash: string | null
          expires_at: string | null
          id: string
          issued_at: string
          issuer: string
          metadata: Json
          privacy_level: string
          revocation_reason: string | null
          revoked_at: string | null
          sbt_subtype: string
          sbt_type: string
          status: string
          token_id: string
          trust_weight: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          did_id: string
          evidence_hash?: string | null
          expires_at?: string | null
          id?: string
          issued_at?: string
          issuer?: string
          metadata?: Json
          privacy_level?: string
          revocation_reason?: string | null
          revoked_at?: string | null
          sbt_subtype: string
          sbt_type: string
          status?: string
          token_id: string
          trust_weight?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          did_id?: string
          evidence_hash?: string | null
          expires_at?: string | null
          id?: string
          issued_at?: string
          issuer?: string
          metadata?: Json
          privacy_level?: string
          revocation_reason?: string | null
          revoked_at?: string | null
          sbt_subtype?: string
          sbt_type?: string
          status?: string
          token_id?: string
          trust_weight?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sbt_registry_did_id_fkey"
            columns: ["did_id"]
            isOneToOne: false
            referencedRelation: "user_dids"
            referencedColumns: ["id"]
          },
        ]
      }
      score_explanations: {
        Row: {
          ai_ego_risk: number | null
          ai_explanation: string | null
          ai_pillar_scores: Json | null
          created_at: string
          id: string
          penalties_json: Json | null
          top_contributors_json: Json | null
          user_id: string
          version: string | null
        }
        Insert: {
          ai_ego_risk?: number | null
          ai_explanation?: string | null
          ai_pillar_scores?: Json | null
          created_at?: string
          id?: string
          penalties_json?: Json | null
          top_contributors_json?: Json | null
          user_id: string
          version?: string | null
        }
        Update: {
          ai_ego_risk?: number | null
          ai_explanation?: string | null
          ai_pillar_scores?: Json | null
          created_at?: string
          id?: string
          penalties_json?: Json | null
          top_contributors_json?: Json | null
          user_id?: string
          version?: string | null
        }
        Relationships: []
      }
      scoring_rules: {
        Row: {
          created_at: string
          description: string | null
          effective_after: string | null
          effective_from: string
          effective_to: string | null
          formula_json: Json
          multiplier_config_json: Json
          name: string
          penalty_config_json: Json
          rule_version: string
          status: string
          weight_config_json: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          effective_after?: string | null
          effective_from?: string
          effective_to?: string | null
          formula_json?: Json
          multiplier_config_json?: Json
          name: string
          penalty_config_json?: Json
          rule_version: string
          status?: string
          weight_config_json?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          effective_after?: string | null
          effective_from?: string
          effective_to?: string | null
          formula_json?: Json
          multiplier_config_json?: Json
          name?: string
          penalty_config_json?: Json
          rule_version?: string
          status?: string
          weight_config_json?: Json
        }
        Relationships: []
      }
      season_pass_rewards: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          label: string
          level: number
          reward_type: string
          reward_value: Json
          season_id: string
          track: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          label: string
          level: number
          reward_type: string
          reward_value?: Json
          season_id: string
          track: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          label?: string
          level?: number
          reward_type?: string
          reward_value?: Json
          season_id?: string
          track?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_pass_rewards_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "game_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      season_weekly_quest_templates: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_premium_only: boolean
          position: number
          season_id: string
          source: string
          target_count: number
          title: string
          week_index: number | null
          xp_reward: number
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_premium_only?: boolean
          position?: number
          season_id: string
          source: string
          target_count: number
          title: string
          week_index?: number | null
          xp_reward: number
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_premium_only?: boolean
          position?: number
          season_id?: string
          source?: string
          target_count?: number
          title?: string
          week_index?: number | null
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "season_weekly_quest_templates_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "game_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      slash_proposals: {
        Row: {
          applied_slash_pct: number | null
          created_at: string
          detected_at: string
          detection_type: string
          did_id: string
          evidence: Json
          id: string
          reason: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string
          slashed_amount: number | null
          stake_id: string
          status: string
          suggested_slash_pct: number
          user_id: string
        }
        Insert: {
          applied_slash_pct?: number | null
          created_at?: string
          detected_at?: string
          detection_type: string
          did_id: string
          evidence?: Json
          id?: string
          reason: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          slashed_amount?: number | null
          stake_id: string
          status?: string
          suggested_slash_pct?: number
          user_id: string
        }
        Update: {
          applied_slash_pct?: number | null
          created_at?: string
          detected_at?: string
          detection_type?: string
          did_id?: string
          evidence?: Json
          id?: string
          reason?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          slashed_amount?: number | null
          stake_id?: string
          status?: string
          suggested_slash_pct?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "slash_proposals_did_id_fkey"
            columns: ["did_id"]
            isOneToOne: false
            referencedRelation: "user_dids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slash_proposals_stake_id_fkey"
            columns: ["stake_id"]
            isOneToOne: false
            referencedRelation: "validator_stakes"
            referencedColumns: ["id"]
          },
        ]
      }
      slug_history: {
        Row: {
          content_id: string
          content_type: string
          created_at: string
          id: string
          new_slug: string
          old_slug: string
          user_id: string
        }
        Insert: {
          content_id: string
          content_type?: string
          created_at?: string
          id?: string
          new_slug: string
          old_slug: string
          user_id: string
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string
          id?: string
          new_slug?: string
          old_slug?: string
          user_id?: string
        }
        Relationships: []
      }
      soulbound_nfts: {
        Row: {
          contract_address: string | null
          created_at: string
          creation_timestamp: string
          did_hash: string
          did_id: string
          id: string
          is_active: boolean
          metadata_hash: string | null
          metadata_uri: string | null
          mint_block: number | null
          mint_status: string
          mint_tx_hash: string | null
          token_id: number | null
          trust_seed: string
          updated_at: string
          user_id: string
        }
        Insert: {
          contract_address?: string | null
          created_at?: string
          creation_timestamp?: string
          did_hash: string
          did_id: string
          id?: string
          is_active?: boolean
          metadata_hash?: string | null
          metadata_uri?: string | null
          mint_block?: number | null
          mint_status?: string
          mint_tx_hash?: string | null
          token_id?: number | null
          trust_seed: string
          updated_at?: string
          user_id: string
        }
        Update: {
          contract_address?: string | null
          created_at?: string
          creation_timestamp?: string
          did_hash?: string
          did_id?: string
          id?: string
          is_active?: boolean
          metadata_hash?: string | null
          metadata_uri?: string | null
          mint_block?: number | null
          mint_status?: string
          mint_tx_hash?: string | null
          token_id?: number | null
          trust_seed?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "soulbound_nfts_did_id_fkey"
            columns: ["did_id"]
            isOneToOne: false
            referencedRelation: "user_dids"
            referencedColumns: ["id"]
          },
        ]
      }
      sybil_pattern_registry: {
        Row: {
          created_at: string | null
          description: string | null
          flagged_by: string | null
          id: string
          is_active: boolean | null
          pattern_type: string
          pattern_value: string
          severity: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          flagged_by?: string | null
          id?: string
          is_active?: boolean | null
          pattern_type: string
          pattern_value: string
          severity?: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          flagged_by?: string | null
          id?: string
          is_active?: boolean | null
          pattern_type?: string
          pattern_value?: string
          severity?: string
        }
        Relationships: []
      }
      sync_state: {
        Row: {
          key: string
          updated_at: string | null
          value_num: number | null
          value_text: string | null
        }
        Insert: {
          key: string
          updated_at?: string | null
          value_num?: number | null
          value_text?: string | null
        }
        Update: {
          key?: string
          updated_at?: string | null
          value_num?: number | null
          value_text?: string | null
        }
        Relationships: []
      }
      system_job_runs: {
        Row: {
          created_at: string
          duration_ms: number | null
          error_count: number
          finished_at: string | null
          id: string
          job_name: string
          metadata: Json
          processed_count: number
          skipped_count: number
          started_at: string
          status: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error_count?: number
          finished_at?: string | null
          id?: string
          job_name: string
          metadata?: Json
          processed_count?: number
          skipped_count?: number
          started_at?: string
          status?: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error_count?: number
          finished_at?: string | null
          id?: string
          job_name?: string
          metadata?: Json
          processed_count?: number
          skipped_count?: number
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string | null
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      telegram_bot_audit: {
        Row: {
          chat_id: number | null
          command: string | null
          created_at: string
          payload: Json | null
          response: Json | null
          telegram_user_id: number | null
          update_id: number
        }
        Insert: {
          chat_id?: number | null
          command?: string | null
          created_at?: string
          payload?: Json | null
          response?: Json | null
          telegram_user_id?: number | null
          update_id: number
        }
        Update: {
          chat_id?: number | null
          command?: string | null
          created_at?: string
          payload?: Json | null
          response?: Json | null
          telegram_user_id?: number | null
          update_id?: number
        }
        Relationships: []
      }
      telegram_bot_config: {
        Row: {
          bot_id: number | null
          bot_username: string | null
          id: number
          last_setup_at: string | null
          updated_at: string
          webhook_secret: string | null
          webhook_url: string | null
        }
        Insert: {
          bot_id?: number | null
          bot_username?: string | null
          id?: number
          last_setup_at?: string | null
          updated_at?: string
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Update: {
          bot_id?: number | null
          bot_username?: string | null
          id?: number
          last_setup_at?: string | null
          updated_at?: string
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      telegram_ingest_config: {
        Row: {
          created_at: string
          folder_pattern: string
          id: string
          min_content_length: number
          min_meaningful_words: number
          note: string | null
          paused: boolean
          require_role: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          folder_pattern: string
          id?: string
          min_content_length?: number
          min_meaningful_words?: number
          note?: string | null
          paused?: boolean
          require_role?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          folder_pattern?: string
          id?: string
          min_content_length?: number
          min_meaningful_words?: number
          note?: string | null
          paused?: boolean
          require_role?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      telegram_link_codes: {
        Row: {
          code: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          user_id: string
        }
        Insert: {
          code: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          user_id: string
        }
        Update: {
          code?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      telegram_links: {
        Row: {
          id: string
          language_code: string | null
          linked_at: string
          telegram_user_id: number
          telegram_username: string | null
          user_id: string
        }
        Insert: {
          id?: string
          language_code?: string | null
          linked_at?: string
          telegram_user_id: number
          telegram_username?: string | null
          user_id: string
        }
        Update: {
          id?: string
          language_code?: string | null
          linked_at?: string
          telegram_user_id?: number
          telegram_username?: string | null
          user_id?: string
        }
        Relationships: []
      }
      telegram_notify_queue: {
        Row: {
          created_at: string
          error: string | null
          id: string
          kind: string
          payload: Json
          scheduled_at: string
          sent_at: string | null
          telegram_user_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          kind: string
          payload?: Json
          scheduled_at?: string
          sent_at?: string | null
          telegram_user_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          payload?: Json
          scheduled_at?: string
          sent_at?: string | null
          telegram_user_id?: number
          user_id?: string
        }
        Relationships: []
      }
      telegram_webapp_audit: {
        Row: {
          action: string
          created_at: string
          fun_user_id: string | null
          id: string
          meta: Json | null
          ok: boolean
          telegram_user_id: number
          telegram_username: string | null
        }
        Insert: {
          action: string
          created_at?: string
          fun_user_id?: string | null
          id?: string
          meta?: Json | null
          ok?: boolean
          telegram_user_id: number
          telegram_username?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          fun_user_id?: string | null
          id?: string
          meta?: Json | null
          ok?: boolean
          telegram_user_id?: number
          telegram_username?: string | null
        }
        Relationships: []
      }
      transparency_snapshots: {
        Row: {
          active_users: number
          allocation_by_level: Json
          created_at: string
          epoch_id: string
          id: string
          mentor_chains_completed: number
          rule_version: string | null
          total_fun_minted: number
          total_light_system: number
          value_loops_completed: number
        }
        Insert: {
          active_users?: number
          allocation_by_level?: Json
          created_at?: string
          epoch_id: string
          id?: string
          mentor_chains_completed?: number
          rule_version?: string | null
          total_fun_minted?: number
          total_light_system?: number
          value_loops_completed?: number
        }
        Update: {
          active_users?: number
          allocation_by_level?: Json
          created_at?: string
          epoch_id?: string
          id?: string
          mentor_chains_completed?: number
          rule_version?: string | null
          total_fun_minted?: number
          total_light_system?: number
          value_loops_completed?: number
        }
        Relationships: []
      }
      treasure_attempt_log: {
        Row: {
          attempted_at: string
          clue_id: string
          correct: boolean
          id: string
          user_id: string
        }
        Insert: {
          attempted_at?: string
          clue_id: string
          correct?: boolean
          id?: string
          user_id: string
        }
        Update: {
          attempted_at?: string
          clue_id?: string
          correct?: boolean
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      treasure_clue_answer_words: {
        Row: {
          clue_id: string
          updated_at: string
          updated_by: string | null
          words: string[]
        }
        Insert: {
          clue_id: string
          updated_at?: string
          updated_by?: string | null
          words?: string[]
        }
        Update: {
          clue_id?: string
          updated_at?: string
          updated_by?: string | null
          words?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "treasure_clue_answer_words_clue_id_fkey"
            columns: ["clue_id"]
            isOneToOne: true
            referencedRelation: "treasure_clues"
            referencedColumns: ["id"]
          },
        ]
      }
      treasure_clues: {
        Row: {
          answer_hash: string
          answer_hashes: string[]
          clue_type: string
          created_at: string
          description: string | null
          event_id: string
          id: string
          payload: Json
          points: number
          seq: number
          title: string
        }
        Insert: {
          answer_hash: string
          answer_hashes?: string[]
          clue_type?: string
          created_at?: string
          description?: string | null
          event_id: string
          id?: string
          payload?: Json
          points?: number
          seq: number
          title: string
        }
        Update: {
          answer_hash?: string
          answer_hashes?: string[]
          clue_type?: string
          created_at?: string
          description?: string | null
          event_id?: string
          id?: string
          payload?: Json
          points?: number
          seq?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "treasure_clues_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "treasure_events"
            referencedColumns: ["id"]
          },
        ]
      }
      treasure_events: {
        Row: {
          bonus_camly: number
          created_at: string
          description: string | null
          ends_at: string
          id: string
          jackpot_tier: string
          max_team_size: number
          name: string
          starts_at: string
          status: string
        }
        Insert: {
          bonus_camly?: number
          created_at?: string
          description?: string | null
          ends_at: string
          id?: string
          jackpot_tier?: string
          max_team_size?: number
          name: string
          starts_at: string
          status?: string
        }
        Update: {
          bonus_camly?: number
          created_at?: string
          description?: string | null
          ends_at?: string
          id?: string
          jackpot_tier?: string
          max_team_size?: number
          name?: string
          starts_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "treasure_events_jackpot_tier_fkey"
            columns: ["jackpot_tier"]
            isOneToOne: false
            referencedRelation: "box_tiers"
            referencedColumns: ["code"]
          },
        ]
      }
      treasure_fragments: {
        Row: {
          acquired_at: string
          event_id: string
          fragment_index: number
          id: string
          user_id: string
        }
        Insert: {
          acquired_at?: string
          event_id: string
          fragment_index: number
          id?: string
          user_id: string
        }
        Update: {
          acquired_at?: string
          event_id?: string
          fragment_index?: number
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "treasure_fragments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "treasure_events"
            referencedColumns: ["id"]
          },
        ]
      }
      treasure_jackpot_claims: {
        Row: {
          claimed_at: string
          event_id: string
          id: string
          ticket_id: string | null
          user_id: string
        }
        Insert: {
          claimed_at?: string
          event_id: string
          id?: string
          ticket_id?: string | null
          user_id: string
        }
        Update: {
          claimed_at?: string
          event_id?: string
          id?: string
          ticket_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "treasure_jackpot_claims_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "treasure_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treasure_jackpot_claims_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "box_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      treasure_progress: {
        Row: {
          clue_id: string
          event_id: string
          id: string
          solved_at: string
          team_id: string | null
          user_id: string
        }
        Insert: {
          clue_id: string
          event_id: string
          id?: string
          solved_at?: string
          team_id?: string | null
          user_id: string
        }
        Update: {
          clue_id?: string
          event_id?: string
          id?: string
          solved_at?: string
          team_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "treasure_progress_clue_id_fkey"
            columns: ["clue_id"]
            isOneToOne: false
            referencedRelation: "treasure_clues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treasure_progress_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "treasure_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treasure_progress_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "treasure_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      treasure_team_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          team_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          team_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "treasure_team_chat_messages_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "treasure_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      treasure_team_members: {
        Row: {
          joined_at: string
          team_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          team_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "treasure_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "treasure_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      treasure_teams: {
        Row: {
          created_at: string
          event_id: string
          id: string
          leader_user_id: string
          max_size: number
          name: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          leader_user_id: string
          max_size?: number
          name: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          leader_user_id?: string
          max_size?: number
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "treasure_teams_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "treasure_events"
            referencedColumns: ["id"]
          },
        ]
      }
      treasury_flows: {
        Row: {
          amount: number
          created_at: string
          destination_vault: string | null
          epoch_id: string | null
          id: string
          metadata: Json | null
          reason: string | null
          source_vault: string | null
          triggered_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          destination_vault?: string | null
          epoch_id?: string | null
          id?: string
          metadata?: Json | null
          reason?: string | null
          source_vault?: string | null
          triggered_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          destination_vault?: string | null
          epoch_id?: string | null
          id?: string
          metadata?: Json | null
          reason?: string | null
          source_vault?: string | null
          triggered_by?: string | null
        }
        Relationships: []
      }
      treasury_vaults: {
        Row: {
          balance: number
          created_at: string
          description: string | null
          id: string
          updated_at: string
          vault_label: string
          vault_name: string
          wallet_address: string | null
        }
        Insert: {
          balance?: number
          created_at?: string
          description?: string | null
          id?: string
          updated_at?: string
          vault_label: string
          vault_name: string
          wallet_address?: string | null
        }
        Update: {
          balance?: number
          created_at?: string
          description?: string | null
          id?: string
          updated_at?: string
          vault_label?: string
          vault_name?: string
          wallet_address?: string | null
        }
        Relationships: []
      }
      trust_history: {
        Row: {
          bs: number | null
          created_at: string
          days_inactive: number | null
          decay_factor: number
          did_id: string
          hs: number | null
          id: string
          os: number | null
          snapshot_date: string
          ss: number | null
          tc: number
          trust_tier: string
          user_id: string
          vs: number | null
        }
        Insert: {
          bs?: number | null
          created_at?: string
          days_inactive?: number | null
          decay_factor?: number
          did_id: string
          hs?: number | null
          id?: string
          os?: number | null
          snapshot_date?: string
          ss?: number | null
          tc: number
          trust_tier: string
          user_id: string
          vs?: number | null
        }
        Update: {
          bs?: number | null
          created_at?: string
          days_inactive?: number | null
          decay_factor?: number
          did_id?: string
          hs?: number | null
          id?: string
          os?: number | null
          snapshot_date?: string
          ss?: number | null
          tc?: number
          trust_tier?: string
          user_id?: string
          vs?: number | null
        }
        Relationships: []
      }
      trust_profile: {
        Row: {
          bs: number
          computation_meta: Json
          created_at: string
          decay_factor: number | null
          did_id: string
          fraud_risk: string
          hs: number
          id: string
          last_activity_at: string | null
          last_computed_at: string
          os: number
          risk_factor: number
          ss: number
          sybil_risk: string
          tc: number
          trust_tier: string
          updated_at: string
          user_id: string
          vs: number
        }
        Insert: {
          bs?: number
          computation_meta?: Json
          created_at?: string
          decay_factor?: number | null
          did_id: string
          fraud_risk?: string
          hs?: number
          id?: string
          last_activity_at?: string | null
          last_computed_at?: string
          os?: number
          risk_factor?: number
          ss?: number
          sybil_risk?: string
          tc?: number
          trust_tier?: string
          updated_at?: string
          user_id: string
          vs?: number
        }
        Update: {
          bs?: number
          computation_meta?: Json
          created_at?: string
          decay_factor?: number | null
          did_id?: string
          fraud_risk?: string
          hs?: number
          id?: string
          last_activity_at?: string | null
          last_computed_at?: string
          os?: number
          risk_factor?: number
          ss?: number
          sybil_risk?: string
          tc?: number
          trust_tier?: string
          updated_at?: string
          user_id?: string
          vs?: number
        }
        Relationships: [
          {
            foreignKeyName: "trust_profile_did_id_fkey"
            columns: ["did_id"]
            isOneToOne: true
            referencedRelation: "user_dids"
            referencedColumns: ["id"]
          },
        ]
      }
      trusted_guardians: {
        Row: {
          accepted_at: string | null
          created_at: string
          guardian_user_id: string
          id: string
          invited_at: string
          note: string | null
          revoked_at: string | null
          revoked_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          guardian_user_id: string
          id?: string
          invited_at?: string
          note?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          guardian_user_id?: string
          id?: string
          invited_at?: string
          note?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      typing_indicators: {
        Row: {
          conversation_partner_id: string
          id: string
          is_typing: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_partner_id: string
          id?: string
          is_typing?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_partner_id?: string
          id?: string
          is_typing?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_code: string
          id: string
          meta: Json
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_code: string
          id?: string
          meta?: Json
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_code?: string
          id?: string
          meta?: Json
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_code_fkey"
            columns: ["achievement_code"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["code"]
          },
        ]
      }
      user_activity_log: {
        Row: {
          activity_type: string
          content_preview: string | null
          created_at: string
          energy_impact: Database["public"]["Enums"]["energy_level"] | null
          id: string
          metadata: Json | null
          sentiment_score: number | null
          user_id: string
        }
        Insert: {
          activity_type: string
          content_preview?: string | null
          created_at?: string
          energy_impact?: Database["public"]["Enums"]["energy_level"] | null
          id?: string
          metadata?: Json | null
          sentiment_score?: number | null
          user_id: string
        }
        Update: {
          activity_type?: string
          content_preview?: string | null
          created_at?: string
          energy_impact?: Database["public"]["Enums"]["energy_level"] | null
          id?: string
          metadata?: Json | null
          sentiment_score?: number | null
          user_id?: string
        }
        Relationships: []
      }
      user_api_keys: {
        Row: {
          created_at: string
          daily_limit: number
          expires_at: string | null
          id: string
          image_daily_limit: number | null
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          scope: string
          total_requests: number
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_limit?: number
          expires_at?: string | null
          id?: string
          image_daily_limit?: number | null
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          scope?: string
          total_requests?: number
          user_id: string
        }
        Update: {
          created_at?: string
          daily_limit?: number
          expires_at?: string | null
          id?: string
          image_daily_limit?: number | null
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          scope?: string
          total_requests?: number
          user_id?: string
        }
        Relationships: []
      }
      user_ascensions: {
        Row: {
          ascended_at: string
          camly_burned: number
          id: string
          nft_burned_id: string | null
          nft_burned_tier: string | null
          tier: number
          title_nft_id: string | null
          user_id: string
        }
        Insert: {
          ascended_at?: string
          camly_burned?: number
          id?: string
          nft_burned_id?: string | null
          nft_burned_tier?: string | null
          tier: number
          title_nft_id?: string | null
          user_id: string
        }
        Update: {
          ascended_at?: string
          camly_burned?: number
          id?: string
          nft_burned_id?: string | null
          nft_burned_tier?: string | null
          tier?: number
          title_nft_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_daily_quests: {
        Row: {
          ai_score: number | null
          assigned_date: string
          camly_awarded: number | null
          claimed_at: string | null
          created_at: string
          evidence_ref: string | null
          id: string
          multiplier_applied: number | null
          risk_score: number | null
          status: string
          template_id: string
          user_id: string
          xp_awarded: number | null
        }
        Insert: {
          ai_score?: number | null
          assigned_date?: string
          camly_awarded?: number | null
          claimed_at?: string | null
          created_at?: string
          evidence_ref?: string | null
          id?: string
          multiplier_applied?: number | null
          risk_score?: number | null
          status?: string
          template_id: string
          user_id: string
          xp_awarded?: number | null
        }
        Update: {
          ai_score?: number | null
          assigned_date?: string
          camly_awarded?: number | null
          claimed_at?: string | null
          created_at?: string
          evidence_ref?: string | null
          id?: string
          multiplier_applied?: number | null
          risk_score?: number | null
          status?: string
          template_id?: string
          user_id?: string
          xp_awarded?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_daily_quests_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "quest_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      user_dids: {
        Row: {
          created_at: string
          did: string
          did_hash: string
          did_level: number
          entity_type: string
          id: string
          metadata: Json | null
          on_chain_anchor_block: number | null
          on_chain_anchor_hash: string | null
          secondary_wallets: string[] | null
          status: string
          trust_seed: string | null
          updated_at: string
          user_id: string
          verification_state: Json
          wallet_address: string | null
        }
        Insert: {
          created_at?: string
          did: string
          did_hash: string
          did_level?: number
          entity_type?: string
          id?: string
          metadata?: Json | null
          on_chain_anchor_block?: number | null
          on_chain_anchor_hash?: string | null
          secondary_wallets?: string[] | null
          status?: string
          trust_seed?: string | null
          updated_at?: string
          user_id: string
          verification_state?: Json
          wallet_address?: string | null
        }
        Update: {
          created_at?: string
          did?: string
          did_hash?: string
          did_level?: number
          entity_type?: string
          id?: string
          metadata?: Json | null
          on_chain_anchor_block?: number | null
          on_chain_anchor_hash?: string | null
          secondary_wallets?: string[] | null
          status?: string
          trust_seed?: string | null
          updated_at?: string
          user_id?: string
          verification_state?: Json
          wallet_address?: string | null
        }
        Relationships: []
      }
      user_dimension_scores: {
        Row: {
          activity_score: number
          computed_at: string
          created_at: string
          decay_applied: boolean
          ecosystem_score: number
          id: string
          identity_score: number
          inactive_days: number
          level_name: string
          onchain_score: number
          risk_penalty: number
          streak_bonus_pct: number
          total_light_score: number
          transparency_score: number
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_score?: number
          computed_at?: string
          created_at?: string
          decay_applied?: boolean
          ecosystem_score?: number
          id?: string
          identity_score?: number
          inactive_days?: number
          level_name?: string
          onchain_score?: number
          risk_penalty?: number
          streak_bonus_pct?: number
          total_light_score?: number
          transparency_score?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_score?: number
          computed_at?: string
          created_at?: string
          decay_applied?: boolean
          ecosystem_score?: number
          id?: string
          identity_score?: number
          inactive_days?: number
          level_name?: string
          onchain_score?: number
          risk_penalty?: number
          streak_bonus_pct?: number
          total_light_score?: number
          transparency_score?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_energy_status: {
        Row: {
          admin_notes: string | null
          approval_status: Database["public"]["Enums"]["approval_status"]
          approved_at: string | null
          approved_by: string | null
          created_at: string
          current_energy_level:
            | Database["public"]["Enums"]["energy_level"]
            | null
          id: string
          last_activity_at: string | null
          light_shared_count: number | null
          negative_interactions_count: number | null
          overall_sentiment_score: number | null
          positive_interactions_count: number | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          trial_end_date: string | null
          trial_start_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          approval_status?: Database["public"]["Enums"]["approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          current_energy_level?:
            | Database["public"]["Enums"]["energy_level"]
            | null
          id?: string
          last_activity_at?: string | null
          light_shared_count?: number | null
          negative_interactions_count?: number | null
          overall_sentiment_score?: number | null
          positive_interactions_count?: number | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          trial_end_date?: string | null
          trial_start_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          approval_status?: Database["public"]["Enums"]["approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          current_energy_level?:
            | Database["public"]["Enums"]["energy_level"]
            | null
          id?: string
          last_activity_at?: string | null
          light_shared_count?: number | null
          negative_interactions_count?: number | null
          overall_sentiment_score?: number | null
          positive_interactions_count?: number | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          trial_end_date?: string | null
          trial_start_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_feedback: {
        Row: {
          admin_response: string | null
          coins_earned: number | null
          content: string
          content_length: number
          created_at: string
          feedback_type: string
          id: string
          is_helpful: boolean | null
          is_rewarded: boolean | null
          rating: number | null
          responded_at: string | null
          responded_by: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_response?: string | null
          coins_earned?: number | null
          content: string
          content_length?: number
          created_at?: string
          feedback_type: string
          id?: string
          is_helpful?: boolean | null
          is_rewarded?: boolean | null
          rating?: number | null
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_response?: string | null
          coins_earned?: number | null
          content?: string
          content_length?: number
          created_at?: string
          feedback_type?: string
          id?: string
          is_helpful?: boolean | null
          is_rewarded?: boolean | null
          rating?: number | null
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_inventory: {
        Row: {
          created_at: string
          id: string
          item_name: string
          item_type: string
          metadata: Json | null
          rarity: string | null
          source_ticket_id: string | null
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_name: string
          item_type: string
          metadata?: Json | null
          rarity?: string | null
          source_ticket_id?: string | null
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_name?: string
          item_type?: string
          metadata?: Json | null
          rarity?: string | null
          source_ticket_id?: string | null
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_inventory_source_ticket_id_fkey"
            columns: ["source_ticket_id"]
            isOneToOne: false
            referencedRelation: "box_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_light_agreements: {
        Row: {
          agreed_at: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          agreed_at?: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          agreed_at?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_light_scores: {
        Row: {
          alpha: number
          beta: number
          consistency_multiplier: number
          created_at: string
          display_light: number
          gamma: number
          last_lls_update: string | null
          last_nls_update: string | null
          last_pls_update: string | null
          legacy_light: number
          light_tier: string
          network_light: number
          personal_light: number
          reliability_multiplier: number
          total_light_raw: number
          updated_at: string
          user_id: string
        }
        Insert: {
          alpha?: number
          beta?: number
          consistency_multiplier?: number
          created_at?: string
          display_light?: number
          gamma?: number
          last_lls_update?: string | null
          last_nls_update?: string | null
          last_pls_update?: string | null
          legacy_light?: number
          light_tier?: string
          network_light?: number
          personal_light?: number
          reliability_multiplier?: number
          total_light_raw?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          alpha?: number
          beta?: number
          consistency_multiplier?: number
          created_at?: string
          display_light?: number
          gamma?: number
          last_lls_update?: string | null
          last_nls_update?: string | null
          last_pls_update?: string | null
          legacy_light?: number
          light_tier?: string
          network_light?: number
          personal_light?: number
          reliability_multiplier?: number
          total_light_raw?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_light_totals: {
        Row: {
          current_level: number | null
          id: string
          last_score_update: string | null
          lifetime_points: number | null
          negative_actions: number | null
          popl_score: number | null
          positive_actions: number | null
          total_points: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          current_level?: number | null
          id?: string
          last_score_update?: string | null
          lifetime_points?: number | null
          negative_actions?: number | null
          popl_score?: number | null
          positive_actions?: number | null
          total_points?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          current_level?: number | null
          id?: string
          last_score_update?: string | null
          lifetime_points?: number | null
          negative_actions?: number | null
          popl_score?: number | null
          positive_actions?: number | null
          total_points?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_mastery: {
        Row: {
          created_at: string
          level: number
          pending_perks: number
          total_xp: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          level?: number
          pending_perks?: number
          total_xp?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          level?: number
          pending_perks?: number
          total_xp?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_mastery_perks: {
        Row: {
          chosen_at: string
          id: string
          level_unlocked: number
          perk_key: string
          user_id: string
        }
        Insert: {
          chosen_at?: string
          id?: string
          level_unlocked: number
          perk_key: string
          user_id: string
        }
        Update: {
          chosen_at?: string
          id?: string
          level_unlocked?: number
          perk_key?: string
          user_id?: string
        }
        Relationships: []
      }
      user_mastery_xp_log: {
        Row: {
          amount: number
          created_at: string
          id: string
          level_after: number | null
          level_before: number | null
          source: string
          source_ref: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          level_after?: number | null
          level_before?: number | null
          source: string
          source_ref: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          level_after?: number | null
          level_before?: number | null
          source?: string
          source_ref?: string
          user_id?: string
        }
        Relationships: []
      }
      user_online_status: {
        Row: {
          id: string
          is_online: boolean | null
          last_seen_at: string
          user_id: string
        }
        Insert: {
          id?: string
          is_online?: boolean | null
          last_seen_at?: string
          user_id: string
        }
        Update: {
          id?: string
          is_online?: boolean | null
          last_seen_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_quest_streaks: {
        Row: {
          current_streak: number
          grace_month_key: string | null
          grace_used_month: number | null
          last_claim_date: string | null
          longest_streak: number
          multiplier: number
          updated_at: string
          user_id: string
        }
        Insert: {
          current_streak?: number
          grace_month_key?: string | null
          grace_used_month?: number | null
          last_claim_date?: string | null
          longest_streak?: number
          multiplier?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          current_streak?: number
          grace_month_key?: string | null
          grace_used_month?: number | null
          last_claim_date?: string | null
          longest_streak?: number
          multiplier?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_rate_limits: {
        Row: {
          ban_reason: string | null
          created_at: string
          id: string
          is_temp_banned: boolean | null
          last_question_at: string | null
          questions_last_hour: number | null
          suspicious_activity_count: number | null
          temp_ban_until: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ban_reason?: string | null
          created_at?: string
          id?: string
          is_temp_banned?: boolean | null
          last_question_at?: string | null
          questions_last_hour?: number | null
          suspicious_activity_count?: number | null
          temp_ban_until?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ban_reason?: string | null
          created_at?: string
          id?: string
          is_temp_banned?: boolean | null
          last_question_at?: string | null
          questions_last_hour?: number | null
          suspicious_activity_count?: number | null
          temp_ban_until?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_riddle_sparks: {
        Row: {
          sparks: number
          total_earned: number
          total_spent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          sparks?: number
          total_earned?: number
          total_spent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          sparks?: number
          total_earned?: number
          total_spent?: number
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
          role?: Database["public"]["Enums"]["app_role"]
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
      user_season_claims: {
        Row: {
          claimed_at: string
          id: string
          level: number
          reward_type: string
          reward_value: Json | null
          season_id: string
          track: string
          user_id: string
          user_pass_id: string
        }
        Insert: {
          claimed_at?: string
          id?: string
          level: number
          reward_type: string
          reward_value?: Json | null
          season_id: string
          track: string
          user_id: string
          user_pass_id: string
        }
        Update: {
          claimed_at?: string
          id?: string
          level?: number
          reward_type?: string
          reward_value?: Json | null
          season_id?: string
          track?: string
          user_id?: string
          user_pass_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_season_claims_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "game_seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_season_claims_user_pass_id_fkey"
            columns: ["user_pass_id"]
            isOneToOne: false
            referencedRelation: "user_season_pass"
            referencedColumns: ["id"]
          },
        ]
      }
      user_season_pass: {
        Row: {
          created_at: string
          id: string
          is_premium: boolean
          level: number
          premium_unlocked_at: string | null
          season_id: string
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_premium?: boolean
          level?: number
          premium_unlocked_at?: string | null
          season_id: string
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_premium?: boolean
          level?: number
          premium_unlocked_at?: string | null
          season_id?: string
          updated_at?: string
          user_id?: string
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_season_pass_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "game_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      user_season_xp_log: {
        Row: {
          amount: number
          created_at: string
          id: string
          ref_id: string
          season_id: string
          source: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          ref_id: string
          season_id: string
          source: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          ref_id?: string
          season_id?: string
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_season_xp_log_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "game_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      user_suspensions: {
        Row: {
          created_at: string
          created_by: string | null
          healing_message: string | null
          id: string
          lifted_at: string | null
          lifted_by: string | null
          reason: string
          suspended_at: string
          suspended_until: string | null
          suspension_type: Database["public"]["Enums"]["suspension_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          healing_message?: string | null
          id?: string
          lifted_at?: string | null
          lifted_by?: string | null
          reason: string
          suspended_at?: string
          suspended_until?: string | null
          suspension_type: Database["public"]["Enums"]["suspension_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          healing_message?: string | null
          id?: string
          lifted_at?: string | null
          lifted_by?: string | null
          reason?: string
          suspended_at?: string
          suspended_until?: string | null
          suspension_type?: Database["public"]["Enums"]["suspension_type"]
          user_id?: string
        }
        Relationships: []
      }
      user_wallet_addresses: {
        Row: {
          change_count_this_month: number
          created_at: string
          id: string
          last_change_month: string | null
          updated_at: string
          user_id: string
          wallet_address: string | null
        }
        Insert: {
          change_count_this_month?: number
          created_at?: string
          id?: string
          last_change_month?: string | null
          updated_at?: string
          user_id: string
          wallet_address?: string | null
        }
        Update: {
          change_count_this_month?: number
          created_at?: string
          id?: string
          last_change_month?: string | null
          updated_at?: string
          user_id?: string
          wallet_address?: string | null
        }
        Relationships: []
      }
      user_weekly_quest_claims: {
        Row: {
          claimed_at: string
          id: string
          template_id: string
          user_id: string
          week_start: string
          xp_granted: number
        }
        Insert: {
          claimed_at?: string
          id?: string
          template_id: string
          user_id: string
          week_start: string
          xp_granted: number
        }
        Update: {
          claimed_at?: string
          id?: string
          template_id?: string
          user_id?: string
          week_start?: string
          xp_granted?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_weekly_quest_claims_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "season_weekly_quest_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      user_withdrawal_stats: {
        Row: {
          created_at: string
          id: string
          last_withdrawal_at: string | null
          successful_withdrawals: number
          total_requests: number
          total_withdrawn: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_withdrawal_at?: string | null
          successful_withdrawals?: number
          total_requests?: number
          total_withdrawn?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_withdrawal_at?: string | null
          successful_withdrawals?: number
          total_requests?: number
          total_withdrawn?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_xp_ledger: {
        Row: {
          created_at: string
          delta: number
          id: string
          metadata: Json | null
          source: string
          source_ref: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          metadata?: Json | null
          source: string
          source_ref?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          metadata?: Json | null
          source?: string
          source_ref?: string | null
          user_id?: string
        }
        Relationships: []
      }
      validator_rewards: {
        Row: {
          amount: number
          claimed_at: string | null
          created_at: string
          did_id: string
          id: string
          metadata: Json
          source_ref: string | null
          source_type: string
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          claimed_at?: string | null
          created_at?: string
          did_id: string
          id?: string
          metadata?: Json
          source_ref?: string | null
          source_type: string
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          claimed_at?: string | null
          created_at?: string
          did_id?: string
          id?: string
          metadata?: Json
          source_ref?: string | null
          source_type?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "validator_rewards_did_id_fkey"
            columns: ["did_id"]
            isOneToOne: false
            referencedRelation: "user_dids"
            referencedColumns: ["id"]
          },
        ]
      }
      validator_stakes: {
        Row: {
          amount: number
          created_at: string
          did_id: string
          id: string
          locked_until: string
          slash_reason: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          did_id: string
          id?: string
          locked_until: string
          slash_reason?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          did_id?: string
          id?: string
          locked_until?: string
          slash_reason?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "validator_stakes_did_id_fkey"
            columns: ["did_id"]
            isOneToOne: false
            referencedRelation: "user_dids"
            referencedColumns: ["id"]
          },
        ]
      }
      viral_referrals: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          invitee_id: string
          referrer_id: string
          reward_camly_each: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          invitee_id: string
          referrer_id: string
          reward_camly_each?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          invitee_id?: string
          referrer_id?: string
          reward_camly_each?: number
        }
        Relationships: []
      }
      vision_boards: {
        Row: {
          completed_goals_count: number | null
          created_at: string
          description: string | null
          goals: Json | null
          id: string
          images: Json | null
          is_first_board: boolean | null
          is_public: boolean | null
          is_rewarded: boolean | null
          reward_amount: number | null
          title: string
          total_goals_count: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_goals_count?: number | null
          created_at?: string
          description?: string | null
          goals?: Json | null
          id?: string
          images?: Json | null
          is_first_board?: boolean | null
          is_public?: boolean | null
          is_rewarded?: boolean | null
          reward_amount?: number | null
          title: string
          total_goals_count?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_goals_count?: number | null
          created_at?: string
          description?: string | null
          goals?: Json | null
          id?: string
          images?: Json | null
          is_first_board?: boolean | null
          is_public?: boolean | null
          is_rewarded?: boolean | null
          reward_amount?: number | null
          title?: string
          total_goals_count?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      web_scrape_cache: {
        Row: {
          description: string | null
          fetched_at: string
          markdown: string | null
          summary: string | null
          title: string | null
          url: string
          url_hash: string
        }
        Insert: {
          description?: string | null
          fetched_at?: string
          markdown?: string | null
          summary?: string | null
          title?: string | null
          url: string
          url_hash: string
        }
        Update: {
          description?: string | null
          fetched_at?: string
          markdown?: string | null
          summary?: string | null
          title?: string | null
          url?: string
          url_hash?: string
        }
        Relationships: []
      }
      zk_attestation_commitments: {
        Row: {
          attestation_type_hint: string | null
          commitment_hash: string
          created_at: string
          expires_at: string
          from_did: string
          from_user_id: string
          id: string
          privacy_level: string
          reveal_nonce: string | null
          revealed_at: string | null
          revealed_attestation_id: string | null
          revealed_attestation_type: string | null
          revealed_evidence: Json | null
          revealed_to_did: string | null
          revealed_weight: number | null
          status: string
        }
        Insert: {
          attestation_type_hint?: string | null
          commitment_hash: string
          created_at?: string
          expires_at?: string
          from_did: string
          from_user_id: string
          id?: string
          privacy_level?: string
          reveal_nonce?: string | null
          revealed_at?: string | null
          revealed_attestation_id?: string | null
          revealed_attestation_type?: string | null
          revealed_evidence?: Json | null
          revealed_to_did?: string | null
          revealed_weight?: number | null
          status?: string
        }
        Update: {
          attestation_type_hint?: string | null
          commitment_hash?: string
          created_at?: string
          expires_at?: string
          from_did?: string
          from_user_id?: string
          id?: string
          privacy_level?: string
          reveal_nonce?: string | null
          revealed_at?: string | null
          revealed_attestation_id?: string | null
          revealed_attestation_type?: string | null
          revealed_evidence?: Json | null
          revealed_to_did?: string | null
          revealed_weight?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "zk_attestation_commitments_from_did_fkey"
            columns: ["from_did"]
            isOneToOne: false
            referencedRelation: "user_dids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zk_attestation_commitments_revealed_attestation_id_fkey"
            columns: ["revealed_attestation_id"]
            isOneToOne: false
            referencedRelation: "attestation_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zk_attestation_commitments_revealed_to_did_fkey"
            columns: ["revealed_to_did"]
            isOneToOne: false
            referencedRelation: "user_dids"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      content_unified: {
        Row: {
          author_user_id: string | null
          content_id: string | null
          content_text: string | null
          content_type: string | null
          created_at: string | null
          metadata_json: Json | null
          root_content_id: string | null
          visibility: string | null
        }
        Relationships: []
      }
      image_generation_error_stats: {
        Row: {
          day: string | null
          error_code: string | null
          event_count: number | null
          function_name: string | null
          provider: string | null
        }
        Relationships: []
      }
      pplp_validations: {
        Row: {
          action_id: string | null
          base_reward: number | null
          consistency_multiplier: number | null
          created_at: string | null
          decision: Database["public"]["Enums"]["pplp_decision"] | null
          decision_reason: string | null
          final_reward: number | null
          id: string | null
          integrity_penalty: number | null
          light_score: number | null
          multiplier_i: number | null
          multiplier_k: number | null
          multiplier_q: number | null
          pillar_c: number | null
          pillar_h: number | null
          pillar_s: number | null
          pillar_t: number | null
          pillar_u: number | null
          policy_version: string | null
          reputation_weight: number | null
          scored_by: string | null
        }
        Insert: {
          action_id?: string | null
          base_reward?: number | null
          consistency_multiplier?: number | null
          created_at?: string | null
          decision?: Database["public"]["Enums"]["pplp_decision"] | null
          decision_reason?: string | null
          final_reward?: number | null
          id?: string | null
          integrity_penalty?: number | null
          light_score?: number | null
          multiplier_i?: number | null
          multiplier_k?: number | null
          multiplier_q?: number | null
          pillar_c?: number | null
          pillar_h?: number | null
          pillar_s?: number | null
          pillar_t?: number | null
          pillar_u?: number | null
          policy_version?: string | null
          reputation_weight?: number | null
          scored_by?: string | null
        }
        Update: {
          action_id?: string | null
          base_reward?: number | null
          consistency_multiplier?: number | null
          created_at?: string | null
          decision?: Database["public"]["Enums"]["pplp_decision"] | null
          decision_reason?: string | null
          final_reward?: number | null
          id?: string | null
          integrity_penalty?: number | null
          light_score?: number | null
          multiplier_i?: number | null
          multiplier_k?: number | null
          multiplier_q?: number | null
          pillar_c?: number | null
          pillar_h?: number | null
          pillar_s?: number | null
          pillar_t?: number | null
          pillar_u?: number | null
          policy_version?: string | null
          reputation_weight?: number | null
          scored_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pplp_scores_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: true
            referencedRelation: "pplp_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pplp_scores_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: true
            referencedRelation: "user_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_actions: {
        Row: {
          action_type: string | null
          action_type_enum:
            | Database["public"]["Enums"]["pplp_action_type"]
            | null
          actor_id: string | null
          canonical_hash: string | null
          created_at: string | null
          evidence_hash: string | null
          id: string | null
          impact: Json | null
          integrity: Json | null
          metadata: Json | null
          mint_request_hash: string | null
          minted_at: string | null
          platform_id: string | null
          policy_snapshot: Json | null
          policy_version: string | null
          scored_at: string | null
          status: Database["public"]["Enums"]["pplp_action_status"] | null
          synced_at: string | null
          synced_to_fun_rich: boolean | null
          target_id: string | null
        }
        Insert: {
          action_type?: string | null
          action_type_enum?:
            | Database["public"]["Enums"]["pplp_action_type"]
            | null
          actor_id?: string | null
          canonical_hash?: string | null
          created_at?: string | null
          evidence_hash?: string | null
          id?: string | null
          impact?: Json | null
          integrity?: Json | null
          metadata?: Json | null
          mint_request_hash?: string | null
          minted_at?: string | null
          platform_id?: string | null
          policy_snapshot?: Json | null
          policy_version?: string | null
          scored_at?: string | null
          status?: Database["public"]["Enums"]["pplp_action_status"] | null
          synced_at?: string | null
          synced_to_fun_rich?: boolean | null
          target_id?: string | null
        }
        Update: {
          action_type?: string | null
          action_type_enum?:
            | Database["public"]["Enums"]["pplp_action_type"]
            | null
          actor_id?: string | null
          canonical_hash?: string | null
          created_at?: string | null
          evidence_hash?: string | null
          id?: string | null
          impact?: Json | null
          integrity?: Json | null
          metadata?: Json | null
          mint_request_hash?: string | null
          minted_at?: string | null
          platform_id?: string | null
          policy_snapshot?: Json | null
          policy_version?: string | null
          scored_at?: string | null
          status?: Database["public"]["Enums"]["pplp_action_status"] | null
          synced_at?: string | null
          synced_to_fun_rich?: boolean | null
          target_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _batch_minter_schedule_continuation: {
        Args: {
          _api_key: string
          _delay_seconds?: number
          _depth: number
          _url: string
        }
        Returns: undefined
      }
      _batch_minter_schedule_post_epoch: {
        Args: {
          _api_key: string
          _cron_expr: string
          _job_name: string
          _url: string
        }
        Returns: undefined
      }
      _current_season: {
        Args: never
        Returns: {
          code: string
          created_at: string
          description: string | null
          ends_at: string
          id: string
          is_active: boolean
          max_level: number
          name: string
          premium_price_camly: number
          starts_at: string
          theme: string | null
          xp_per_level: number
        }
        SetofOptions: {
          from: "*"
          to: "game_seasons"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      _current_week_start_vn: { Args: never; Returns: string }
      _get_internal_config: { Args: { _key: string }; Returns: string }
      _log_kn_audit: {
        Args: { _action: string; _detail: Json; _doc: string }
        Returns: undefined
      }
      _require_kn_admin: { Args: never; Returns: undefined }
      accept_guardian_invite: {
        Args: { _relationship_id: string }
        Returns: boolean
      }
      activate_knowledge_collection: {
        Args: { _collection_id: string }
        Returns: Json
      }
      activate_knowledge_doc: { Args: { _id: string }; Returns: undefined }
      add_camly_coins: {
        Args: {
          _amount: number
          _description?: string
          _metadata?: Json
          _purity_score?: number
          _transaction_type: Database["public"]["Enums"]["coin_transaction_type"]
          _user_id: string
        }
        Returns: number
      }
      add_guardian: {
        Args: { _guardian_user_id: string; _note?: string }
        Returns: string
      }
      add_light_points: {
        Args: {
          _points: number
          _reason: string
          _source_type: string
          _user_id: string
        }
        Returns: undefined
      }
      add_mastery_xp: {
        Args: {
          p_amount: number
          p_source: string
          p_source_ref: string
          p_user: string
        }
        Returns: Json
      }
      add_pending_or_instant_reward: {
        Args: {
          _amount: number
          _description: string
          _metadata?: Json
          _purity_score?: number
          _transaction_type: Database["public"]["Enums"]["coin_transaction_type"]
          _user_id: string
        }
        Returns: Json
      }
      add_season_xp: {
        Args: {
          p_amount: number
          p_ref_id: string
          p_source: string
          p_user_id: string
        }
        Returns: Json
      }
      admin_clear_abuse_flag: { Args: { _flag_id: string }; Returns: Json }
      admin_edit_knowledge_doc: {
        Args: { _content: string; _id: string; _title: string }
        Returns: undefined
      }
      admin_extend_sbt: {
        Args: { _new_expiry: string; _token_id: string }
        Returns: Json
      }
      admin_freeze_sbt: {
        Args: { _reason?: string; _token_id: string }
        Returns: Json
      }
      admin_list_sbts: {
        Args: {
          _limit?: number
          _sbt_type?: string
          _search?: string
          _status?: string
        }
        Returns: {
          did: string
          expires_at: string
          issued_at: string
          issuer: string
          sbt_subtype: string
          sbt_type: string
          status: string
          token_id: string
          trust_weight: number
          user_id: string
        }[]
      }
      admin_list_threshold_audit: {
        Args: { _limit?: number }
        Returns: {
          action_type: string
          changed_at: string
          changed_by: string
          environment: string
          id: string
          new_thresholds: Json
          old_thresholds: Json
          platform_id: string
          reason: string
        }[]
      }
      admin_list_treasure_clues: {
        Args: never
        Returns: {
          clue_id: string
          description: string
          event_id: string
          event_title: string
          hashes_count: number
          points: number
          seq: number
          title: string
          updated_at: string
          words: string[]
        }[]
      }
      admin_list_urantia_batches: {
        Args: never
        Returns: {
          checkpoint: Json
          collection_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          manifest: Json
          retry_count: number
          safe_error_code: string | null
          started_at: string | null
          status: string
        }[]
        SetofOptions: {
          from: "*"
          to: "knowledge_ingestion_batches"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_urantia_collections: {
        Args: never
        Returns: {
          activated_at: string | null
          corpus: string
          created_at: string
          created_by: string | null
          edition: string
          id: string
          is_active: boolean
          language: string
          source_version: string
          updated_at: string
          version_status: string
        }[]
        SetofOptions: {
          from: "*"
          to: "knowledge_collections"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_resolve_recovery: {
        Args: { _decision: string; _reason?: string; _request_id: string }
        Returns: Json
      }
      admin_revoke_sbt: {
        Args: { _reason?: string; _token_id: string }
        Returns: Json
      }
      admin_set_clue_answers: {
        Args: { p_clue_id: string; p_words: string[] }
        Returns: Json
      }
      admin_update_action_thresholds: {
        Args: {
          _action_type: string
          _environment?: string
          _new_thresholds: Json
          _platform_id: string
          _reason?: string
        }
        Returns: Json
      }
      adopt_pet: {
        Args: {
          p_element: Database["public"]["Enums"]["pet_element"]
          p_name: string
          p_personality: Database["public"]["Enums"]["pet_personality"]
        }
        Returns: {
          aura: number
          created_at: string
          element: Database["public"]["Enums"]["pet_element"]
          energy: number
          evolution: Database["public"]["Enums"]["pet_evolution"]
          id: string
          last_chat_at: string | null
          last_fed_at: string | null
          level: number
          mood: number
          name: string
          personality: Database["public"]["Enums"]["pet_personality"]
          total_xp: number
          updated_at: string
          user_id: string
          xp: number
        }
        SetofOptions: {
          from: "*"
          to: "pets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      apply_trust_decay_batch: { Args: never; Returns: Json }
      approve_knowledge_doc: {
        Args: { _id: string; _note?: string }
        Returns: undefined
      }
      approve_slash_proposal: {
        Args: { _notes?: string; _override_pct?: number; _proposal_id: string }
        Returns: Json
      }
      archive_knowledge_doc: { Args: { _id: string }; Returns: undefined }
      ascend_light: { Args: { p_nft_id: string }; Returns: Json }
      attack_boss: {
        Args: {
          p_damage: number
          p_ref_id: string
          p_source: string
          p_user_id: string
        }
        Returns: Json
      }
      auto_suspend_high_risk: {
        Args: { _risk_score: number; _signals?: Json; _user_id: string }
        Returns: Json
      }
      backup_knowledge_snapshot: { Args: never; Returns: Json }
      build_features_user_day: {
        Args: { _date: string; _user_id: string }
        Returns: undefined
      }
      bulk_delete_knowledge_docs: { Args: { _ids: string[] }; Returns: number }
      calculate_consistency_multiplier: {
        Args: { _user_id: string }
        Returns: number
      }
      calculate_light_score: {
        Args: { _c: number; _h: number; _s: number; _t: number; _u: number }
        Returns: number
      }
      calculate_pplp_reward: {
        Args: { _base_reward: number; _i: number; _k: number; _q: number }
        Returns: number
      }
      calculate_reputation_weight: {
        Args: { _user_id: string }
        Returns: number
      }
      cancel_mint_request_safe: {
        Args: { p_reason?: string; p_request_id: string }
        Returns: Json
      }
      canonical_knowledge_folder_name: {
        Args: { raw_name: string }
        Returns: string
      }
      check_ai_usage_only: {
        Args: { _daily_limit?: number; _usage_type: string; _user_id: string }
        Returns: {
          allowed: boolean
          current_count: number
          daily_limit: number
          message: string
        }[]
      }
      check_and_increment_ai_usage: {
        Args: { _daily_limit?: number; _usage_type: string; _user_id: string }
        Returns: {
          allowed: boolean
          current_count: number
          daily_limit: number
          message: string
        }[]
      }
      check_attestation_guardrails: {
        Args: { _attestation_type: string; _from_did: string; _to_did: string }
        Returns: Json
      }
      check_feature_activation: { Args: { _user_id: string }; Returns: Json }
      check_knowledge_ingest_sync: {
        Args: never
        Returns: {
          drifted: number
          fixed: number
          scanned: number
        }[]
      }
      check_mint_eligibility: {
        Args: { _epoch_end: string; _epoch_start: string; _user_id: string }
        Returns: {
          avg_risk: number
          eligible: boolean
          epoch_score: number
          has_cluster_review: boolean
          pplp_accepted: boolean
          reason: string
        }[]
      }
      check_mint_gate: { Args: { _user_id: string }; Returns: Json }
      check_user_cap_and_update: {
        Args: { _action_type: string; _reward_amount: number; _user_id: string }
        Returns: Json
      }
      check_withdrawal_eligibility: {
        Args: { _user_id: string }
        Returns: {
          can_withdraw: boolean
          has_journal_today: boolean
          has_post_today: boolean
          message: string
        }[]
      }
      claim_boss_loot: {
        Args: { p_boss_id: string; p_loot_id: string }
        Returns: Json
      }
      claim_connector_slot: {
        Args: {
          p_block_number: number
          p_chain_id: number
          p_connector_user_id: string
          p_connector_wallet: string
          p_evidence_hash: string
          p_newcomer_did: string
          p_newcomer_user_id: string
          p_token_amount: number
          p_token_symbol: string
          p_tx_hash: string
          p_tx_index: number
        }
        Returns: string
      }
      claim_lamp_loot: { Args: { p_lamp_id: string }; Returns: Json }
      claim_mastery_perk: {
        Args: { p_level: number; p_perk_key: string }
        Returns: Json
      }
      claim_next_sbt_mint: {
        Args: { _max_retry?: number; _network?: string }
        Returns: Json
      }
      claim_quest_reward: {
        Args: {
          p_ai_score?: number
          p_evidence_ref?: string
          p_quest_id: string
          p_risk_score?: number
        }
        Returns: Json
      }
      claim_season_reward: {
        Args: { p_level: number; p_track: string }
        Returns: Json
      }
      claim_treasure_jackpot: { Args: { p_event_id: string }; Returns: Json }
      claim_validator_rewards: { Args: never; Returns: Json }
      claim_weekly_quest: { Args: { _template_id: string }; Returns: Json }
      cleanup_cost_control_storage: { Args: never; Returns: undefined }
      cleanup_expired_posts: { Args: never; Returns: undefined }
      cleanup_expired_stories: { Args: never; Returns: undefined }
      cleanup_old_temp_storage_objects: { Args: never; Returns: number }
      close_circle_lamp: { Args: { p_lamp_id: string }; Returns: undefined }
      commit_private_attestation: {
        Args: {
          _attestation_type_hint?: string
          _commitment_hash: string
          _privacy_level?: string
        }
        Returns: Json
      }
      compute_anti_farming_factors: {
        Args: { _date?: string; _user_id: string }
        Returns: {
          burst_penalty: number
          cross_window_bonus: number
          late_window_weight: number
          timing_adjusted_score: number
        }[]
      }
      compute_content_pillar_score: {
        Args: { _content_id: string; _gamma?: number; _min_ratings?: number }
        Returns: {
          is_fallback: boolean
          pillar_scores: number[]
          rating_count: number
          total_score: number
        }[]
      }
      compute_daily_light_score: {
        Args: { _date?: string; _user_id: string }
        Returns: number
      }
      compute_dib_vault_hashes: { Args: { _did_id: string }; Returns: Json }
      compute_epoch_light_score: {
        Args: { _epoch_end: string; _epoch_start: string; _user_id: string }
        Returns: number
      }
      compute_health_metrics: { Args: { _date?: string }; Returns: Json }
      compute_intent_integrity: { Args: { _user_id: string }; Returns: number }
      compute_legacy_light: { Args: { _user_id: string }; Returns: number }
      compute_light_score_ledger: {
        Args: {
          _end: string
          _period: string
          _start: string
          _user_id: string
        }
        Returns: string
      }
      compute_light_tier: { Args: { _display_light: number }; Returns: string }
      compute_network_light: { Args: { _user_id: string }; Returns: number }
      compute_participation_factor: {
        Args: { _attendance_id: string }
        Returns: number
      }
      compute_policy_hash: { Args: { _policy_json: Json }; Returns: string }
      compute_reliability: { Args: { _user_id: string }; Returns: number }
      compute_reputation_weight_v2: {
        Args: {
          _alpha?: number
          _user_id: string
          _w_max?: number
          _w_min?: number
        }
        Returns: number
      }
      compute_trust_confidence: { Args: { _did_id: string }; Returns: number }
      compute_user_dimensions: { Args: { _user_id: string }; Returns: Json }
      consume_telegram_link_code: {
        Args: {
          p_code: string
          p_language_code?: string
          p_telegram_user_id: number
          p_telegram_username?: string
        }
        Returns: string
      }
      create_attestation:
        | {
            Args: {
              _attestation_type: string
              _evidence: Json
              _expires_in_days: number
              _to_did: string
              _weight: number
            }
            Returns: Json
          }
        | {
            Args: {
              _attestation_type: string
              _evidence?: Json
              _to_did_id: string
            }
            Returns: Json
          }
      create_circle_lamp:
        | {
            Args: { p_ends_at?: string; p_name: string; p_target: number }
            Returns: string
          }
        | {
            Args: {
              p_ends_at?: string
              p_loot_tier?: string
              p_name: string
              p_target: number
            }
            Returns: string
          }
      create_knowledge_doc_version: {
        Args: {
          _activate?: boolean
          _new_content: string
          _source_id: string
          _title?: string
        }
        Returns: string
      }
      create_knowledge_new_version: {
        Args: {
          _content: string
          _id: string
          _reason?: string
          _title: string
        }
        Returns: string
      }
      create_light_circle: {
        Args: {
          p_emoji: string
          p_is_open: boolean
          p_motto: string
          p_name: string
        }
        Returns: string
      }
      create_light_circle_invite: {
        Args: { p_circle_id: string }
        Returns: string
      }
      create_recovery_request: {
        Args: { _payload?: Json; _reason?: string; _request_type: string }
        Returns: string
      }
      create_telegram_link_code: { Args: never; Returns: string }
      create_treasure_team: {
        Args: { p_event_id: string; p_max_size?: number; p_name: string }
        Returns: string
      }
      dedupe_telegram_docs: {
        Args: { _dry_run?: boolean }
        Returns: {
          deleted: number
          docs_to_delete: number
          duplicate_groups: number
        }[]
      }
      deprecate_knowledge_doc: {
        Args: { _id: string; _reason?: string }
        Returns: undefined
      }
      detect_behavior_sequences: {
        Args: { _action_id: string; _action_type: string; _user_id: string }
        Returns: Json
      }
      detect_coordinated_timing: {
        Args: never
        Returns: {
          action_count: number
          pattern_days: number
          time_window: string
          user_count: number
          user_ids: string[]
        }[]
      }
      detect_cross_account_content_similarity: {
        Args: never
        Returns: {
          content_hash: string
          detected_at: string
          sample_content: string
          user_count: number
          user_ids: string[]
        }[]
      }
      detect_slash_candidates: {
        Args: { _limit?: number }
        Returns: {
          detection_type: string
          did: string
          did_id: string
          display_name: string
          evidence: Json
          reason: string
          severity: string
          stake_amount: number
          stake_id: string
          suggested_slash_pct: number
          user_id: string
        }[]
      }
      detect_sybil_clusters: {
        Args: { _days?: number; _limit?: number; _min_size?: number }
        Returns: {
          avg_risk: number
          cluster_key: string
          edge_count: number
          member_count: number
          member_dids: Json
          reciprocal_ratio: number
        }[]
      }
      detect_wallet_clusters: {
        Args: never
        Returns: {
          collector_wallet: string
          first_seen: string
          last_seen: string
          sender_count: number
          sender_user_ids: string[]
          token_types: string[]
          total_amount: number
        }[]
      }
      distribute_validator_reward: {
        Args: {
          _amount: number
          _did_id: string
          _source_ref?: string
          _source_type: string
        }
        Returns: Json
      }
      enqueue_nft_mint: {
        Args: {
          p_collection: string
          p_source_ref: string
          p_source_type: string
          p_traits?: Json
          p_user_id: string
        }
        Returns: string
      }
      enqueue_sbt_mint: {
        Args: {
          _metadata_uri?: string
          _network?: string
          _sbt_id: string
          _wallet_address: string
        }
        Returns: Json
      }
      execute_recovery: { Args: { _request_id: string }; Returns: Json }
      expire_old_bosses: { Args: never; Returns: number }
      expire_old_mint_requests: { Args: never; Returns: number }
      flag_post_attestation: {
        Args: { _attestation_id: string; _from_did: string; _from_user: string }
        Returns: undefined
      }
      fn_random_nft_traits: {
        Args: { p_collection: string; p_user: string }
        Returns: Json
      }
      forge_combine: {
        Args: { p_nft_ids: string[]; p_recipe_id: string }
        Returns: Json
      }
      forge_get_my_state: { Args: never; Returns: Json }
      freeze_user_pending_rewards: {
        Args: { _reason?: string; _user_id: string }
        Returns: number
      }
      get_account_age_days: { Args: { _user_id: string }; Returns: number }
      get_account_age_gate: {
        Args: { _user_id: string }
        Returns: {
          account_age_days: number
          gate_level: string
          max_actions_per_day: number
          reward_multiplier: number
        }[]
      }
      get_active_boss: { Args: never; Returns: Json }
      get_active_circle_lamp: { Args: never; Returns: Json }
      get_active_policy: {
        Args: never
        Returns: {
          action_configs: Json | null
          activated_at: string | null
          approved_by: string[] | null
          arweave_tx: string | null
          caps: Json | null
          changelog: string | null
          created_at: string
          created_by: string | null
          deprecated_at: string | null
          deprecation_reason: string | null
          description: string | null
          formulas: Json | null
          ipfs_cid: string | null
          is_active: boolean
          policy_hash: string | null
          policy_json: Json
          required_approvals: number | null
          thresholds: Json | null
          updated_at: string | null
          version: string
          version_int: number | null
        }
        SetofOptions: {
          from: "*"
          to: "pplp_policies"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_active_season: { Args: never; Returns: Json }
      get_activity_history_stats: {
        Args: never
        Returns: {
          rewarded_chats: number
          total_chats: number
          total_rewards: number
          unique_users: number
        }[]
      }
      get_admin_statistics: {
        Args: {
          _date_filter?: string
          _today_start?: string
          _week_start?: string
        }
        Returns: {
          average_per_transaction: number
          today_coins: number
          total_coins_distributed: number
          total_transactions: number
          total_users: number
          unique_recipients: number
          week_coins: number
        }[]
      }
      get_admin_user_management_data: {
        Args: never
        Returns: {
          avatar_url: string
          camly_balance: number
          camly_lifetime_earned: number
          camly_lifetime_spent: number
          comment_count: number
          display_name: string
          fun_money_received: number
          gift_internal_received: number
          gift_internal_sent: number
          gift_web3_received: number
          gift_web3_sent: number
          handle: string
          joined_at: string
          light_score: number
          negative_actions: number
          popl_score: number
          positive_actions: number
          post_count: number
          pplp_action_count: number
          pplp_minted_count: number
          total_withdrawn: number
          user_id: string
          wallet_address: string
          withdrawal_count: number
        }[]
      }
      get_ai_core_kpi: { Args: never; Returns: Json }
      get_ai_provider_mix: {
        Args: { _days?: number }
        Returns: {
          calls: number
          pct: number
          provider: string
        }[]
      }
      get_ascension_bonus_stats: { Args: { p_user_id: string }; Returns: Json }
      get_ascension_state: { Args: { p_user_id?: string }; Returns: Json }
      get_attestation_abuse_flags: {
        Args: { _limit?: number; _only_unresolved?: boolean }
        Returns: {
          created_at: string
          details: Json
          did_id: string
          did_identifier: string
          flag_type: string
          id: string
          is_resolved: boolean
          related_attestation_id: string
          severity: number
          user_email: string
          user_id: string
        }[]
      }
      get_attestations_for_did: {
        Args: { _did_id: string }
        Returns: {
          attestation_type: string
          counterparty_did: string
          counterparty_label: string
          created_at: string
          direction: string
          evidence: Json
          expires_at: string
          id: string
          status: string
          weight: number
        }[]
      }
      get_backlog_audit_summary: { Args: never; Returns: Json }
      get_boss_loot_preview: { Args: { p_boss_id: string }; Returns: Json }
      get_cloud_cost_daily: {
        Args: { _days?: number }
        Returns: {
          avg_latency_ms: number
          calls: number
          day: string
          errors: number
          fallbacks: number
          p95_latency_ms: number
          tokens_in: number
          tokens_out: number
        }[]
      }
      get_cloud_cost_top_intents: {
        Args: { _days?: number; _limit?: number }
        Returns: {
          avg_latency_ms: number
          calls: number
          errors: number
          intent: string
          model_used: string
          tokens_total: number
        }[]
      }
      get_cloud_footprint: { Args: never; Returns: Json }
      get_cloud_top_slow_queries: {
        Args: { _limit?: number }
        Returns: {
          calls: number
          max_ms: number
          mean_ms: number
          query: string
          rows_returned: number
          total_ms: number
        }[]
      }
      get_cloud_usage_series: {
        Args: {
          _from: string
          _granularity?: string
          _group_by?: string
          _to: string
        }
        Returns: {
          bucket: string
          error_count: number
          estimated_cost_usd: number
          grp_key: string
          invocations: number
          total_ms: number
        }[]
      }
      get_cloud_usage_top_functions: {
        Args: { _from: string; _limit?: number; _to: string }
        Returns: {
          avg_ms: number
          category: string
          error_count: number
          estimated_cost_usd: number
          feature: string
          function_name: string
          invocations: number
          total_ms: number
        }[]
      }
      get_community_light_summary: {
        Args: { _user_ids: string[] }
        Returns: {
          avatar_url: string
          completed_sequences: number
          display_name: string
          handle: string
          level_color: string
          level_icon: string
          level_name_vi: string
          light_level: number
          total_score: number
          user_id: string
        }[]
      }
      get_daily_ai_usage: {
        Args: { _user_id: string }
        Returns: {
          daily_limit: number
          usage_count: number
          usage_type: string
        }[]
      }
      get_daily_reward_status: {
        Args: { _user_id: string }
        Returns: {
          can_write_journal: boolean
          journals_remaining: number
          journals_rewarded: number
          questions_remaining: number
          questions_rewarded: number
        }[]
      }
      get_daily_trends: {
        Args: { _date_filter?: string }
        Returns: {
          total_coins: number
          transaction_count: number
          trend_date: string
        }[]
      }
      get_did_risk_score: { Args: { _did_id: string }; Returns: Json }
      get_early_adopter_rank: { Args: { p_user_id: string }; Returns: number }
      get_effective_tc: { Args: { _user_id: string }; Returns: Json }
      get_extended_daily_reward_status: {
        Args: { _user_id: string }
        Returns: {
          can_write_journal: boolean
          community_helps_remaining: number
          community_helps_rewarded: number
          current_streak: number
          feedbacks_remaining: number
          feedbacks_rewarded: number
          ideas_remaining: number
          ideas_submitted: number
          journals_remaining: number
          journals_rewarded: number
          knowledge_uploads: number
          knowledge_uploads_remaining: number
          logins_rewarded: number
          questions_remaining: number
          questions_rewarded: number
          shares_remaining: number
          shares_rewarded: number
          total_coins_today: number
        }[]
      }
      get_guardian_inbox: {
        Args: never
        Returns: {
          avatar_url: string
          display_name: string
          email: string
          invited_at: string
          pending_requests: number
          relationship_id: string
          status: string
          user_id: string
        }[]
      }
      get_image_error_rates: {
        Args: { _days?: number }
        Returns: {
          error_code: string
          event_count: number
          pct: number
          provider: string
        }[]
      }
      get_knowledge_folder_stats: {
        Args: never
        Returns: {
          doc_count: number
          failed_count: number
          folder_id: string
          folder_name: string
          icon: string
          last_ingested_at: string
          parent_id: string
          pending_count: number
          ready_count: number
          sort_order: number
        }[]
      }
      get_knowledge_totals: {
        Args: never
        Returns: {
          computed_at: string
          deleted_docs: number
          orphan_docs: number
          total_chunks: number
          total_docs: number
          total_folders: number
        }[]
      }
      get_lamp_loot: { Args: { p_lamp_id: string }; Returns: Json }
      get_mastery_state: { Args: never; Returns: Json }
      get_mint_pipeline_health: { Args: never; Returns: Json }
      get_mint_request_stats: { Args: never; Returns: Json }
      get_my_guardians: {
        Args: never
        Returns: {
          accepted_at: string
          avatar_url: string
          display_name: string
          email: string
          guardian_user_id: string
          id: string
          invited_at: string
          status: string
        }[]
      }
      get_my_light_circle: { Args: never; Returns: Json }
      get_my_pending_claim: { Args: never; Returns: Json }
      get_my_recovery_requests: {
        Args: never
        Returns: {
          approvals_count: number
          created_at: string
          executed_at: string
          expires_at: string
          id: string
          reason: string
          rejections_count: number
          request_type: string
          required_approvals: number
          status: string
        }[]
      }
      get_my_validator_portfolio: { Args: never; Returns: Json }
      get_next_nonce: { Args: { _user_id: string }; Returns: number }
      get_operational_health: { Args: never; Returns: Json }
      get_org_by_did: { Args: { _did: string }; Returns: Json }
      get_pending_recovery_for_guardian: {
        Args: never
        Returns: {
          approvals_count: number
          avatar_url: string
          created_at: string
          display_name: string
          expires_at: string
          reason: string
          rejections_count: number
          request_id: string
          request_type: string
          required_approvals: number
          user_id: string
        }[]
      }
      get_pet_multiplier: { Args: { p_user_id: string }; Returns: number }
      get_sbt_mint_queue_stats: { Args: never; Returns: Json }
      get_season_coop_spotlight: { Args: never; Returns: Json }
      get_system_health_overview:
        | { Args: never; Returns: Json }
        | { Args: { p_hours?: number }; Returns: Json }
      get_team_jackpot_split: { Args: { p_team_id: string }; Returns: Json }
      get_telegram_webapp_summary: {
        Args: { p_user_id: string }
        Returns: Json
      }
      get_top_recipients: {
        Args: { _date_filter?: string; _limit?: number }
        Returns: {
          avatar_url: string
          display_name: string
          total_earned: number
          transaction_count: number
          user_id: string
        }[]
      }
      get_top_risky_dids: {
        Args: { _limit?: number }
        Returns: {
          did: string
          did_id: string
          display_name: string
          flags_open: number
          flags_total: number
          risk_band: string
          risk_score: number
          sybil_risk: string
          trust_tier: string
        }[]
      }
      get_top_validators: {
        Args: { _limit?: number }
        Returns: {
          did: string
          did_id: string
          display_name: string
          is_verified: boolean
          logo_url: string
          slug: string
          total_stake: number
          trust_tier: string
        }[]
      }
      get_transaction_type_stats: {
        Args: { _date_filter?: string }
        Returns: {
          total_amount: number
          transaction_count: number
          transaction_type: string
        }[]
      }
      get_treasure_team_progress: {
        Args: { p_team_id: string }
        Returns: {
          is_leader: boolean
          joined_at: string
          solved_count: number
          user_id: string
        }[]
      }
      get_treasury_status: { Args: never; Returns: Json }
      get_trust_admin_stats: { Args: never; Returns: Json }
      get_trust_cron_health: {
        Args: { _limit?: number }
        Returns: {
          duration_ms: number
          end_time: string
          jobname: string
          return_message: string
          start_time: string
          status: string
        }[]
      }
      get_trust_graph: {
        Args: { _days?: number; _max_edges?: number; _seed_did: string }
        Returns: Json
      }
      get_trust_live_telemetry: { Args: never; Returns: Json }
      get_trust_tier: { Args: { _tc: number }; Returns: string }
      get_trust_trend: {
        Args: { _days?: number; _user_id: string }
        Returns: {
          days_inactive: number
          decay_factor: number
          snapshot_date: string
          tc: number
          trust_tier: string
        }[]
      }
      get_urantia_paper: {
        Args: { p_number: number }
        Returns: {
          chunk_count: number
          extracted_content: string
          id: string
          ingest_status: string
          title: string
        }[]
      }
      get_user_achievements: { Args: { _user_id?: string }; Returns: Json }
      get_user_light_level: { Args: { _user_id: string }; Returns: Json }
      get_user_permissions: { Args: { _user_id: string }; Returns: Json }
      get_user_pplp_stats: {
        Args: { _user_id: string }
        Returns: {
          avg_light_score: number
          avg_pillar_c: number
          avg_pillar_h: number
          avg_pillar_s: number
          avg_pillar_t: number
          avg_pillar_u: number
          minted_actions: number
          scored_actions: number
          total_actions: number
          total_rewards: number
        }[]
      }
      get_user_withdrawal_status: {
        Args: { _user_id: string }
        Returns: {
          available_balance: number
          can_withdraw: boolean
          pending_amount: number
          remaining_daily_limit: number
          total_withdrawn: number
          withdrawn_today: number
        }[]
      }
      get_validator_detail_extended: {
        Args: { _did_id: string }
        Returns: Json
      }
      get_validator_marketplace_list: {
        Args: {
          _category?: string
          _limit?: number
          _offset?: number
          _search?: string
          _sort?: string
        }
        Returns: {
          attestation_count_30d: number
          avg_weight: number
          category: string
          description: string
          did_id: string
          display_name: string
          is_verified: boolean
          logo_url: string
          registered_at: string
          slug: string
          staker_count: number
          sybil_risk: string
          tier: string
          total_stake: number
          uptime_score: number
        }[]
      }
      get_validator_pending_rewards: { Args: never; Returns: Json }
      get_weekly_quests: { Args: never; Returns: Json }
      grant_achievement: {
        Args: { _code: string; _meta?: Json; _user_id: string }
        Returns: boolean
      }
      grant_box_ticket: {
        Args: {
          p_source: string
          p_source_ref?: string
          p_tier_code: string
          p_user_id: string
        }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_ai_usage: {
        Args: { _usage_type: string; _user_id: string }
        Returns: number
      }
      increment_api_key_usage: {
        Args: { _api_key_id: string; _tokens_used?: number }
        Returns: undefined
      }
      increment_early_adopter_questions: {
        Args: { p_user_id: string }
        Returns: number
      }
      increment_user_tier_stats: {
        Args: { p_is_pass: boolean; p_user_id: string }
        Returns: undefined
      }
      ingest_knowledge_chunks: {
        Args: { _doc_id: string; _rows: Json }
        Returns: number
      }
      is_admin: { Args: never; Returns: boolean }
      is_coordinator_or_admin: { Args: { _user_id: string }; Returns: boolean }
      is_knowledge_document_active: {
        Args: {
          _doc: Database["public"]["Tables"]["knowledge_documents"]["Row"]
        }
        Returns: boolean
      }
      is_light_circle_member: {
        Args: { _circle: string; _user: string }
        Returns: boolean
      }
      is_light_circle_officer: {
        Args: { _circle: string; _user: string }
        Returns: boolean
      }
      is_user_approved: { Args: { _user_id: string }; Returns: boolean }
      is_user_suspended: { Args: { _user_id: string }; Returns: boolean }
      issue_sbt: {
        Args: {
          _did_id: string
          _evidence_hash?: string
          _issuer?: string
          _metadata?: Json
          _sbt_subtype: string
          _sbt_type: string
          _trust_weight?: number
        }
        Returns: string
      }
      join_light_circle_by_code: { Args: { p_code: string }; Returns: string }
      join_open_light_circle: { Args: { p_circle_id: string }; Returns: string }
      join_treasure_team: { Args: { p_team_id: string }; Returns: Json }
      knowledge_export_collection_counts: {
        Args: never
        Returns: {
          active_count: number
          folder_id: string
          item_count: number
          last_updated_at: string
        }[]
      }
      knowledge_nightly_integrity: { Args: never; Returns: Json }
      lantern_claim_weekly_bonus: {
        Args: { p_week_start?: string }
        Returns: Json
      }
      lantern_complete_day: {
        Args: {
          p_ai_score: number
          p_day_idx: number
          p_evidence: string
          p_theme_key: string
        }
        Returns: Json
      }
      lantern_current_week: { Args: never; Returns: Json }
      lantern_get_my_progress: {
        Args: { p_week_start?: string }
        Returns: Json
      }
      lantern_themes: { Args: never; Returns: Json }
      lantern_week_start_vn: { Args: never; Returns: string }
      leave_light_circle: { Args: never; Returns: boolean }
      leave_treasure_team: { Args: { p_team_id: string }; Returns: Json }
      list_deleted_knowledge_docs: {
        Args: { _limit?: number }
        Returns: {
          chunk_count: number
          deleted_at: string
          folder_id: string
          id: string
          latest_backup_date: string
          latest_backup_id: string
          source: string
          title: string
        }[]
      }
      list_open_light_circles: { Args: { p_limit?: number }; Returns: Json }
      list_open_treasure_teams: {
        Args: { p_event_id: string }
        Returns: {
          leader_user_id: string
          max_size: number
          member_count: number
          name: string
          team_id: string
        }[]
      }
      log_box_function_error: {
        Args: {
          p_context?: Json
          p_function_name: string
          p_message: string
          p_severity?: string
          p_sqlstate: string
          p_user_id: string
        }
        Returns: undefined
      }
      log_cloud_usage: {
        Args: {
          _bucket_start: string
          _cost: number
          _duration_ms: number
          _error: boolean
          _function_name: string
        }
        Returns: undefined
      }
      mark_sbt_failed: {
        Args: { _error_message: string; _queue_id: string }
        Returns: Json
      }
      mark_sbt_minted: {
        Args: {
          _block_number: number
          _contract_address: string
          _on_chain_token_id: string
          _queue_id: string
          _tx_hash: string
        }
        Returns: Json
      }
      mastery_level_from_xp: { Args: { p_xp: number }; Returns: number }
      match_knowledge_chunks: {
        Args: {
          match_count?: number
          min_similarity?: number
          query_embedding: string
        }
        Returns: {
          chunk_id: string
          chunk_text: string
          doc_title: string
          document_id: string
          folder_name: string
          similarity: number
        }[]
      }
      match_knowledge_hybrid: {
        Args: {
          match_count?: number
          min_similarity?: number
          query_embedding: string
          query_text: string
        }
        Returns: {
          chunk_id: string
          chunk_text: string
          chunk_type: string
          doc_title: string
          document_id: string
          folder_name: string
          is_authoritative: boolean
          rrf_score: number
          similarity: number
        }[]
      }
      match_urantia_chunks: {
        Args: {
          match_count?: number
          min_similarity?: number
          query_embedding: string
          query_text: string
          requested_language: string
        }
        Returns: {
          chunk_id: string
          chunk_text: string
          corpus: string
          document_id: string
          edition: string
          language: string
          paper_number: number
          paper_title: string
          paragraph_end: string
          paragraph_ids: string[]
          paragraph_start: string
          part_number: number
          section_number: number
          section_title: string
          similarity: number
          source_version: string
          version_id: string
        }[]
      }
      notify_attesters: { Args: { p_request_id: string }; Returns: Json }
      peek_treasure_team_members: {
        Args: { p_team_id: string }
        Returns: {
          avatar_url: string
          display_name: string
          handle: string
          is_leader: boolean
          joined_at: string
          user_id: string
        }[]
      }
      pet_aura_bonus_for_evolution: {
        Args: { _e: Database["public"]["Enums"]["pet_evolution"] }
        Returns: number
      }
      pet_evolution_for_level: {
        Args: { _lvl: number }
        Returns: Database["public"]["Enums"]["pet_evolution"]
      }
      pet_evolution_for_total_xp: {
        Args: { _total_xp: number }
        Returns: Database["public"]["Enums"]["pet_evolution"]
      }
      pet_gain_xp: {
        Args: {
          p_source: string
          p_source_ref?: string
          p_user_id: string
          p_xp: number
        }
        Returns: Json
      }
      pet_xp_for_level: { Args: { _lvl: number }; Returns: number }
      preview_epoch_allocation: {
        Args: { _user_id: string }
        Returns: {
          adaptive_mint_base: number
          adaptive_mint_contribution: number
          adaptive_mint_ecosystem: number
          days_remaining: number
          discipline_modulator: number
          epoch_period: string
          estimated_allocation: number
          ineligibility_reason: string
          instant_amount: number
          is_eligible: boolean
          locked_amount: number
          micro_epoch_score: number
          mint_epoch_progress: number
          mint_pool: number
          my_light_score: number
          my_ratio: number
          total_light: number
          validation_epoch_score: number
          vesting_days: number
        }[]
      }
      process_daily_login: {
        Args: { _user_id: string }
        Returns: {
          already_logged_in: boolean
          coins_earned: number
          is_streak_bonus: boolean
          new_balance: number
          streak_count: number
        }[]
      }
      process_early_adopter_reward: {
        Args: { p_user_id: string }
        Returns: {
          coins_awarded: number
          message: string
          success: boolean
          user_rank: number
        }[]
      }
      propose_auto_slash: { Args: { _limit?: number }; Returns: Json }
      purge_old_system_logs: { Args: { _days?: number }; Returns: Json }
      recompute_user_light_score: {
        Args: { _user_id: string }
        Returns: undefined
      }
      register_device_fingerprint: {
        Args: { _device_hash: string; _user_id: string }
        Returns: Json
      }
      register_early_adopter: { Args: { p_user_id: string }; Returns: boolean }
      register_org_or_validator: {
        Args: {
          _category?: string
          _description?: string
          _display_name: string
          _entity_type: string
          _logo_url?: string
          _website?: string
        }
        Returns: Json
      }
      register_referral: { Args: { p_referrer: string }; Returns: Json }
      reject_slash_proposal: {
        Args: { _notes?: string; _proposal_id: string }
        Returns: Json
      }
      release_pending_rewards: {
        Args: never
        Returns: {
          frozen_count: number
          released_count: number
          total_amount: number
        }[]
      }
      request_coin_withdrawal: {
        Args: { _amount: number; _user_id: string; _wallet_address: string }
        Returns: {
          message: string
          success: boolean
          withdrawal_id: string
        }[]
      }
      restore_doc_from_backup: { Args: { _backup_id: string }; Returns: Json }
      restore_knowledge_docs: { Args: { _ids: string[] }; Returns: number }
      retry_nft_mint: { Args: { p_item_id: string }; Returns: Json }
      reveal_box_ticket: { Args: { p_ticket_id: string }; Returns: Json }
      reveal_private_attestation: {
        Args: {
          _attestation_type: string
          _commitment_id: string
          _evidence?: Json
          _expected_hash: string
          _nonce: string
          _to_did: string
          _weight: number
        }
        Returns: Json
      }
      review_chat_feedback: {
        Args: {
          _admin_note?: string
          _id: string
          _linked_document_id?: string
          _status: string
        }
        Returns: undefined
      }
      revoke_attestation: { Args: { _attestation_id: string }; Returns: Json }
      revoke_guardian: { Args: { _relationship_id: string }; Returns: boolean }
      riddle_exchange_sparks: { Args: never; Returns: Json }
      riddle_get_today: { Args: never; Returns: Json }
      riddle_record_attempt: {
        Args: {
          p_ai_reason: string
          p_ai_score: number
          p_answer: string
          p_riddle_id: string
          p_user_id: string
        }
        Returns: Json
      }
      rollback_knowledge_collection: {
        Args: { _previous_collection_id: string }
        Returns: Json
      }
      run_cross_account_scan: { Args: never; Returns: Json }
      schedule_random_audit: { Args: never; Returns: number }
      search_user_for_attestation: {
        Args: { _query: string }
        Returns: {
          did_id: string
          did_identifier: string
          display_name: string
          trust_tier: string
          user_email: string
        }[]
      }
      send_light_circle_message: { Args: { p_body: string }; Returns: string }
      send_treasure_team_message: {
        Args: { p_content: string; p_team_id: string }
        Returns: string
      }
      set_active_title: { Args: { _code: string }; Returns: Json }
      set_knowledge_status: {
        Args: { _id: string; _reason?: string; _status: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      slash_validator: {
        Args: { _reason: string; _slash_pct?: number; _stake_id: string }
        Returns: Json
      }
      smoke_test_box_flow: { Args: never; Returns: Json }
      stake_for_validator: { Args: { _amount: number }; Returns: Json }
      submit_knowledge_review: {
        Args: { _id: string; _note?: string }
        Returns: undefined
      }
      submit_treasure_answer: {
        Args: { p_answer: string; p_clue_id: string }
        Returns: Json
      }
      take_identity_snapshot: {
        Args: { _did_id: string; _epoch: string }
        Returns: Json
      }
      transfer_camly_coin: {
        Args: {
          p_amount: number
          p_description_receiver?: string
          p_description_sender?: string
          p_metadata_receiver?: Json
          p_metadata_sender?: Json
          p_receiver_id: string
          p_sender_id: string
        }
        Returns: Json
      }
      try_complete_referral: { Args: never; Returns: Json }
      unaccent: { Args: { "": string }; Returns: string }
      unlock_season_premium: { Args: never; Returns: Json }
      unstake_validator: { Args: { _stake_id: string }; Returns: Json }
      update_popl_score: {
        Args: { _action_type: string; _is_positive: boolean; _user_id: string }
        Returns: number
      }
      update_trust_profile: { Args: { _did_id: string }; Returns: Json }
      update_user_tier: {
        Args: { _user_id: string }
        Returns: {
          cap_multiplier: number
          community_vouches: number
          contribution_days_30: number | null
          contribution_days_90: number | null
          created_at: string
          failed_actions: number
          fraud_flags: number
          known_device_hashes: string[] | null
          last_device_hash: string | null
          last_tier_change: string | null
          passed_actions: number
          stake_locked_until: string | null
          staked_amount: number
          tier: number
          tier_change_reason: string | null
          total_actions_scored: number
          trust_score: number
          updated_at: string
          user_id: string
          verified_connections: number
        }
        SetofOptions: {
          from: "*"
          to: "pplp_user_tiers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      validate_api_key: {
        Args: { _key_hash: string }
        Returns: {
          api_key_id: string
          current_usage: number
          daily_limit: number
          is_rate_limited: boolean
          scope: string
          status: string
          user_id: string
        }[]
      }
      validate_policy_version: { Args: { _version: string }; Returns: Json }
      vote_recovery_request: {
        Args: { _decision: string; _reason?: string; _request_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "user" | "coordinator"
      approval_status: "pending" | "approved" | "rejected" | "trial"
      coin_transaction_type:
        | "chat_reward"
        | "gratitude_reward"
        | "journal_reward"
        | "engagement_reward"
        | "referral_bonus"
        | "challenge_reward"
        | "spending"
        | "admin_adjustment"
        | "daily_login"
        | "bounty_reward"
        | "build_idea"
        | "content_share"
        | "knowledge_upload"
        | "feedback_reward"
        | "vision_reward"
        | "community_support"
        | "gift_sent"
        | "gift_received"
        | "project_donation"
        | "project_reward"
        | "pplp_reward"
        | "lixi_claim"
        | "quest_reward"
        | "box_reveal"
        | "season_pass_reward"
        | "lantern_day"
        | "lantern_weekly"
        | "riddle_solve"
        | "riddle_spark_exchange"
        | "forge_burn"
        | "forge_reward"
      energy_level: "very_high" | "high" | "neutral" | "low" | "very_low"
      light_circle_role: "founder" | "steward" | "member"
      pet_element: "fire" | "water" | "earth" | "air" | "light"
      pet_evolution: "spark" | "glow" | "flame" | "star" | "sun" | "cosmos"
      pet_personality: "joyful" | "wise" | "bold" | "gentle"
      pplp_action_status:
        | "pending"
        | "scoring"
        | "scored"
        | "minted"
        | "rejected"
        | "disputed"
      pplp_action_type:
        | "LEARN_COMPLETE"
        | "PROJECT_SUBMIT"
        | "MENTOR_HELP"
        | "COURSE_CREATE"
        | "QUIZ_PASS"
        | "CONTENT_CREATE"
        | "CONTENT_REVIEW"
        | "CONTENT_SHARE"
        | "COMMENT_CREATE"
        | "POST_ENGAGEMENT"
        | "DONATE"
        | "VOLUNTEER"
        | "CAMPAIGN_CREATE"
        | "CAMPAIGN_SUPPORT"
        | "TREE_PLANT"
        | "CLEANUP_EVENT"
        | "CARBON_OFFSET"
        | "ECO_ACTION"
        | "FARM_DELIVERY"
        | "MARKET_FAIR_TRADE"
        | "PRODUCT_REVIEW"
        | "SELLER_VERIFY"
        | "BUG_BOUNTY"
        | "GOV_PROPOSAL"
        | "GOV_VOTE"
        | "DISPUTE_RESOLVE"
        | "POLICY_REVIEW"
        | "DAILY_RITUAL"
        | "GRATITUDE_PRACTICE"
        | "JOURNAL_WRITE"
        | "QUESTION_ASK"
        | "DAILY_LOGIN"
        | "STAKE_LOCK"
        | "LIQUIDITY_PROVIDE"
        | "REFERRAL_INVITE"
        | "PROFILE_COMPLETE"
        | "KYC_VERIFY"
        | "REPUTATION_EARN"
      pplp_decision: "pass" | "fail" | "pending" | "manual_review"
      pplp_dispute_status: "open" | "investigating" | "resolved" | "rejected"
      pplp_evidence_type:
        | "QUIZ_SCORE"
        | "CERTIFICATE"
        | "SCREENSHOT"
        | "TRANSACTION_HASH"
        | "GPS_LOCATION"
        | "PHOTO_PROOF"
        | "VIDEO_PROOF"
        | "DOCUMENT"
        | "API_RESPONSE"
        | "DEVICE_SIGNATURE"
        | "USER_ATTESTATION"
        | "THIRD_PARTY_VERIFY"
        | "IPFS_HASH"
        | "CONTENT_HASH"
      pplp_integrity_signal:
        | "DEVICE_FINGERPRINT"
        | "SESSION_CONTINUITY"
        | "IP_CONSISTENCY"
        | "BEHAVIORAL_PATTERN"
        | "CAPTCHA_PASS"
        | "ANTI_SYBIL_CHECK"
        | "TIME_PATTERN_VALID"
        | "LOCATION_VALID"
      reputation_level: "seed" | "sprout" | "builder" | "guardian" | "architect"
      suspension_type: "temporary" | "permanent"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "user", "coordinator"],
      approval_status: ["pending", "approved", "rejected", "trial"],
      coin_transaction_type: [
        "chat_reward",
        "gratitude_reward",
        "journal_reward",
        "engagement_reward",
        "referral_bonus",
        "challenge_reward",
        "spending",
        "admin_adjustment",
        "daily_login",
        "bounty_reward",
        "build_idea",
        "content_share",
        "knowledge_upload",
        "feedback_reward",
        "vision_reward",
        "community_support",
        "gift_sent",
        "gift_received",
        "project_donation",
        "project_reward",
        "pplp_reward",
        "lixi_claim",
        "quest_reward",
        "box_reveal",
        "season_pass_reward",
        "lantern_day",
        "lantern_weekly",
        "riddle_solve",
        "riddle_spark_exchange",
        "forge_burn",
        "forge_reward",
      ],
      energy_level: ["very_high", "high", "neutral", "low", "very_low"],
      light_circle_role: ["founder", "steward", "member"],
      pet_element: ["fire", "water", "earth", "air", "light"],
      pet_evolution: ["spark", "glow", "flame", "star", "sun", "cosmos"],
      pet_personality: ["joyful", "wise", "bold", "gentle"],
      pplp_action_status: [
        "pending",
        "scoring",
        "scored",
        "minted",
        "rejected",
        "disputed",
      ],
      pplp_action_type: [
        "LEARN_COMPLETE",
        "PROJECT_SUBMIT",
        "MENTOR_HELP",
        "COURSE_CREATE",
        "QUIZ_PASS",
        "CONTENT_CREATE",
        "CONTENT_REVIEW",
        "CONTENT_SHARE",
        "COMMENT_CREATE",
        "POST_ENGAGEMENT",
        "DONATE",
        "VOLUNTEER",
        "CAMPAIGN_CREATE",
        "CAMPAIGN_SUPPORT",
        "TREE_PLANT",
        "CLEANUP_EVENT",
        "CARBON_OFFSET",
        "ECO_ACTION",
        "FARM_DELIVERY",
        "MARKET_FAIR_TRADE",
        "PRODUCT_REVIEW",
        "SELLER_VERIFY",
        "BUG_BOUNTY",
        "GOV_PROPOSAL",
        "GOV_VOTE",
        "DISPUTE_RESOLVE",
        "POLICY_REVIEW",
        "DAILY_RITUAL",
        "GRATITUDE_PRACTICE",
        "JOURNAL_WRITE",
        "QUESTION_ASK",
        "DAILY_LOGIN",
        "STAKE_LOCK",
        "LIQUIDITY_PROVIDE",
        "REFERRAL_INVITE",
        "PROFILE_COMPLETE",
        "KYC_VERIFY",
        "REPUTATION_EARN",
      ],
      pplp_decision: ["pass", "fail", "pending", "manual_review"],
      pplp_dispute_status: ["open", "investigating", "resolved", "rejected"],
      pplp_evidence_type: [
        "QUIZ_SCORE",
        "CERTIFICATE",
        "SCREENSHOT",
        "TRANSACTION_HASH",
        "GPS_LOCATION",
        "PHOTO_PROOF",
        "VIDEO_PROOF",
        "DOCUMENT",
        "API_RESPONSE",
        "DEVICE_SIGNATURE",
        "USER_ATTESTATION",
        "THIRD_PARTY_VERIFY",
        "IPFS_HASH",
        "CONTENT_HASH",
      ],
      pplp_integrity_signal: [
        "DEVICE_FINGERPRINT",
        "SESSION_CONTINUITY",
        "IP_CONSISTENCY",
        "BEHAVIORAL_PATTERN",
        "CAPTCHA_PASS",
        "ANTI_SYBIL_CHECK",
        "TIME_PATTERN_VALID",
        "LOCATION_VALID",
      ],
      reputation_level: ["seed", "sprout", "builder", "guardian", "architect"],
      suspension_type: ["temporary", "permanent"],
    },
  },
} as const
