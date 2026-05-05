// Minimal hand-written Supabase types covering only what app code touches.
// Replace with `supabase gen types typescript` output once the project is linked.

export type SubmissionStatus =
  | "pending_payment"
  | "pending_review"
  | "approved"
  | "rejected";

type Json = string | number | boolean | null | { [k: string]: Json } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: "user" | "admin";
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          role?: "user" | "admin";
        };
        Update: Partial<{ full_name: string | null; role: "user" | "admin" }>;
        Relationships: [];
      };
      pet_submissions: {
        Row: {
          id: string;
          user_id: string;
          owner_name: string;
          owner_email: string;
          owner_phone: string | null;
          pet_name: string;
          image_path: string;
          public_image_path: string | null;
          consent_public_display: boolean;
          acknowledged_nonrefundable: boolean;
          status: SubmissionStatus;
          entry_donation_confirmed: boolean;
          givebutter_member_url: string | null;
          givebutter_member_id: string | null;
          rejection_reason: string | null;
          created_at: string;
          approved_at: string | null;
          rejected_at: string | null;
        };
        Insert: {
          user_id: string;
          owner_name: string;
          owner_email: string;
          owner_phone?: string | null;
          pet_name: string;
          image_path: string;
          public_image_path?: string | null;
          consent_public_display?: boolean;
          acknowledged_nonrefundable?: boolean;
          status?: SubmissionStatus;
        };
        Update: Partial<{
          owner_name: string;
          owner_email: string;
          owner_phone: string | null;
          pet_name: string;
          image_path: string;
          public_image_path: string | null;
          status: SubmissionStatus;
          entry_donation_confirmed: boolean;
          givebutter_member_url: string | null;
          givebutter_member_id: string | null;
          rejection_reason: string | null;
          approved_at: string | null;
          rejected_at: string | null;
        }>;
        Relationships: [];
      };
      vote_transactions: {
        Row: {
          id: string;
          pet_submission_id: string | null;
          givebutter_transaction_id: string;
          kind: "entry" | "vote" | "manual";
          donor_name: string | null;
          donor_email: string | null;
          amount_cents: number;
          votes: number;
          raw_payload: Json;
          created_by_admin: string | null;
          note: string | null;
          donor_user_id: string | null;
          parent_transaction_id: string | null;
          created_at: string;
        };
        Insert: {
          pet_submission_id?: string | null;
          givebutter_transaction_id: string;
          kind?: "entry" | "vote" | "manual";
          donor_name?: string | null;
          donor_email?: string | null;
          amount_cents: number;
          votes: number;
          raw_payload?: Json;
          created_by_admin?: string | null;
          note?: string | null;
          donor_user_id?: string | null;
          parent_transaction_id?: string | null;
        };
        Update: Partial<{
          pet_submission_id: string | null;
          amount_cents: number;
          votes: number;
          note: string | null;
          donor_user_id: string | null;
          parent_transaction_id: string | null;
        }>;
        Relationships: [];
      };
      contest_settings: {
        Row: {
          id: number;
          contest_open: boolean;
          submission_deadline: string;
          voting_deadline: string;
          goal_amount_cents: number;
          updated_at: string;
        };
        Insert: { id?: number };
        Update: Partial<{
          contest_open: boolean;
          submission_deadline: string;
          voting_deadline: string;
          goal_amount_cents: number;
        }>;
        Relationships: [];
      };
      webhook_events_raw: {
        Row: {
          id: string;
          source: string;
          event_type: string | null;
          signature_valid: boolean;
          matched: boolean;
          pet_submission_id: string | null;
          payload: Json;
          error: string | null;
          received_at: string;
        };
        Insert: {
          source?: string;
          event_type?: string | null;
          signature_valid: boolean;
          matched?: boolean;
          pet_submission_id?: string | null;
          payload: Json;
          error?: string | null;
        };
        Update: Partial<{
          matched: boolean;
          pet_submission_id: string | null;
          error: string | null;
        }>;
        Relationships: [];
      };
    };
    Views: {
      pet_leaderboard: {
        Row: {
          id: string;
          pet_name: string;
          owner_name: string;
          public_image_path: string | null;
          givebutter_member_url: string | null;
          approved_at: string | null;
          total_votes: number;
          total_amount_cents: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      promote_admin_by_email: {
        Args: { p_email: string };
        Returns: undefined;
      };
      is_admin: {
        Args: { uid: string };
        Returns: boolean;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
