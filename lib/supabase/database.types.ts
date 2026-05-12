// Minimal hand-written Supabase types covering only what app code touches.
// Replace with `supabase gen types typescript` output once the project is linked.

export type SubmissionStatus =
  | "pending_payment"
  | "pending_review"
  | "approved"
  | "rejected";

export type PledgeDonationType = "entry" | "vote" | "general" | "unknown";

export type PledgeWebhookStatus =
  | "received"
  | "verified"
  | "processed"
  | "unmapped"
  | "failed";

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
          total_votes: number;
          manual_vote_adjustment: number;
          total_donated_cents: number;
          pledge_donation_url: string | null;
          pledge_widget_id: string | null;
          pledge_campaign_id: string | null;
          pledge_mapping_key: string | null;
          entry_pledge_transaction_id: string | null;
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
          total_votes: number;
          manual_vote_adjustment: number;
          total_donated_cents: number;
          pledge_donation_url: string | null;
          pledge_widget_id: string | null;
          pledge_campaign_id: string | null;
          pledge_mapping_key: string | null;
          entry_pledge_transaction_id: string | null;
          rejection_reason: string | null;
          approved_at: string | null;
          rejected_at: string | null;
        }>;
        Relationships: [];
      };
      pledge_donations: {
        Row: {
          id: string;
          pet_submission_id: string | null;
          pledge_event_id: string;
          pledge_transaction_id: string | null;
          pledge_campaign_id: string | null;
          pledge_widget_id: string | null;
          pledge_fundraiser_id: string | null;
          pledge_mapping_key: string | null;
          donor_name: string | null;
          donor_email: string | null;
          amount_cents: number;
          tip_cents: number;
          fee_cents: number;
          currency: string;
          vote_credits: number;
          donation_type: PledgeDonationType;
          raw_payload: Json;
          processed_at: string | null;
          created_at: string;
        };
        Insert: {
          pet_submission_id?: string | null;
          pledge_event_id: string;
          pledge_transaction_id?: string | null;
          pledge_campaign_id?: string | null;
          pledge_widget_id?: string | null;
          pledge_fundraiser_id?: string | null;
          pledge_mapping_key?: string | null;
          donor_name?: string | null;
          donor_email?: string | null;
          amount_cents: number;
          tip_cents?: number;
          fee_cents?: number;
          currency?: string;
          vote_credits: number;
          donation_type?: PledgeDonationType;
          raw_payload: Json;
          processed_at?: string | null;
        };
        Update: Partial<{
          pet_submission_id: string | null;
          donation_type: PledgeDonationType;
          processed_at: string | null;
        }>;
        Relationships: [];
      };
      pledge_webhook_events: {
        Row: {
          id: string;
          pledge_event_id: string | null;
          event_type: string | null;
          signature_verified: boolean;
          processing_status: PledgeWebhookStatus;
          pet_submission_id: string | null;
          donation_id: string | null;
          error_message: string | null;
          raw_payload: Json;
          raw_headers: Json;
          processed_at: string | null;
          created_at: string;
        };
        Insert: {
          pledge_event_id?: string | null;
          event_type?: string | null;
          signature_verified: boolean;
          processing_status?: PledgeWebhookStatus;
          pet_submission_id?: string | null;
          donation_id?: string | null;
          error_message?: string | null;
          raw_payload: Json;
          raw_headers?: Json;
          processed_at?: string | null;
        };
        Update: Partial<{
          processing_status: PledgeWebhookStatus;
          pet_submission_id: string | null;
          donation_id: string | null;
          error_message: string | null;
          processed_at: string | null;
        }>;
        Relationships: [];
      };
      manual_vote_audit: {
        Row: {
          id: string;
          pet_submission_id: string;
          admin_user_id: string | null;
          amount_cents_delta: number;
          votes_delta: number;
          previous_total: number;
          new_total: number;
          reason: string;
          created_at: string;
        };
        Insert: {
          pet_submission_id: string;
          admin_user_id?: string | null;
          amount_cents_delta: number;
          votes_delta: number;
          previous_total: number;
          new_total: number;
          reason: string;
        };
        Update: Partial<Record<string, never>>;
        Relationships: [];
      };
      donation_intents: {
        Row: {
          id: string;
          pet_submission_id: string;
          user_id: string | null;
          donor_email: string | null;
          intent_type: "entry" | "vote";
          created_at: string;
          expires_at: string;
          consumed_at: string | null;
          consumed_donation_id: string | null;
        };
        Insert: {
          pet_submission_id: string;
          user_id?: string | null;
          donor_email?: string | null;
          intent_type: "entry" | "vote";
          expires_at?: string;
        };
        Update: Partial<{
          consumed_at: string | null;
          consumed_donation_id: string | null;
        }>;
        Relationships: [];
      };
      contest_settings: {
        Row: {
          id: number;
          contest_open: boolean;
          submissions_open: boolean;
          voting_open: boolean;
          submission_deadline: string;
          voting_deadline: string;
          goal_amount_cents: number;
          current_amount_cents: number;
          updated_at: string;
        };
        Insert: { id?: number };
        Update: Partial<{
          contest_open: boolean;
          submissions_open: boolean;
          voting_open: boolean;
          submission_deadline: string;
          voting_deadline: string;
          goal_amount_cents: number;
          current_amount_cents: number;
        }>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      promote_admin_by_email: {
        Args: { p_email: string };
        Returns: undefined;
      };
      is_admin: {
        Args: { uid: string };
        Returns: boolean;
      };
      increment_pet_votes: {
        Args: { p_pet_id: string; p_votes: number; p_cents: number };
        Returns: undefined;
      };
      apply_manual_vote_adjustment: {
        Args: {
          p_pet_id: string;
          p_admin_id: string | null;
          p_cents_delta: number;
          p_reason: string;
        };
        Returns: Database["public"]["Tables"]["manual_vote_audit"]["Row"];
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
