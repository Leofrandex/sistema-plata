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
      client_locations: {
        Row: {
          area: string
          client_id: string
          floor: string
          id: string
        }
        Insert: {
          area: string
          client_id: string
          floor: string
          id?: string
        }
        Update: {
          area?: string
          client_id?: string
          floor?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_locations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          client_id: string
          code_letter: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          client_id: string
          code_letter: string
          created_at?: string
          id: string
          name: string
        }
        Update: {
          client_id?: string
          code_letter?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      container_locations: {
        Row: {
          area: string | null
          client_id: string | null
          container_id: string
          floor: string | null
          id: string
          location_type: Database["public"]["Enums"]["location_type"]
          notes: string | null
          operator_id: string
          reported_at: string
        }
        Insert: {
          area?: string | null
          client_id?: string | null
          container_id: string
          floor?: string | null
          id?: string
          location_type: Database["public"]["Enums"]["location_type"]
          notes?: string | null
          operator_id: string
          reported_at?: string
        }
        Update: {
          area?: string | null
          client_id?: string | null
          container_id?: string
          floor?: string | null
          id?: string
          location_type?: Database["public"]["Enums"]["location_type"]
          notes?: string | null
          operator_id?: string
          reported_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "container_locations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "container_locations_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "containers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "container_locations_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      container_receptions: {
        Row: {
          arrived_at: string
          container_id: string
          created_at: string
          gross_weight_kg: number
          id: string
          observations: string
          operator_id: string
          weighing_session_id: string | null
        }
        Insert: {
          arrived_at?: string
          container_id: string
          created_at?: string
          gross_weight_kg: number
          id?: string
          observations?: string
          operator_id: string
          weighing_session_id?: string | null
        }
        Update: {
          arrived_at?: string
          container_id?: string
          created_at?: string
          gross_weight_kg?: number
          id?: string
          observations?: string
          operator_id?: string
          weighing_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "container_receptions_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "containers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "container_receptions_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "container_receptions_weighing_session_id_fkey"
            columns: ["weighing_session_id"]
            isOneToOne: false
            referencedRelation: "weighing_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      containers: {
        Row: {
          company_id: string | null
          id: string
          is_yaris_dedicated: boolean
          registered_at: string
          size_liters: Database["public"]["Enums"]["container_size"]
          status: Database["public"]["Enums"]["container_status"]
          tare_weight_kg: number
          waste_type: Database["public"]["Enums"]["waste_type"]
        }
        Insert: {
          company_id?: string | null
          id: string
          is_yaris_dedicated?: boolean
          registered_at?: string
          size_liters: Database["public"]["Enums"]["container_size"]
          status?: Database["public"]["Enums"]["container_status"]
          tare_weight_kg: number
          waste_type: Database["public"]["Enums"]["waste_type"]
        }
        Update: {
          company_id?: string | null
          id?: string
          is_yaris_dedicated?: boolean
          registered_at?: string
          size_liters?: Database["public"]["Enums"]["container_size"]
          status?: Database["public"]["Enums"]["container_status"]
          tare_weight_kg?: number
          waste_type?: Database["public"]["Enums"]["waste_type"]
        }
        Relationships: [
          {
            foreignKeyName: "containers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      external_transfers: {
        Row: {
          container_id: string
          created_at: string
          destination: string
          id: string
          operator_id: string
          storage_started_at: string
          transferred_at: string | null
        }
        Insert: {
          container_id: string
          created_at?: string
          destination?: string
          id?: string
          operator_id: string
          storage_started_at?: string
          transferred_at?: string | null
        }
        Update: {
          container_id?: string
          created_at?: string
          destination?: string
          id?: string
          operator_id?: string
          storage_started_at?: string
          transferred_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_transfers_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "containers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_transfers_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          created_at: string
          event_id: string
          event_type: Database["public"]["Enums"]["photo_event_type"]
          id: string
          label: string
          storage_path: string | null
          taken_at: string
          uploaded_by: string | null
          url: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          event_type: Database["public"]["Enums"]["photo_event_type"]
          id?: string
          label?: string
          storage_path?: string | null
          taken_at?: string
          uploaded_by?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          event_type?: Database["public"]["Enums"]["photo_event_type"]
          id?: string
          label?: string
          storage_path?: string | null
          taken_at?: string
          uploaded_by?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      route_event_containers_clean: {
        Row: {
          container_id: string
          route_event_id: string
        }
        Insert: {
          container_id: string
          route_event_id: string
        }
        Update: {
          container_id?: string
          route_event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_event_containers_clean_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "containers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_event_containers_clean_route_event_id_fkey"
            columns: ["route_event_id"]
            isOneToOne: false
            referencedRelation: "route_events"
            referencedColumns: ["id"]
          },
        ]
      }
      route_event_containers_dirty: {
        Row: {
          container_id: string
          route_event_id: string
        }
        Insert: {
          container_id: string
          route_event_id: string
        }
        Update: {
          container_id?: string
          route_event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_event_containers_dirty_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "containers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_event_containers_dirty_route_event_id_fkey"
            columns: ["route_event_id"]
            isOneToOne: false
            referencedRelation: "route_events"
            referencedColumns: ["id"]
          },
        ]
      }
      route_events: {
        Row: {
          area: string
          client_id: string
          created_at: string
          date: string
          dock: string
          ended_at: string | null
          floor: string
          id: string
          kind: Database["public"]["Enums"]["route_kind"]
          operator_id: string
          slot: Database["public"]["Enums"]["route_slot"] | null
          started_at: string
          status: Database["public"]["Enums"]["route_event_status"]
        }
        Insert: {
          area?: string
          client_id: string
          created_at?: string
          date: string
          dock?: string
          ended_at?: string | null
          floor?: string
          id?: string
          kind: Database["public"]["Enums"]["route_kind"]
          operator_id: string
          slot?: Database["public"]["Enums"]["route_slot"] | null
          started_at: string
          status?: Database["public"]["Enums"]["route_event_status"]
        }
        Update: {
          area?: string
          client_id?: string
          created_at?: string
          date?: string
          dock?: string
          ended_at?: string | null
          floor?: string
          id?: string
          kind?: Database["public"]["Enums"]["route_kind"]
          operator_id?: string
          slot?: Database["public"]["Enums"]["route_slot"] | null
          started_at?: string
          status?: Database["public"]["Enums"]["route_event_status"]
        }
        Relationships: [
          {
            foreignKeyName: "route_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_events_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_events: {
        Row: {
          container_id: string
          created_at: string
          entry_at: string
          exit_at: string | null
          id: string
          operator_id: string
        }
        Insert: {
          container_id: string
          created_at?: string
          entry_at?: string
          exit_at?: string | null
          id?: string
          operator_id: string
        }
        Update: {
          container_id?: string
          created_at?: string
          entry_at?: string
          exit_at?: string | null
          id?: string
          operator_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "storage_events_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "containers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storage_events_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_runs: {
        Row: {
          completed_at: string | null
          container_id: string
          created_at: string
          id: string
          operator_id: string
          started_at: string
        }
        Insert: {
          completed_at?: string | null
          container_id: string
          created_at?: string
          id?: string
          operator_id: string
          started_at?: string
        }
        Update: {
          completed_at?: string | null
          container_id?: string
          created_at?: string
          id?: string
          operator_id?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_runs_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "containers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_runs_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weighing_sessions: {
        Row: {
          client_id: string
          created_at: string
          date: string
          ended_at: string | null
          id: string
          operator_id: string
          started_at: string
          status: Database["public"]["Enums"]["weighing_session_status"]
        }
        Insert: {
          client_id: string
          created_at?: string
          date: string
          ended_at?: string | null
          id?: string
          operator_id: string
          started_at: string
          status?: Database["public"]["Enums"]["weighing_session_status"]
        }
        Update: {
          client_id?: string
          created_at?: string
          date?: string
          ended_at?: string | null
          id?: string
          operator_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["weighing_session_status"]
        }
        Relationships: [
          {
            foreignKeyName: "weighing_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weighing_sessions_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      container_receptions_with_net: {
        Row: {
          arrived_at: string | null
          container_id: string | null
          created_at: string | null
          gross_weight_kg: number | null
          id: string | null
          net_weight_kg: number | null
          operator_id: string | null
          weighing_session_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "container_receptions_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "containers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "container_receptions_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "container_receptions_weighing_session_id_fkey"
            columns: ["weighing_session_id"]
            isOneToOne: false
            referencedRelation: "weighing_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      container_phase:
        | "route"
        | "weighing"
        | "cold_storage"
        | "treatment"
        | "transfer"
        | "clean"
      container_size: "240" | "750" | "1100"
      container_status: "active" | "decommissioned"
      location_type:
        | "client_site"
        | "plant_storage"
        | "cold_storage"
        | "treatment"
      photo_event_type: "route" | "weighing" | "storage" | "treatment" | "other"
      route_event_status: "in_progress" | "completed"
      route_kind: "anden" | "morgue"
      route_slot: "06:30" | "10:30" | "13:20" | "14:30" | "18:30" | "21:00"
      waste_type:
        | "infectious"
        | "anatomopathological"
        | "cytotoxic"
        | "liquid"
        | "morgue"
      weighing_session_status: "in_progress" | "completed"
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
      container_phase: [
        "route",
        "weighing",
        "cold_storage",
        "treatment",
        "transfer",
        "clean",
      ],
      container_size: ["240", "750", "1100"],
      container_status: ["active", "decommissioned"],
      location_type: [
        "client_site",
        "plant_storage",
        "cold_storage",
        "treatment",
      ],
      photo_event_type: ["route", "weighing", "storage", "treatment", "other"],
      route_event_status: ["in_progress", "completed"],
      route_kind: ["anden", "morgue"],
      route_slot: ["06:30", "10:30", "13:20", "14:30", "18:30", "21:00"],
      waste_type: [
        "infectious",
        "anatomopathological",
        "cytotoxic",
        "liquid",
        "morgue",
      ],
      weighing_session_status: ["in_progress", "completed"],
    },
  },
} as const
