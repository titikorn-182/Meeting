/** Hand-maintained RPC contract for the committed migrations (not generated table types).
 * The web client has no direct table DML. Regenerate/compare after remote migrations.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: {
      get_workspace_state: { Args: { p_organization_id?: string }; Returns: Json };
      workspace_command: {
        Args: { p_organization_id: string; p_operation: string; p_payload: Json; p_idempotency_key: string };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
