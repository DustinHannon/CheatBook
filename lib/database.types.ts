export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          created_at: string | null
          id: string
          target_id: string | null
          target_title: string | null
          target_type: string | null
          team_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          target_id?: string | null
          target_title?: string | null
          target_type?: string | null
          team_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          target_id?: string | null
          target_title?: string | null
          target_type?: string | null
          team_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      hidden_notes: {
        Row: { hidden_at: string | null; note_id: string; user_id: string }
        Insert: { hidden_at?: string | null; note_id: string; user_id: string }
        Update: { hidden_at?: string | null; note_id?: string; user_id?: string }
        Relationships: []
      }
      images: {
        Row: {
          created_at: string | null
          file_name: string
          file_path: string
          id: string
          mime_type: string
          note_id: string
          size: number | null
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_path: string
          id?: string
          mime_type: string
          note_id: string
          size?: number | null
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_path?: string
          id?: string
          mime_type?: string
          note_id?: string
          size?: number | null
        }
        Relationships: []
      }
      note_attachments: {
        Row: {
          file_name: string
          id: string
          kind: string | null
          label: string | null
          mime: string | null
          note_id: string
          size_bytes: number | null
          uploaded_at: string
          uploaded_by: string | null
          url: string
        }
        Insert: {
          file_name: string
          id?: string
          kind?: string | null
          label?: string | null
          mime?: string | null
          note_id: string
          size_bytes?: number | null
          uploaded_at?: string
          uploaded_by?: string | null
          url: string
        }
        Update: {
          file_name?: string
          id?: string
          kind?: string | null
          label?: string | null
          mime?: string | null
          note_id?: string
          size_bytes?: number | null
          uploaded_at?: string
          uploaded_by?: string | null
          url?: string
        }
        Relationships: []
      }
      note_collaborators: {
        Row: { created_at: string; note_id: string; permission: string; user_id: string }
        Insert: { created_at?: string; note_id: string; permission?: string; user_id: string }
        Update: { created_at?: string; note_id?: string; permission?: string; user_id?: string }
        Relationships: []
      }
      note_link_shares: {
        Row: { enabled: boolean; note_id: string; permission: string; scope: string; updated_at: string }
        Insert: { enabled?: boolean; note_id: string; permission?: string; scope?: string; updated_at?: string }
        Update: { enabled?: boolean; note_id?: string; permission?: string; scope?: string; updated_at?: string }
        Relationships: []
      }
      note_stars: {
        Row: { created_at: string; note_id: string; user_id: string }
        Insert: { created_at?: string; note_id: string; user_id: string }
        Update: { created_at?: string; note_id?: string; user_id?: string }
        Relationships: []
      }
      notebooks: {
        Row: {
          color: string
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          owner_id: string
          sort_order: number
          team_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          color?: string
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          owner_id: string
          sort_order?: number
          team_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          color?: string
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          owner_id?: string
          sort_order?: number
          team_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      notes: {
        Row: {
          body: Json
          content: string | null
          created_at: string | null
          id: string
          is_locked: boolean | null
          is_pinned: boolean | null
          last_edited_by: string | null
          locked_by: string | null
          notebook_id: string | null
          owner_id: string
          snippet: string | null
          stale_since: string | null
          tags: string[]
          title: string
          updated_at: string | null
          version: number | null
        }
        Insert: {
          body?: Json
          content?: string | null
          created_at?: string | null
          id?: string
          is_locked?: boolean | null
          is_pinned?: boolean | null
          last_edited_by?: string | null
          locked_by?: string | null
          notebook_id?: string | null
          owner_id: string
          snippet?: string | null
          stale_since?: string | null
          tags?: string[]
          title: string
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          body?: Json
          content?: string | null
          created_at?: string | null
          id?: string
          is_locked?: boolean | null
          is_pinned?: boolean | null
          last_edited_by?: string | null
          locked_by?: string | null
          notebook_id?: string | null
          owner_id?: string
          snippet?: string | null
          stale_since?: string | null
          tags?: string[]
          title?: string
          updated_at?: string | null
          version?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          appearance: Json
          avatar: string | null
          color: string | null
          created_at: string | null
          email: string
          id: string
          last_login: string | null
          name: string | null
          notification_prefs: Json
          pronouns: string | null
          status: string | null
          team_id: string | null
          team_name: string | null
          title: string | null
          username: string | null
        }
        Insert: {
          appearance?: Json
          avatar?: string | null
          color?: string | null
          created_at?: string | null
          email: string
          id: string
          last_login?: string | null
          name?: string | null
          notification_prefs?: Json
          pronouns?: string | null
          status?: string | null
          team_id?: string | null
          team_name?: string | null
          title?: string | null
          username?: string | null
        }
        Update: {
          appearance?: Json
          avatar?: string | null
          color?: string | null
          created_at?: string | null
          email?: string
          id?: string
          last_login?: string | null
          name?: string | null
          notification_prefs?: Json
          pronouns?: string | null
          status?: string | null
          team_id?: string | null
          team_name?: string | null
          title?: string | null
          username?: string | null
        }
        Relationships: []
      }
      team_members: {
        Row: { created_at: string | null; role: string; team_id: string; user_id: string }
        Insert: { created_at?: string | null; role?: string; team_id: string; user_id: string }
        Update: { created_at?: string | null; role?: string; team_id?: string; user_id?: string }
        Relationships: []
      }
      teams: {
        Row: { created_at: string | null; id: string; invite_code: string | null; name: string }
        Insert: { created_at?: string | null; id?: string; invite_code?: string | null; name: string }
        Update: { created_at?: string | null; id?: string; invite_code?: string | null; name?: string }
        Relationships: []
      }
      yjs_documents: {
        Row: { note_id: string; state: string | null; updated_at: string }
        Insert: { note_id: string; state?: string | null; updated_at?: string }
        Update: { note_id?: string; state?: string | null; updated_at?: string }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      create_team_with_owner: { Args: { team_name: string }; Returns: string }
      invite_member_by_email: { Args: { p_email: string }; Returns: undefined }
      is_team_admin: { Args: { p_team_id: string }; Returns: boolean }
      join_team_by_code: { Args: { code: string }; Returns: string }
      remove_team_member: { Args: { p_user_id: string }; Returns: undefined }
      set_member_role: { Args: { p_role: string; p_user_id: string }; Returns: undefined }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
