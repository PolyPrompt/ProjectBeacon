export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          clerk_user_id: string;
          name: string;
          email: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          clerk_user_id: string;
          name: string;
          email: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          clerk_user_id?: string;
          name?: string;
          email?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      projects: {
        Row: {
          id: string;
          name: string;
          description: string;
          deadline: string;
          owner_user_id: string;
          planning_status: Database["public"]["Enums"]["project_planning_status"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description: string;
          deadline: string;
          owner_user_id: string;
          planning_status?: Database["public"]["Enums"]["project_planning_status"];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          deadline?: string;
          owner_user_id?: string;
          planning_status?: Database["public"]["Enums"]["project_planning_status"];
          created_at?: string;
          updated_at?: string;
        };
      };
      project_members: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          role: Database["public"]["Enums"]["project_member_role"];
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          role: Database["public"]["Enums"]["project_member_role"];
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          user_id?: string;
          role?: Database["public"]["Enums"]["project_member_role"];
          created_at?: string;
        };
      };
      skills: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
        };
      };
      user_skills: {
        Row: {
          id: string;
          user_id: string;
          skill_id: string;
          level: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          skill_id: string;
          level: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          skill_id?: string;
          level?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      project_member_skills: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          skill_id: string;
          level: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          skill_id: string;
          level: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          user_id?: string;
          skill_id?: string;
          level?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      tasks: {
        Row: {
          id: string;
          project_id: string;
          assignee_user_id: string | null;
          title: string;
          description: string;
          difficulty_points: 1 | 2 | 3 | 5 | 8;
          status: Database["public"]["Enums"]["task_status"];
          due_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          assignee_user_id?: string | null;
          title: string;
          description: string;
          difficulty_points: 1 | 2 | 3 | 5 | 8;
          status?: Database["public"]["Enums"]["task_status"];
          due_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          assignee_user_id?: string | null;
          title?: string;
          description?: string;
          difficulty_points?: 1 | 2 | 3 | 5 | 8;
          status?: Database["public"]["Enums"]["task_status"];
          due_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      task_required_skills: {
        Row: {
          id: string;
          task_id: string;
          skill_id: string;
          weight: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          skill_id: string;
          weight?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          skill_id?: string;
          weight?: number | null;
          created_at?: string;
        };
      };
      task_dependencies: {
        Row: {
          id: string;
          project_id: string;
          task_id: string;
          depends_on_task_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          task_id: string;
          depends_on_task_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          task_id?: string;
          depends_on_task_id?: string;
          created_at?: string;
        };
      };
      project_contexts: {
        Row: {
          id: string;
          project_id: string;
          source_type: Database["public"]["Enums"]["project_context_source_type"];
          context_type: Database["public"]["Enums"]["project_context_type"];
          title: string | null;
          text_content: string;
          status: Database["public"]["Enums"]["project_context_status"];
          created_by_user_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          source_type: Database["public"]["Enums"]["project_context_source_type"];
          context_type: Database["public"]["Enums"]["project_context_type"];
          title?: string | null;
          text_content: string;
          status?: Database["public"]["Enums"]["project_context_status"];
          created_by_user_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          source_type?: Database["public"]["Enums"]["project_context_source_type"];
          context_type?: Database["public"]["Enums"]["project_context_type"];
          title?: string | null;
          text_content?: string;
          status?: Database["public"]["Enums"]["project_context_status"];
          created_by_user_id?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      project_documents: {
        Row: {
          id: string;
          project_id: string;
          storage_key: string;
          file_name: string;
          mime_type: string;
          size_bytes: number;
          uploaded_by_user_id: string;
          is_public: boolean;
          used_for_planning: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          storage_key: string;
          file_name: string;
          mime_type: string;
          size_bytes: number;
          uploaded_by_user_id: string;
          is_public?: boolean;
          used_for_planning?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          storage_key?: string;
          file_name?: string;
          mime_type?: string;
          size_bytes?: number;
          uploaded_by_user_id?: string;
          is_public?: boolean;
          used_for_planning?: boolean;
          created_at?: string;
        };
      };
      project_document_access: {
        Row: {
          id: string;
          document_id: string;
          user_id: string;
          assigned_by_user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          user_id: string;
          assigned_by_user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          user_id?: string;
          assigned_by_user_id?: string;
          created_at?: string;
        };
      };
      task_reassignment_requests: {
        Row: {
          id: string;
          project_id: string;
          request_type: Database["public"]["Enums"]["reassignment_request_type"];
          task_id: string;
          counterparty_task_id: string | null;
          from_user_id: string;
          to_user_id: string;
          reason: string;
          status: Database["public"]["Enums"]["reassignment_request_status"];
          requested_by_user_id: string;
          responded_by_user_id: string | null;
          created_at: string;
          responded_at: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          request_type: Database["public"]["Enums"]["reassignment_request_type"];
          task_id: string;
          counterparty_task_id?: string | null;
          from_user_id: string;
          to_user_id: string;
          reason: string;
          status?: Database["public"]["Enums"]["reassignment_request_status"];
          requested_by_user_id: string;
          responded_by_user_id?: string | null;
          created_at?: string;
          responded_at?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string;
          request_type?: Database["public"]["Enums"]["reassignment_request_type"];
          task_id?: string;
          counterparty_task_id?: string | null;
          from_user_id?: string;
          to_user_id?: string;
          reason?: string;
          status?: Database["public"]["Enums"]["reassignment_request_status"];
          requested_by_user_id?: string;
          responded_by_user_id?: string | null;
          created_at?: string;
          responded_at?: string | null;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      project_planning_status: "draft" | "locked" | "assigned";
      project_member_role: "owner" | "member";
      task_status: "todo" | "in_progress" | "blocked" | "done";
      project_context_source_type: "text" | "pdf" | "doc";
      project_context_type:
        | "initial"
        | "clarification_qa"
        | "assumption"
        | "document_extract";
      project_context_status: "active" | "archived";
      reassignment_request_type: "swap" | "handoff";
      reassignment_request_status:
        | "pending"
        | "accepted"
        | "rejected"
        | "cancelled";
    };
    CompositeTypes: Record<string, never>;
  };
};
