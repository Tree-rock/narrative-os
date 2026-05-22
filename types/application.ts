export type ApplicationStatus =
  | "drafting"
  | "applied"
  | "phone_screen"
  | "interview"
  | "offer"
  | "rejected"

export interface ApplicationEntry {
  id: string
  company: string
  position: string
  status: ApplicationStatus
  applied_at: string | null
  next_action: string | null
  next_action_date: string | null
  notes: string | null
  workspace_id: string | null
  created_at: string
  updated_at: string
}
