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
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      businesses: {
        Row: {
          area: string | null
          category: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
          phone: string | null
          rating: number | null
          updated_at: string
        }
        Insert: {
          area?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id: string
          phone?: string | null
          rating?: number | null
          updated_at?: string
        }
        Update: {
          area?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          phone?: string | null
          rating?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message: string | null
          last_message_at: string
          read_a_at: string
          read_b_at: string
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message?: string | null
          last_message_at?: string
          read_a_at?: string
          read_b_at?: string
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message?: string | null
          last_message_at?: string
          read_a_at?: string
          read_b_at?: string
          user_a?: string
          user_b?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_user_a_profile_fkey"
            columns: ["user_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_user_b_profile_fkey"
            columns: ["user_b"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
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
          id: string
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
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
            foreignKeyName: "messages_sender_id_profile_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          area: string | null
          avatar_emoji: string | null
          avatar_url: string | null
          backstory: string | null
          bio: string | null
          created_at: string
          dating_interested: boolean
          display_name: string
          id: string
          is_active: boolean
          is_fake: boolean
          is_goan: boolean
          is_tourist: boolean
          language_style: string | null
          origin_city: string | null
          personality: string | null
          reply_delay_pattern: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          area?: string | null
          avatar_emoji?: string | null
          avatar_url?: string | null
          backstory?: string | null
          bio?: string | null
          created_at?: string
          dating_interested?: boolean
          display_name?: string
          id: string
          is_active?: boolean
          is_fake?: boolean
          is_goan?: boolean
          is_tourist?: boolean
          language_style?: string | null
          origin_city?: string | null
          personality?: string | null
          reply_delay_pattern?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          area?: string | null
          avatar_emoji?: string | null
          avatar_url?: string | null
          backstory?: string | null
          bio?: string | null
          created_at?: string
          dating_interested?: boolean
          display_name?: string
          id?: string
          is_active?: boolean
          is_fake?: boolean
          is_goan?: boolean
          is_tourist?: boolean
          language_style?: string | null
          origin_city?: string | null
          personality?: string | null
          reply_delay_pattern?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      short_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          user_id: string
          video_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          user_id: string
          video_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          user_id?: string
          video_id?: string
        }
        Relationships: []
      }
      short_events: {
        Row: {
          created_at: string
          id: number
          kind: string
          source: string
          user_id: string | null
          video_id: string
          watch_ms: number
        }
        Insert: {
          created_at?: string
          id?: number
          kind: string
          source?: string
          user_id?: string | null
          video_id: string
          watch_ms?: number
        }
        Update: {
          created_at?: string
          id?: number
          kind?: string
          source?: string
          user_id?: string | null
          video_id?: string
          watch_ms?: number
        }
        Relationships: []
      }
      short_likes: {
        Row: {
          created_at: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
          video_id?: string
        }
        Relationships: []
      }
      site_content: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
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
      user_shorts: {
        Row: {
          area: string | null
          caption: string
          created_at: string
          duration_seconds: number | null
          id: string
          is_active: boolean
          poster_path: string | null
          updated_at: string
          user_id: string
          video_path: string
        }
        Insert: {
          area?: string | null
          caption?: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          is_active?: boolean
          poster_path?: string | null
          updated_at?: string
          user_id: string
          video_path: string
        }
        Update: {
          area?: string | null
          caption?: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          is_active?: boolean
          poster_path?: string | null
          updated_at?: string
          user_id?: string
          video_path?: string
        }
        Relationships: []
      }
      youtube_channels: {
        Row: {
          active: boolean
          avatar_url: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          priority: number
          subscribers: string | null
          updated_at: string
          url: string
          weight: number
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          priority?: number
          subscribers?: string | null
          updated_at?: string
          url: string
          weight?: number
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          priority?: number
          subscribers?: string | null
          updated_at?: string
          url?: string
          weight?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_conversation_member: {
        Args: { _conv: string; _user: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
