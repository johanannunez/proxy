export type AgencyPlanTier = "starter" | "pro" | "white_label";
export type AgencyMemberRole = "org_owner" | "org_admin" | "org_member" | "org_viewer";

export interface Agency {
  id: string;
  name: string;
  slug: string;
  plan_tier: AgencyPlanTier;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgencyMember {
  id: string;
  agency_id: string;
  profile_id: string;
  role: AgencyMemberRole;
  invited_by: string | null;
  joined_at: string;
}

export interface AgencyBranding {
  agency_id: string;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  accent_color: string;
  font_heading: string;
  font_body: string;
  custom_domain: string | null;
  email_sender_name: string | null;
  email_sender_domain: string | null;
  powered_by_proxy: boolean;
  updated_at: string;
}

export interface AgencySettings {
  agency_id: string;
  features: Record<string, boolean>;
  limits: {
    max_workspaces: number; // -1 = unlimited
    max_members: number;
    max_forms: number;
    max_templates: number;
  };
}

export const DEFAULT_AGENCY_ID = "00000000-0000-0000-0000-000000000001";
