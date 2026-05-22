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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          visibility: Database["public"]["Enums"]["activity_visibility"]
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          visibility?: Database["public"]["Enums"]["activity_visibility"]
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          visibility?: Database["public"]["Enums"]["activity_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_insights: {
        Row: {
          action_label: string | null
          action_payload: Json | null
          agent_key: string
          body: string
          completed_at: string | null
          created_at: string
          dismissed_at: string | null
          expires_at: string | null
          id: string
          parent_id: string
          parent_type: string
          severity: string
          title: string
        }
        Insert: {
          action_label?: string | null
          action_payload?: Json | null
          agent_key: string
          body: string
          completed_at?: string | null
          created_at?: string
          dismissed_at?: string | null
          expires_at?: string | null
          id?: string
          parent_id: string
          parent_type: string
          severity?: string
          title: string
        }
        Update: {
          action_label?: string | null
          action_payload?: Json | null
          agent_key?: string
          body?: string
          completed_at?: string | null
          created_at?: string
          dismissed_at?: string | null
          expires_at?: string | null
          id?: string
          parent_id?: string
          parent_type?: string
          severity?: string
          title?: string
        }
        Relationships: []
      }
      attachments: {
        Row: {
          created_at: string
          filename: string
          id: string
          mime_type: string | null
          parent_id: string
          parent_type: string
          size_bytes: number | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          filename: string
          id?: string
          mime_type?: string | null
          parent_id: string
          parent_type: string
          size_bytes?: number | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          filename?: string
          id?: string
          mime_type?: string | null
          parent_id?: string
          parent_type?: string
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      block_requests: {
        Row: {
          adults: number
          check_in_time: string | null
          check_out_time: string | null
          children: number
          cleaning_fee: number | null
          confirmed_at: string | null
          created_at: string
          damage_acknowledged: boolean
          end_date: string
          guest_email: string | null
          guest_name: string | null
          guest_phone: string | null
          id: string
          is_owner_staying: boolean
          needs_lock_code: boolean
          note: string | null
          owner_id: string
          pets: number
          property_id: string
          reason: string | null
          requested_lock_code: string | null
          start_date: string
          status: string
          updated_at: string
          wants_cleaning: boolean
        }
        Insert: {
          adults?: number
          check_in_time?: string | null
          check_out_time?: string | null
          children?: number
          cleaning_fee?: number | null
          confirmed_at?: string | null
          created_at?: string
          damage_acknowledged?: boolean
          end_date: string
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          is_owner_staying?: boolean
          needs_lock_code?: boolean
          note?: string | null
          owner_id: string
          pets?: number
          property_id: string
          reason?: string | null
          requested_lock_code?: string | null
          start_date: string
          status?: string
          updated_at?: string
          wants_cleaning?: boolean
        }
        Update: {
          adults?: number
          check_in_time?: string | null
          check_out_time?: string | null
          children?: number
          cleaning_fee?: number | null
          confirmed_at?: string | null
          created_at?: string
          damage_acknowledged?: boolean
          end_date?: string
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          is_owner_staying?: boolean
          needs_lock_code?: boolean
          note?: string | null
          owner_id?: string
          pets?: number
          property_id?: string
          reason?: string | null
          requested_lock_code?: string | null
          start_date?: string
          status?: string
          updated_at?: string
          wants_cleaning?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "block_requests_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "block_requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          check_in: string
          check_out: string
          created_at: string
          currency: string
          external_id: string | null
          guest_email: string | null
          guest_name: string | null
          id: string
          nights: number | null
          notes: string | null
          property_id: string
          source: Database["public"]["Enums"]["booking_source"]
          status: string
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          check_in: string
          check_out: string
          created_at?: string
          currency?: string
          external_id?: string | null
          guest_email?: string | null
          guest_name?: string | null
          id?: string
          nights?: number | null
          notes?: string | null
          property_id: string
          source?: Database["public"]["Enums"]["booking_source"]
          status?: string
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          check_in?: string
          check_out?: string
          created_at?: string
          currency?: string
          external_id?: string | null
          guest_email?: string | null
          guest_name?: string | null
          id?: string
          nights?: number | null
          notes?: string | null
          property_id?: string
          source?: Database["public"]["Enums"]["booking_source"]
          status?: string
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      connections: {
        Row: {
          connected_at: string
          created_at: string
          disconnected_at: string | null
          external_account_id: string | null
          id: string
          metadata: Json
          owner_id: string
          provider: string
          status: string
          updated_at: string
        }
        Insert: {
          connected_at?: string
          created_at?: string
          disconnected_at?: string | null
          external_account_id?: string | null
          id?: string
          metadata?: Json
          owner_id: string
          provider: string
          status?: string
          updated_at?: string
        }
        Update: {
          connected_at?: string
          created_at?: string
          disconnected_at?: string | null
          external_account_id?: string | null
          id?: string
          metadata?: Json
          owner_id?: string
          provider?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "connections_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_sources: {
        Row: {
          active: boolean
          created_at: string
          id: string
          label: string
          slug: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          label: string
          slug: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          label?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      contacts: {
        Row: {
          assigned_to: string | null
          avatar_url: string | null
          company_name: string | null
          created_at: string
          display_name: string | null
          email: string | null
          estimated_mrr: number | null
          workspace_id: string | null
          first_name: string | null
          full_name: string
          home_lat: number | null
          home_lng: number | null
          id: string
          last_activity_at: string | null
          last_name: string | null
          lifecycle_stage: Database["public"]["Enums"]["contact_lifecycle_stage"]
          metadata: Json
          phone: string | null
          profile_id: string | null
          source: string | null
          source_detail: string | null
          stage_changed_at: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          estimated_mrr?: number | null
          workspace_id?: string | null
          first_name?: string | null
          full_name: string
          home_lat?: number | null
          home_lng?: number | null
          id?: string
          last_activity_at?: string | null
          last_name?: string | null
          lifecycle_stage?: Database["public"]["Enums"]["contact_lifecycle_stage"]
          metadata?: Json
          phone?: string | null
          profile_id?: string | null
          source?: string | null
          source_detail?: string | null
          stage_changed_at?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          estimated_mrr?: number | null
          workspace_id?: string | null
          first_name?: string | null
          full_name?: string
          home_lat?: number | null
          home_lng?: number | null
          id?: string
          last_activity_at?: string | null
          last_name?: string | null
          lifecycle_stage?: Database["public"]["Enums"]["contact_lifecycle_stage"]
          metadata?: Json
          phone?: string | null
          profile_id?: string | null
          source?: string | null
          source_detail?: string | null
          stage_changed_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          owner_id: string | null
          subject: string | null
          type: Database["public"]["Enums"]["conversation_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          owner_id?: string | null
          subject?: string | null
          type?: Database["public"]["Enums"]["conversation_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          owner_id?: string | null
          subject?: string | null
          type?: Database["public"]["Enums"]["conversation_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_properties: {
        Row: {
          document_id: string
          property_id: string
        }
        Insert: {
          document_id: string
          property_id: string
        }
        Update: {
          document_id?: string
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_properties_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_properties_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          doc_type: string
          file_url: string | null
          id: string
          notes: string | null
          owner_id: string
          scope: string
          status: string
          title: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          doc_type?: string
          file_url?: string | null
          id?: string
          notes?: string | null
          owner_id: string
          scope?: string
          status?: string
          title: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          doc_type?: string
          file_url?: string | null
          id?: string
          notes?: string | null
          owner_id?: string
          scope?: string
          status?: string
          title?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      workspaces: {
        Row: {
          created_at: string
          ein: string | null
          id: string
          name: string
          notes: string | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ein?: string | null
          id?: string
          name: string
          notes?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ein?: string | null
          id?: string
          name?: string
          notes?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      help_articles: {
        Row: {
          category_id: string
          content: string
          created_at: string
          helpful_count: number
          id: string
          not_helpful_count: number
          published_at: string | null
          read_time_minutes: number
          related_portal_path: string | null
          search_vector: unknown
          slug: string
          sort_order: number
          status: Database["public"]["Enums"]["help_article_status"]
          summary: string
          tags: string[]
          title: string
          updated_at: string
          view_count: number
        }
        Insert: {
          category_id: string
          content: string
          created_at?: string
          helpful_count?: number
          id?: string
          not_helpful_count?: number
          published_at?: string | null
          read_time_minutes?: number
          related_portal_path?: string | null
          search_vector?: unknown
          slug: string
          sort_order?: number
          status?: Database["public"]["Enums"]["help_article_status"]
          summary: string
          tags?: string[]
          title: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          category_id?: string
          content?: string
          created_at?: string
          helpful_count?: number
          id?: string
          not_helpful_count?: number
          published_at?: string | null
          read_time_minutes?: number
          related_portal_path?: string | null
          search_vector?: unknown
          slug?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["help_article_status"]
          summary?: string
          tags?: string[]
          title?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "help_articles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "help_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      help_categories: {
        Row: {
          article_count: number
          created_at: string
          description: string | null
          icon: string
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          article_count?: number
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          article_count?: number
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      help_feedback: {
        Row: {
          article_id: string
          comment: string | null
          created_at: string
          helpful: boolean
          id: string
          user_id: string | null
        }
        Insert: {
          article_id: string
          comment?: string | null
          created_at?: string
          helpful: boolean
          id?: string
          user_id?: string | null
        }
        Update: {
          article_id?: string
          comment?: string | null
          created_at?: string
          helpful?: boolean
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "help_feedback_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "help_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      help_search_logs: {
        Row: {
          created_at: string
          id: string
          query: string
          results_count: number
          source: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          query: string
          results_count?: number
          source?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          query?: string
          results_count?: number
          source?: string
          user_id?: string | null
        }
        Relationships: []
      }
      inquiries: {
        Row: {
          assigned_to: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          message: string | null
          phone: string | null
          property_address: string | null
          property_count: number | null
          property_type: Database["public"]["Enums"]["property_type"] | null
          source: string | null
          status: Database["public"]["Enums"]["inquiry_status"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          message?: string | null
          phone?: string | null
          property_address?: string | null
          property_count?: number | null
          property_type?: Database["public"]["Enums"]["property_type"] | null
          source?: string | null
          status?: Database["public"]["Enums"]["inquiry_status"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          message?: string | null
          phone?: string | null
          property_address?: string | null
          property_count?: number | null
          property_type?: Database["public"]["Enums"]["property_type"] | null
          source?: string | null
          status?: Database["public"]["Enums"]["inquiry_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inquiries_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          amount_cents: number
          created_at: string
          description: string
          id: string
          invoice_id: string
          quantity: number
          stripe_line_item_id: string | null
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          quantity?: number
          stripe_line_item_id?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number
          stripe_line_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_cents: number
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          due_at: string | null
          hosted_invoice_url: string | null
          id: string
          kind: Database["public"]["Enums"]["invoice_kind"]
          owner_id: string
          paid_at: string | null
          property_id: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          stripe_invoice_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          due_at?: string | null
          hosted_invoice_url?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["invoice_kind"]
          owner_id: string
          paid_at?: string | null
          property_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          stripe_invoice_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          due_at?: string | null
          hosted_invoice_url?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["invoice_kind"]
          owner_id?: string
          paid_at?: string | null
          property_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          stripe_invoice_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reads: {
        Row: {
          device_info: string | null
          first_read_at: string
          id: string
          last_read_at: string
          message_id: string
          read_count: number
          reader_id: string
        }
        Insert: {
          device_info?: string | null
          first_read_at?: string
          id?: string
          last_read_at?: string
          message_id: string
          read_count?: number
          reader_id: string
        }
        Update: {
          device_info?: string | null
          first_read_at?: string
          id?: string
          last_read_at?: string
          message_id?: string
          read_count?: number
          reader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reads_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reads_reader_id_fkey"
            columns: ["reader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          delivery_method: string
          id: string
          is_system: boolean
          metadata: Json
          sender_id: string
        }
        Insert: {
          body?: string
          conversation_id: string
          created_at?: string
          delivery_method?: string
          id?: string
          is_system?: boolean
          metadata?: Json
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          delivery_method?: string
          id?: string
          is_system?: boolean
          metadata?: Json
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          parent_id: string
          parent_type: string
          pinned: boolean
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          parent_id: string
          parent_type: string
          pinned?: boolean
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          parent_id?: string
          parent_type?: string
          pinned?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          link: string | null
          owner_id: string
          read: boolean
          title: string
          type: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          link?: string | null
          owner_id: string
          read?: boolean
          title: string
          type: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          link?: string | null
          owner_id?: string
          read?: boolean
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_drafts: {
        Row: {
          current_section: string | null
          draft: Json
          owner_id: string
          updated_at: string
        }
        Insert: {
          current_section?: string | null
          draft?: Json
          owner_id: string
          updated_at?: string
        }
        Update: {
          current_section?: string | null
          draft?: Json
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_drafts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_facts: {
        Row: {
          category: Database["public"]["Enums"]["owner_fact_category"] | null
          confidence: number
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          owner_id: string
          pinned: boolean
          source_id: string | null
          source_type: Database["public"]["Enums"]["owner_fact_source_type"]
          suppressed: boolean
          text: string
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["owner_fact_category"] | null
          confidence?: number
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          owner_id: string
          pinned?: boolean
          source_id?: string | null
          source_type?: Database["public"]["Enums"]["owner_fact_source_type"]
          suppressed?: boolean
          text: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["owner_fact_category"] | null
          confidence?: number
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          owner_id?: string
          pinned?: boolean
          source_id?: string | null
          source_type?: Database["public"]["Enums"]["owner_fact_source_type"]
          suppressed?: boolean
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_facts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_facts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_kyc: {
        Row: {
          back_photo_url: string | null
          consent_at: string | null
          consent_given: boolean
          created_at: string
          expiration_date: string | null
          front_photo_url: string | null
          id: string
          issuing_state: string | null
          legal_name: string | null
          license_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          back_photo_url?: string | null
          consent_at?: string | null
          consent_given?: boolean
          created_at?: string
          expiration_date?: string | null
          front_photo_url?: string | null
          id?: string
          issuing_state?: string | null
          legal_name?: string | null
          license_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          back_photo_url?: string | null
          consent_at?: string | null
          consent_given?: boolean
          created_at?: string
          expiration_date?: string | null
          front_photo_url?: string | null
          id?: string
          issuing_state?: string | null
          legal_name?: string | null
          license_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_kyc_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_meetings: {
        Row: {
          action_items: Json
          ai_summary: string | null
          created_at: string
          created_by: string | null
          duration_minutes: number | null
          id: string
          meet_link: string | null
          notes: string | null
          owner_id: string
          property_id: string | null
          scheduled_at: string | null
          status: string
          title: string
          transcript: string | null
          updated_at: string
          visibility: string
        }
        Insert: {
          action_items?: Json
          ai_summary?: string | null
          created_at?: string
          created_by?: string | null
          duration_minutes?: number | null
          id?: string
          meet_link?: string | null
          notes?: string | null
          owner_id: string
          property_id?: string | null
          scheduled_at?: string | null
          status?: string
          title: string
          transcript?: string | null
          updated_at?: string
          visibility?: string
        }
        Update: {
          action_items?: Json
          ai_summary?: string | null
          created_at?: string
          created_by?: string | null
          duration_minutes?: number | null
          id?: string
          meet_link?: string | null
          notes?: string | null
          owner_id?: string
          property_id?: string | null
          scheduled_at?: string | null
          status?: string
          title?: string
          transcript?: string | null
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_meetings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_meetings_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_meetings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_notes: {
        Row: {
          body: string
          created_at: string
          created_by: string
          id: string
          owner_id: string
          property_id: string | null
          updated_at: string
          visibility: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by: string
          id?: string
          owner_id: string
          property_id?: string | null
          updated_at?: string
          visibility?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string
          id?: string
          owner_id?: string
          property_id?: string | null
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_notes_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_receipts: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string
          currency: string
          id: string
          image_url: string | null
          notes: string | null
          owner_id: string
          property_id: string | null
          purchase_date: string
          updated_at: string
          vendor: string
          visibility: string
        }
        Insert: {
          amount: number
          category?: string
          created_at?: string
          created_by: string
          currency?: string
          id?: string
          image_url?: string | null
          notes?: string | null
          owner_id: string
          property_id?: string | null
          purchase_date: string
          updated_at?: string
          vendor: string
          visibility?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          image_url?: string | null
          notes?: string | null
          owner_id?: string
          property_id?: string | null
          purchase_date?: string
          updated_at?: string
          vendor?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_receipts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_setup_drafts: {
        Row: {
          data: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          data?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          data?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_setup_drafts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_tasks_legacy: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          owner_id: string
          priority: string
          property_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          owner_id: string
          priority?: string
          property_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          owner_id?: string
          priority?: string
          property_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_timeline: {
        Row: {
          body: string | null
          category: Database["public"]["Enums"]["timeline_category"]
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          event_type: string
          icon: string | null
          id: string
          is_pinned: boolean
          metadata: Json | null
          owner_id: string
          property_id: string | null
          publish_at: string | null
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["timeline_visibility"]
        }
        Insert: {
          body?: string | null
          category?: Database["public"]["Enums"]["timeline_category"]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          event_type: string
          icon?: string | null
          id?: string
          is_pinned?: boolean
          metadata?: Json | null
          owner_id: string
          property_id?: string | null
          publish_at?: string | null
          title: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["timeline_visibility"]
        }
        Update: {
          body?: string | null
          category?: Database["public"]["Enums"]["timeline_category"]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          event_type?: string
          icon?: string | null
          id?: string
          is_pinned?: boolean
          metadata?: Json | null
          owner_id?: string
          property_id?: string | null
          publish_at?: string | null
          title?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["timeline_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "owner_timeline_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_timeline_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      parcel_team: {
        Row: {
          active: boolean
          avatar_url: string | null
          bio: string | null
          created_at: string
          email: string | null
          founding_member: boolean | null
          id: string
          instagram_url: string | null
          is_messageable: boolean | null
          languages: string[] | null
          linkedin_url: string | null
          location: string | null
          member_since: string | null
          name: string
          phone: string | null
          role: string
          sort_order: number
          specialties: string[] | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          founding_member?: boolean | null
          id?: string
          instagram_url?: string | null
          is_messageable?: boolean | null
          languages?: string[] | null
          linkedin_url?: string | null
          location?: string | null
          member_since?: string | null
          name: string
          phone?: string | null
          role: string
          sort_order?: number
          specialties?: string[] | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          founding_member?: boolean | null
          id?: string
          instagram_url?: string | null
          is_messageable?: boolean | null
          languages?: string[] | null
          linkedin_url?: string | null
          location?: string | null
          member_since?: string | null
          name?: string
          phone?: string | null
          role?: string
          sort_order?: number
          specialties?: string[] | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      payouts: {
        Row: {
          created_at: string
          fees: number
          gross_revenue: number
          id: string
          net_payout: number
          notes: string | null
          paid_at: string | null
          period_end: string
          period_start: string
          property_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          fees?: number
          gross_revenue?: number
          id?: string
          net_payout?: number
          notes?: string | null
          paid_at?: string | null
          period_end: string
          period_start: string
          property_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          fees?: number
          gross_revenue?: number
          id?: string
          net_payout?: number
          notes?: string | null
          paid_at?: string | null
          period_end?: string
          period_start?: string
          property_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          contact_method: string | null
          created_at: string
          deleted_at: string | null
          email: string
          workspace_id: string | null
          full_name: string | null
          id: string
          location: string | null
          mailing_address: Json | null
          onboarding_completed_at: string | null
          phone: string | null
          preferred_name: string | null
          property_count_estimate: string | null
          referral_source: string | null
          responsibility: string | null
          role: Database["public"]["Enums"]["user_role"]
          show_test_data: boolean
          timezone: string | null
          updated_at: string
          years_investing: string | null
        }
        Insert: {
          avatar_url?: string | null
          contact_method?: string | null
          created_at?: string
          deleted_at?: string | null
          email: string
          workspace_id?: string | null
          full_name?: string | null
          id: string
          location?: string | null
          mailing_address?: Json | null
          onboarding_completed_at?: string | null
          phone?: string | null
          preferred_name?: string | null
          property_count_estimate?: string | null
          referral_source?: string | null
          responsibility?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          show_test_data?: boolean | null
          timezone?: string | null
          updated_at?: string
          years_investing?: string | null
        }
        Update: {
          avatar_url?: string | null
          contact_method?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string
          workspace_id?: string | null
          full_name?: string | null
          id?: string
          location?: string | null
          mailing_address?: Json | null
          onboarding_completed_at?: string | null
          phone?: string | null
          preferred_name?: string | null
          property_count_estimate?: string | null
          referral_source?: string | null
          responsibility?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          show_test_data?: boolean | null
          timezone?: string | null
          updated_at?: string
          years_investing?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          archived_at: string | null
          color: string | null
          created_at: string
          description: string | null
          emoji: string | null
          id: string
          linked_contact_id: string | null
          linked_property_id: string | null
          name: string
          owner_user_id: string | null
          project_type: string
          status: string
          target_date: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          emoji?: string | null
          id?: string
          linked_contact_id?: string | null
          linked_property_id?: string | null
          name: string
          owner_user_id?: string | null
          project_type: string
          status?: string
          target_date?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          emoji?: string | null
          id?: string
          linked_contact_id?: string | null
          linked_property_id?: string | null
          name?: string
          owner_user_id?: string | null
          project_type?: string
          status?: string
          target_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_linked_contact_id_fkey"
            columns: ["linked_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_linked_property_id_fkey"
            columns: ["linked_property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          active: boolean
          address_line1: string
          address_line2: string | null
          agreement_acknowledged_at: string | null
          agreement_signed_at: string | null
          amenities: Json | null
          bathrooms: number | null
          bed_arrangements: Json | null
          bedrooms: number | null
          city: string
          cleaning_choice: string | null
          cleaning_team: Json | null
          compliance_details: Json | null
          contact_id: string | null
          country: string
          cover_photo_url: string | null
          created_at: string
          currently_rented: boolean | null
          financial_baseline: Json | null
          guest_capacity: number | null
          guidebook_spots: Json | null
          half_bathrooms: number | null
          home_type: string | null
          hospitable_property_id: string | null
          house_rules: Json | null
          ical_url: string | null
          id: string
          image_source: string | null
          latitude: number | null
          listed_elsewhere: boolean | null
          longitude: number | null
          name: string | null
          neighborhood: string | null
          onboarded_at: string | null
          owner_id: string
          parking_spaces: number | null
          parking_type: string | null
          photos: Json | null
          postal_code: string
          property_subtype: string | null
          property_type: Database["public"]["Enums"]["property_type"]
          setup_status: string
          square_feet: number | null
          state: string
          stories: number | null
          street_view_available: boolean
          timezone: string | null
          updated_at: string
          wifi_details: Json | null
          year_built: number | null
          year_purchased: number | null
        }
        Insert: {
          active?: boolean
          address_line1: string
          address_line2?: string | null
          agreement_acknowledged_at?: string | null
          agreement_signed_at?: string | null
          amenities?: Json | null
          bathrooms?: number | null
          bed_arrangements?: Json | null
          bedrooms?: number | null
          city: string
          cleaning_choice?: string | null
          cleaning_team?: Json | null
          compliance_details?: Json | null
          contact_id?: string | null
          country?: string
          cover_photo_url?: string | null
          created_at?: string
          currently_rented?: boolean | null
          financial_baseline?: Json | null
          guest_capacity?: number | null
          guidebook_spots?: Json | null
          half_bathrooms?: number | null
          home_type?: string | null
          hospitable_property_id?: string | null
          house_rules?: Json | null
          ical_url?: string | null
          id?: string
          image_source?: string | null
          latitude?: number | null
          listed_elsewhere?: boolean | null
          longitude?: number | null
          name?: string | null
          neighborhood?: string | null
          onboarded_at?: string | null
          owner_id: string
          parking_spaces?: number | null
          parking_type?: string | null
          photos?: Json | null
          postal_code: string
          property_subtype?: string | null
          property_type: Database["public"]["Enums"]["property_type"]
          setup_status?: string
          square_feet?: number | null
          state: string
          stories?: number | null
          street_view_available?: boolean
          timezone?: string | null
          updated_at?: string
          wifi_details?: Json | null
          year_built?: number | null
          year_purchased?: number | null
        }
        Update: {
          active?: boolean
          address_line1?: string
          address_line2?: string | null
          agreement_acknowledged_at?: string | null
          agreement_signed_at?: string | null
          amenities?: Json | null
          bathrooms?: number | null
          bed_arrangements?: Json | null
          bedrooms?: number | null
          city?: string
          cleaning_choice?: string | null
          cleaning_team?: Json | null
          compliance_details?: Json | null
          contact_id?: string | null
          country?: string
          cover_photo_url?: string | null
          created_at?: string
          currently_rented?: boolean | null
          financial_baseline?: Json | null
          guest_capacity?: number | null
          guidebook_spots?: Json | null
          half_bathrooms?: number | null
          home_type?: string | null
          hospitable_property_id?: string | null
          house_rules?: Json | null
          ical_url?: string | null
          id?: string
          image_source?: string | null
          latitude?: number | null
          listed_elsewhere?: boolean | null
          longitude?: number | null
          name?: string | null
          neighborhood?: string | null
          onboarded_at?: string | null
          owner_id?: string
          parking_spaces?: number | null
          parking_type?: string | null
          photos?: Json | null
          postal_code?: string
          property_subtype?: string | null
          property_type?: Database["public"]["Enums"]["property_type"]
          setup_status?: string
          square_feet?: number | null
          state?: string
          stories?: number | null
          street_view_available?: boolean
          timezone?: string | null
          updated_at?: string
          wifi_details?: Json | null
          year_built?: number | null
          year_purchased?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      property_amenities: {
        Row: {
          amenity_key: string
          created_at: string
          metadata: Json
          property_id: string
        }
        Insert: {
          amenity_key: string
          created_at?: string
          metadata?: Json
          property_id: string
        }
        Update: {
          amenity_key?: string
          created_at?: string
          metadata?: Json
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_amenities_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_checklist_items: {
        Row: {
          category: string
          created_at: string
          id: string
          item_key: string
          label: string
          notes: string | null
          property_id: string
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          item_key: string
          label: string
          notes?: string | null
          property_id: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          item_key?: string
          label?: string
          notes?: string | null
          property_id?: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_checklist_items_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_compliance: {
        Row: {
          created_at: string
          hoa_allows_str: string | null
          hoa_contact: string | null
          hoa_exists: boolean | null
          hoa_fees: number | null
          insurance_carrier: string | null
          insurance_document_url: string | null
          insurance_expires: string | null
          insurance_policy_number: string | null
          mortgage_allows_str: boolean | null
          mortgage_holder: string | null
          permit_document_url: string | null
          permit_expires: string | null
          permit_number: string | null
          permit_required: string | null
          property_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          hoa_allows_str?: string | null
          hoa_contact?: string | null
          hoa_exists?: boolean | null
          hoa_fees?: number | null
          insurance_carrier?: string | null
          insurance_document_url?: string | null
          insurance_expires?: string | null
          insurance_policy_number?: string | null
          mortgage_allows_str?: boolean | null
          mortgage_holder?: string | null
          permit_document_url?: string | null
          permit_expires?: string | null
          permit_number?: string | null
          permit_required?: string | null
          property_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          hoa_allows_str?: string | null
          hoa_contact?: string | null
          hoa_exists?: boolean | null
          hoa_fees?: number | null
          insurance_carrier?: string | null
          insurance_document_url?: string | null
          insurance_expires?: string | null
          insurance_policy_number?: string | null
          mortgage_allows_str?: boolean | null
          mortgage_holder?: string | null
          permit_document_url?: string | null
          permit_expires?: string | null
          permit_number?: string | null
          permit_required?: string | null
          property_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_compliance_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_owners: {
        Row: {
          created_at: string
          owner_id: string
          property_id: string
          role: string
        }
        Insert: {
          created_at?: string
          owner_id: string
          property_id: string
          role?: string
        }
        Update: {
          created_at?: string
          owner_id?: string
          property_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_owners_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_rules: {
        Row: {
          cancellation_policy: string | null
          check_in_time: string | null
          check_out_time: string | null
          children_welcome: boolean | null
          cleaning_fee: number | null
          created_at: string
          damage_deposit: number | null
          events_allowed: boolean | null
          extra_guest_fee: number | null
          extra_guest_threshold: number | null
          max_nights: number | null
          min_nights: number | null
          pet_fee: number | null
          pets_allowed: boolean | null
          property_id: string
          quiet_hours: string | null
          smoking_policy: string | null
          updated_at: string
        }
        Insert: {
          cancellation_policy?: string | null
          check_in_time?: string | null
          check_out_time?: string | null
          children_welcome?: boolean | null
          cleaning_fee?: number | null
          created_at?: string
          damage_deposit?: number | null
          events_allowed?: boolean | null
          extra_guest_fee?: number | null
          extra_guest_threshold?: number | null
          max_nights?: number | null
          min_nights?: number | null
          pet_fee?: number | null
          pets_allowed?: boolean | null
          property_id: string
          quiet_hours?: string | null
          smoking_policy?: string | null
          updated_at?: string
        }
        Update: {
          cancellation_policy?: string | null
          check_in_time?: string | null
          check_out_time?: string | null
          children_welcome?: boolean | null
          cleaning_fee?: number | null
          created_at?: string
          damage_deposit?: number | null
          events_allowed?: boolean | null
          extra_guest_fee?: number | null
          extra_guest_threshold?: number | null
          max_nights?: number | null
          min_nights?: number | null
          pet_fee?: number | null
          pets_allowed?: boolean | null
          property_id?: string
          quiet_hours?: string | null
          smoking_policy?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_rules_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_setup_drafts: {
        Row: {
          data: Json
          id: string
          property_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          data?: Json
          id?: string
          property_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          data?: Json
          id?: string
          property_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_setup_drafts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_setup_drafts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      property_task_templates: {
        Row: {
          assignee_id: string | null
          created_at: string
          is_active: boolean
          last_spawned_at: string | null
          next_due_at: string | null
          property_id: string
          template_id: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          is_active?: boolean
          last_spawned_at?: string | null
          next_due_at?: string | null
          property_id: string
          template_id: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          is_active?: boolean
          last_spawned_at?: string | null
          next_due_at?: string | null
          property_id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_task_templates_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_task_templates_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_task_templates_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "task_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      property_team: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string | null
          notes: string | null
          phone: string | null
          property_id: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          phone?: string | null
          property_id: string
          role: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          phone?: string | null
          property_id?: string
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_team_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          created_at: string
          device_info: string | null
          endpoint: string
          id: string
          keys: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          device_info?: string | null
          endpoint: string
          id?: string
          keys?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          device_info?: string | null
          endpoint?: string
          id?: string
          keys?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_views: {
        Row: {
          columns_jsonb: Json | null
          created_at: string
          entity_type: string
          filter_jsonb: Json
          grouping: string | null
          icon_color: string | null
          icon_id: string | null
          id: string
          is_shared: boolean
          key: string
          name: string
          owner_user_id: string | null
          sort: string | null
          sort_order: number
          updated_at: string
          view_mode: string
        }
        Insert: {
          columns_jsonb?: Json | null
          created_at?: string
          entity_type: string
          filter_jsonb?: Json
          grouping?: string | null
          icon_color?: string | null
          icon_id?: string | null
          id?: string
          is_shared?: boolean
          key: string
          name: string
          owner_user_id?: string | null
          sort?: string | null
          sort_order?: number
          updated_at?: string
          view_mode?: string
        }
        Update: {
          columns_jsonb?: Json | null
          created_at?: string
          entity_type?: string
          filter_jsonb?: Json
          grouping?: string | null
          icon_color?: string | null
          icon_id?: string | null
          id?: string
          is_shared?: boolean
          key?: string
          name?: string
          owner_user_id?: string | null
          sort?: string | null
          sort_order?: number
          updated_at?: string
          view_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_views_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      session_log: {
        Row: {
          browser: string | null
          city: string | null
          country: string | null
          device_type: string | null
          id: string
          ip_address: string | null
          logged_in_at: string
          os: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          browser?: string | null
          city?: string | null
          country?: string | null
          device_type?: string | null
          id?: string
          ip_address?: string | null
          logged_in_at?: string
          os?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          browser?: string | null
          city?: string | null
          country?: string | null
          device_type?: string | null
          id?: string
          ip_address?: string | null
          logged_in_at?: string
          os?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      setup_field_versions: {
        Row: {
          data: Json
          id: string
          property_id: string | null
          saved_at: string
          saved_by: string
          step_key: string
          user_id: string
          version_number: number
        }
        Insert: {
          data?: Json
          id?: string
          property_id?: string | null
          saved_at?: string
          saved_by: string
          step_key: string
          user_id: string
          version_number?: number
        }
        Update: {
          data?: Json
          id?: string
          property_id?: string | null
          saved_at?: string
          saved_by?: string
          step_key?: string
          user_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "setup_field_versions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setup_field_versions_saved_by_fkey"
            columns: ["saved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setup_field_versions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      signed_documents: {
        Row: {
          boldsign_document_id: string
          created_at: string
          id: string
          property_id: string | null
          signed_at: string | null
          signed_pdf_url: string | null
          status: string
          template_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          boldsign_document_id: string
          created_at?: string
          id?: string
          property_id?: string | null
          signed_at?: string | null
          signed_pdf_url?: string | null
          status?: string
          template_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          boldsign_document_id?: string
          created_at?: string
          id?: string
          property_id?: string | null
          signed_at?: string | null
          signed_pdf_url?: string | null
          status?: string
          template_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "signed_documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signed_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_customers: {
        Row: {
          created_at: string
          email: string | null
          profile_id: string
          stripe_customer_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          profile_id: string
          stripe_customer_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          profile_id?: string
          stripe_customer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_customers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          currency: string
          current_period_end: string | null
          id: string
          interval: string
          owner_id: string
          price_cents: number
          property_id: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          currency?: string
          current_period_end?: string | null
          id?: string
          interval?: string
          owner_id: string
          price_cents?: number
          property_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          currency?: string
          current_period_end?: string | null
          id?: string
          interval?: string
          owner_id?: string
          price_cents?: number
          property_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      task_assignees_legacy: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          task_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          task_id: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignees_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks_legacy"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments_legacy: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          task_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          task_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks_legacy"
            referencedColumns: ["id"]
          },
        ]
      }
      task_label_map_legacy: {
        Row: {
          label_id: string
          task_id: string
        }
        Insert: {
          label_id: string
          task_id: string
        }
        Update: {
          label_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_label_map_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "task_labels_legacy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_label_map_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks_legacy"
            referencedColumns: ["id"]
          },
        ]
      }
      task_labels_legacy: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      task_subtasks_legacy: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          id: string
          sort_order: number | null
          task_id: string
          title: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          sort_order?: number | null
          task_id: string
          title: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          sort_order?: number | null
          task_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks_legacy"
            referencedColumns: ["id"]
          },
        ]
      }
      task_templates: {
        Row: {
          applies_to: string
          created_at: string
          created_by: string | null
          description: string | null
          estimated_minutes: number | null
          id: string
          is_active: boolean
          name: string
          pre_notify_hours: number | null
          recurrence_rule: Json
          tags: string[]
          task_type: Database["public"]["Enums"]["task_kind"]
          updated_at: string
        }
        Insert: {
          applies_to?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_minutes?: number | null
          id?: string
          is_active?: boolean
          name: string
          pre_notify_hours?: number | null
          recurrence_rule: Json
          tags?: string[]
          task_type?: Database["public"]["Enums"]["task_kind"]
          updated_at?: string
        }
        Update: {
          applies_to?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_minutes?: number | null
          id?: string
          is_active?: boolean
          name?: string
          pre_notify_hours?: number | null
          recurrence_rule?: Json
          tags?: string[]
          task_type?: Database["public"]["Enums"]["task_kind"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_templates_legacy: {
        Row: {
          category: string | null
          created_at: string
          default_priority: Database["public"]["Enums"]["task_priority"]
          description: string | null
          due_offset_days: number | null
          id: string
          is_active: boolean | null
          name: string
          subtasks: Json
          task_type: Database["public"]["Enums"]["task_type"]
        }
        Insert: {
          category?: string | null
          created_at?: string
          default_priority?: Database["public"]["Enums"]["task_priority"]
          description?: string | null
          due_offset_days?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          subtasks?: Json
          task_type?: Database["public"]["Enums"]["task_type"]
        }
        Update: {
          category?: string | null
          created_at?: string
          default_priority?: Database["public"]["Enums"]["task_priority"]
          description?: string | null
          due_offset_days?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          subtasks?: Json
          task_type?: Database["public"]["Enums"]["task_type"]
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assignee_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_at: string | null
          estimated_minutes: number | null
          id: string
          linked_contact_id: string | null
          linked_property_id: string | null
          metadata: Json
          next_spawn_at: string | null
          parent_id: string | null
          parent_task_id: string | null
          parent_type: string | null
          pre_notify_hours: number | null
          recurrence_rule: Json | null
          spawned_from_task_id: string | null
          status: string
          tags: string[]
          task_type: Database["public"]["Enums"]["task_kind"]
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          estimated_minutes?: number | null
          id?: string
          linked_contact_id?: string | null
          linked_property_id?: string | null
          metadata?: Json
          next_spawn_at?: string | null
          parent_id?: string | null
          parent_task_id?: string | null
          parent_type?: string | null
          pre_notify_hours?: number | null
          recurrence_rule?: Json | null
          spawned_from_task_id?: string | null
          status?: string
          tags?: string[]
          task_type?: Database["public"]["Enums"]["task_kind"]
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          estimated_minutes?: number | null
          id?: string
          linked_contact_id?: string | null
          linked_property_id?: string | null
          metadata?: Json
          next_spawn_at?: string | null
          parent_id?: string | null
          parent_task_id?: string | null
          parent_type?: string | null
          pre_notify_hours?: number | null
          recurrence_rule?: Json | null
          spawned_from_task_id?: string | null
          status?: string
          tags?: string[]
          task_type?: Database["public"]["Enums"]["task_kind"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey1"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_linked_contact_id_fkey"
            columns: ["linked_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_linked_property_id_fkey"
            columns: ["linked_property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_spawned_from_task_id_fkey"
            columns: ["spawned_from_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks_legacy: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          due_time: string | null
          id: string
          owner_id: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          property_id: string | null
          sort_order: number | null
          status: Database["public"]["Enums"]["task_status"]
          task_type: Database["public"]["Enums"]["task_type"]
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          id?: string
          owner_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          property_id?: string | null
          sort_order?: number | null
          status?: Database["public"]["Enums"]["task_status"]
          task_type?: Database["public"]["Enums"]["task_type"]
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          id?: string
          owner_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          property_id?: string | null
          sort_order?: number | null
          status?: Database["public"]["Enums"]["task_status"]
          task_type?: Database["public"]["Enums"]["task_type"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      treasury_accounts: {
        Row: {
          allocation_target_pct: number | null
          available_balance: number | null
          balance_updated_at: string | null
          bucket_category: string | null
          connection_id: string
          created_at: string | null
          current_balance: number | null
          id: string
          is_active: boolean | null
          mask: string | null
          name: string | null
          official_name: string | null
          plaid_account_id: string
          type: string | null
        }
        Insert: {
          allocation_target_pct?: number | null
          available_balance?: number | null
          balance_updated_at?: string | null
          bucket_category?: string | null
          connection_id: string
          created_at?: string | null
          current_balance?: number | null
          id?: string
          is_active?: boolean | null
          mask?: string | null
          name?: string | null
          official_name?: string | null
          plaid_account_id: string
          type?: string | null
        }
        Update: {
          allocation_target_pct?: number | null
          available_balance?: number | null
          balance_updated_at?: string | null
          bucket_category?: string | null
          connection_id?: string
          created_at?: string | null
          current_balance?: number | null
          id?: string
          is_active?: boolean | null
          mask?: string | null
          name?: string | null
          official_name?: string | null
          plaid_account_id?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treasury_accounts_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "treasury_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      treasury_alerts: {
        Row: {
          acknowledged_at: string | null
          created_at: string | null
          id: string
          message: string
          metadata: Json | null
          retention_expires_at: string | null
          severity: string
          title: string
          type: string
        }
        Insert: {
          acknowledged_at?: string | null
          created_at?: string | null
          id?: string
          message: string
          metadata?: Json | null
          retention_expires_at?: string | null
          severity?: string
          title: string
          type: string
        }
        Update: {
          acknowledged_at?: string | null
          created_at?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          retention_expires_at?: string | null
          severity?: string
          title?: string
          type?: string
        }
        Relationships: []
      }
      treasury_audit_log: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: unknown
          metadata: Json | null
          resource_id: string | null
          resource_type: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treasury_audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      treasury_balance_snapshots: {
        Row: {
          account_balances: Json | null
          created_at: string | null
          date: string
          id: string
          total_balance: number
        }
        Insert: {
          account_balances?: Json | null
          created_at?: string | null
          date: string
          id?: string
          total_balance?: number
        }
        Update: {
          account_balances?: Json | null
          created_at?: string | null
          date?: string
          id?: string
          total_balance?: number
        }
        Relationships: []
      }
      treasury_connections: {
        Row: {
          access_token_encrypted: string
          created_at: string | null
          cursor: string | null
          id: string
          institution_id: string | null
          institution_name: string | null
          last_synced_at: string | null
          plaid_item_id: string
          status: string
          token_rotated_at: string | null
        }
        Insert: {
          access_token_encrypted: string
          created_at?: string | null
          cursor?: string | null
          id?: string
          institution_id?: string | null
          institution_name?: string | null
          last_synced_at?: string | null
          plaid_item_id: string
          status: string
          token_rotated_at?: string | null
        }
        Update: {
          access_token_encrypted?: string
          created_at?: string | null
          cursor?: string | null
          id?: string
          institution_id?: string | null
          institution_name?: string | null
          last_synced_at?: string | null
          plaid_item_id?: string
          status?: string
          token_rotated_at?: string | null
        }
        Relationships: []
      }
      treasury_forecasts: {
        Row: {
          account_projections: Json | null
          confidence_level: string
          created_at: string | null
          data_months_available: number | null
          generated_at: string | null
          id: string
          insights: Json | null
          model_used: string | null
          period_days: number
          projected_expenses: number | null
          projected_income: number | null
          projected_net: number | null
          retention_expires_at: string | null
        }
        Insert: {
          account_projections?: Json | null
          confidence_level?: string
          created_at?: string | null
          data_months_available?: number | null
          generated_at?: string | null
          id?: string
          insights?: Json | null
          model_used?: string | null
          period_days: number
          projected_expenses?: number | null
          projected_income?: number | null
          projected_net?: number | null
          retention_expires_at?: string | null
        }
        Update: {
          account_projections?: Json | null
          confidence_level?: string
          created_at?: string | null
          data_months_available?: number | null
          generated_at?: string | null
          id?: string
          insights?: Json | null
          model_used?: string | null
          period_days?: number
          projected_expenses?: number | null
          projected_income?: number | null
          projected_net?: number | null
          retention_expires_at?: string | null
        }
        Relationships: []
      }
      treasury_savings_goals: {
        Row: {
          account_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          target_amount: number
          target_date: string | null
        }
        Insert: {
          account_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          target_amount: number
          target_date?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          target_amount?: number
          target_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treasury_savings_goals_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "treasury_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      treasury_subscriptions: {
        Row: {
          account_id: string
          created_at: string | null
          deactivated_at: string | null
          frequency: string | null
          id: string
          is_active: boolean | null
          last_charged_at: string | null
          merchant_name: string
          next_expected_at: string | null
          total_annual_cost: number | null
          typical_amount: number | null
        }
        Insert: {
          account_id: string
          created_at?: string | null
          deactivated_at?: string | null
          frequency?: string | null
          id?: string
          is_active?: boolean | null
          last_charged_at?: string | null
          merchant_name: string
          next_expected_at?: string | null
          total_annual_cost?: number | null
          typical_amount?: number | null
        }
        Update: {
          account_id?: string
          created_at?: string | null
          deactivated_at?: string | null
          frequency?: string | null
          id?: string
          is_active?: boolean | null
          last_charged_at?: string | null
          merchant_name?: string
          next_expected_at?: string | null
          total_annual_cost?: number | null
          typical_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "treasury_subscriptions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "treasury_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      treasury_transactions: {
        Row: {
          account_id: string | null
          amount: number
          category: string | null
          counterparties: Json | null
          created_at: string | null
          date: string
          dedup_score: number | null
          description: string | null
          duplicate_of: string | null
          id: string
          is_duplicate: boolean | null
          merchant_name: string | null
          original_description: string | null
          payment_meta: Json | null
          pending: boolean | null
          plaid_category: string[] | null
          plaid_transaction_id: string | null
          source: string | null
          stripe_charge_id: string | null
        }
        Insert: {
          account_id?: string | null
          amount: number
          category?: string | null
          counterparties?: Json | null
          created_at?: string | null
          date: string
          dedup_score?: number | null
          description?: string | null
          duplicate_of?: string | null
          id?: string
          is_duplicate?: boolean | null
          merchant_name?: string | null
          original_description?: string | null
          payment_meta?: Json | null
          pending?: boolean | null
          plaid_category?: string[] | null
          plaid_transaction_id?: string | null
          source?: string | null
          stripe_charge_id?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          category?: string | null
          counterparties?: Json | null
          created_at?: string | null
          date?: string
          dedup_score?: number | null
          description?: string | null
          duplicate_of?: string | null
          id?: string
          is_duplicate?: boolean | null
          merchant_name?: string | null
          original_description?: string | null
          payment_meta?: Json | null
          pending?: boolean | null
          plaid_category?: string[] | null
          plaid_transaction_id?: string | null
          source?: string | null
          stripe_charge_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treasury_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "treasury_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treasury_transactions_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "treasury_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_message_read: {
        Args: {
          p_device_info?: string
          p_message_id: string
          p_reader_id: string
        }
        Returns: undefined
      }
      insert_help_screenshot: {
        Args: { article_slug: string; img_alt: string; img_url: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      search_help_articles: {
        Args: { max_results?: number; search_query: string }
        Returns: {
          category_name: string
          category_slug: string
          id: string
          rank: number
          read_time_minutes: number
          slug: string
          summary: string
          tags: string[]
          title: string
        }[]
      }
      user_owns_property: { Args: { p_property_id: string }; Returns: boolean }
    }
    Enums: {
      activity_visibility: "admin_only" | "both"
      booking_source:
        | "direct"
        | "airbnb"
        | "vrbo"
        | "booking_com"
        | "furnished_finder"
        | "hospitable"
        | "other"
      contact_lifecycle_stage:
        | "lead_new"
        | "qualified"
        | "in_discussion"
        | "contract_sent"
        | "onboarding"
        | "active_owner"
        | "offboarding"
        | "paused"
        | "churned"
        | "lead_cold"
      conversation_type: "direct" | "announcement" | "email_log"
      help_article_status: "draft" | "published" | "archived"
      inquiry_status: "new" | "contacted" | "qualified" | "won" | "lost"
      invoice_kind: "onboarding_fee" | "tech_fee" | "adhoc"
      invoice_status: "draft" | "open" | "paid" | "uncollectible" | "void"
      owner_fact_category:
        | "communication"
        | "background"
        | "relationships"
        | "property_knowledge"
        | "business"
        | "personal"
        | "other"
      owner_fact_source_type:
        | "manual"
        | "meeting"
        | "email"
        | "message"
        | "document"
        | "ai_summary"
      property_type: "str" | "ltr" | "arbitrage" | "mtr" | "co-hosting"
      subscription_status:
        | "active"
        | "past_due"
        | "canceled"
        | "incomplete"
        | "incomplete_expired"
        | "trialing"
        | "unpaid"
        | "paused"
      task_kind: "todo" | "call" | "meeting" | "email" | "milestone"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status:
        | "backlog"
        | "todo"
        | "in_progress"
        | "done"
        | "blocked"
        | "cancelled"
      task_type: "todo" | "call" | "meeting" | "email" | "milestone"
      timeline_category:
        | "account"
        | "property"
        | "financial"
        | "calendar"
        | "document"
        | "communication"
      timeline_visibility: "owner" | "admin_only"
      user_role: "owner" | "admin"
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
      activity_visibility: ["admin_only", "both"],
      booking_source: [
        "direct",
        "airbnb",
        "vrbo",
        "booking_com",
        "furnished_finder",
        "hospitable",
        "other",
      ],
      contact_lifecycle_stage: [
        "lead_new",
        "qualified",
        "in_discussion",
        "contract_sent",
        "onboarding",
        "active_owner",
        "offboarding",
        "paused",
        "churned",
        "lead_cold",
      ],
      conversation_type: ["direct", "announcement", "email_log"],
      help_article_status: ["draft", "published", "archived"],
      inquiry_status: ["new", "contacted", "qualified", "won", "lost"],
      invoice_kind: ["onboarding_fee", "tech_fee", "adhoc"],
      invoice_status: ["draft", "open", "paid", "uncollectible", "void"],
      owner_fact_category: [
        "communication",
        "background",
        "relationships",
        "property_knowledge",
        "business",
        "personal",
        "other",
      ],
      owner_fact_source_type: [
        "manual",
        "meeting",
        "email",
        "message",
        "document",
        "ai_summary",
      ],
      property_type: ["str", "ltr", "arbitrage", "mtr", "co-hosting"],
      subscription_status: [
        "active",
        "past_due",
        "canceled",
        "incomplete",
        "incomplete_expired",
        "trialing",
        "unpaid",
        "paused",
      ],
      task_kind: ["todo", "call", "meeting", "email", "milestone"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: [
        "backlog",
        "todo",
        "in_progress",
        "done",
        "blocked",
        "cancelled",
      ],
      task_type: ["todo", "call", "meeting", "email", "milestone"],
      timeline_category: [
        "account",
        "property",
        "financial",
        "calendar",
        "document",
        "communication",
      ],
      timeline_visibility: ["owner", "admin_only"],
      user_role: ["owner", "admin"],
    },
  },
} as const
