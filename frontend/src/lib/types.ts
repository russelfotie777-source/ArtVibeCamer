/**
 * Types du contrat d'API, derives de docs/API.md.
 *
 * Tenus a la main plutot que generes : le contrat est stable et la
 * generation aurait demande un outillage que le calendrier ne permet pas.
 * Si l'API change, ce fichier et docs/API.md se mettent a jour ensemble.
 */

export type Reglages = {
  event_name: string;
  event_tagline: string | null;
  event_date: string | null;
  event_venue: string | null;
  event_city: string | null;
  contact_phone: string | null;
  contact_whatsapp: string | null;
  contact_email: string | null;
  registration_enabled: boolean;
  voting_enabled: boolean;
  ticketing_enabled: boolean;
  results_public: boolean;
  show_vote_counts: boolean;
};

export type Categorie = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  tagline: string | null;
  cover_image: string | null;
  /** Tarif individuel. */
  registration_fee: number;
  /** Tarif groupe. `null` = la categorie ne se presente qu'en individuel. */
  group_fee: number | null;
  allows_group: boolean;
  max_group_members: number;
  vote_price: number;
  candidates_count: number;
  votes_count: number;
  max_candidates: number | null;
  is_registration_open: boolean;
  is_voting_open: boolean;
  is_full: boolean;
  registration_closes_at: string | null;
  voting_closes_at: string | null;
  display_order: number;
  /* Presents uniquement pour une requete authentifiee back-office. */
  is_active?: boolean;
};

export type StatutCandidat =
  | "draft"
  | "awaiting_payment"
  | "pending_review"
  | "active"
  | "rejected"
  | "withdrawn"
  | "eliminated";

export type TypeInscription = "solo" | "group";

export type MembreGroupe = {
  full_name: string;
  photo_url: string | null;
};

export type Candidat = {
  id: number;
  candidate_number: string | null;
  slug: string;
  display_name: string;
  stage_name: string | null;
  registration_type: TypeInscription;
  registration_type_label: string;
  is_group: boolean;
  group_name: string | null;
  members_count: number;
  members?: MembreGroupe[];
  photo_url: string | null;
  presentation: string | null;
  city: string | null;
  region: string | null;
  socials: Record<string, string | null> | null;
  votes_count: number;
  status: StatutCandidat;
  status_label: string;
  is_votable: boolean;
  is_featured: boolean;
  category?: Categorie;
  /* Reserves au back-office. */
  first_name?: string;
  last_name?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  whatsapp?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
  has_paid_registration?: boolean;
  rejection_reason?: string | null;
  reviewed_at?: string | null;
  ip_address?: string | null;
  created_at?: string;
  reviewer?: string | null;
  registration_transaction?: Transaction | null;
};

export type StatutTransaction =
  | "pending"
  | "processing"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "expired"
  | "refunded";

export type Transaction = {
  reference: string;
  type: "registration" | "vote" | "ticket";
  type_label: string;
  amount: number;
  formatted_amount: string;
  currency: string;
  status: StatutTransaction;
  status_label: string;
  is_final: boolean;
  is_awaiting_payer: boolean;
  payment_method: string | null;
  payment_method_label: string | null;
  paid_at: string | null;
  expires_at: string | null;
  failure_reason: string | null;
  created_at: string | null;
  /* Reserves au back-office. */
  id?: number;
  provider?: string;
  provider_reference?: string | null;
  payer_name?: string | null;
  payer_phone?: string | null;
  payer_email?: string | null;
  ip_address?: string | null;
};

export type Paiement = {
  instructions: string | null;
  redirect_url: string | null;
};

export type ReponseInscription = {
  message: string;
  candidate: Candidat;
  transaction: Transaction;
  payment: Paiement;
};

export type Utilisateur = {
  id: number;
  name: string;
  email: string;
  role: "super_admin" | "admin" | "moderator" | "scanner";
  role_label: string;
  capabilities: {
    manage: boolean;
    moderate: boolean;
    scan: boolean;
    back_office: boolean;
    administrate: boolean;
  };
  last_login_at: string | null;
};

export type TableauDeBord = {
  overview: {
    candidates: {
      total: number;
      paid: number;
      awaiting_payment: number;
      pending_review: number;
      active: number;
      rejected: number;
    };
    votes: { total: number; orders: number; pending_orders: number };
    tickets: {
      sold: number;
      orders: number;
      checked_in: number;
      pending_orders: number;
    };
    revenue: {
      registrations: number;
      votes: number;
      tickets: number;
      total: number;
      currency: string;
    };
    payments: { succeeded: number; pending: number; failed: number };
  };
  by_category: Array<{
    id: number;
    name: string;
    slug: string;
    candidates_count: number;
    active_candidates: number;
    votes_count: number;
    vote_revenue: number;
    registration_fee: number;
    vote_price: number;
  }>;
  timeline: Array<{
    date: string;
    votes: number;
    revenue: number;
    registrations: number;
    tickets: number;
  }>;
  leaderboard: Array<{
    position: number;
    candidate_number: string | null;
    name: string;
    votes_count: number;
  }>;
  entrance: {
    tickets_issued: number;
    checked_in: number;
    remaining: number;
    rate: number;
    rejected_scans: number;
    last_hour: number;
  };
  alerts: {
    stale_transactions: number;
    unprocessed_webhooks: number;
    invalid_signatures: number;
    expired_orders: number;
  };
  generated_at: string;
};

/** Enveloppe des listes paginees de Laravel. */
export type Page<T> = {
  data: T[];
  links: { first: string | null; last: string | null; prev: string | null; next: string | null };
  meta: {
    current_page: number;
    from: number | null;
    last_page: number;
    per_page: number;
    to: number | null;
    total: number;
  };
};

export type Enveloppe<T> = { data: T };
