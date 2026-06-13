/**
 * Signer-role display labels. The operating team's role is stored as "Proxy"
 * (the countersignature config depends on that value), but to the operator it
 * is themselves, so it reads as "You" everywhere it is shown.
 */

const SIGNER_ROLE_LABELS: Record<string, string> = {
  Proxy: "You",
};

export function signerRoleLabel(role: string): string {
  return SIGNER_ROLE_LABELS[role] ?? role;
}

export function signerRolesLabel(roles: string[]): string {
  return roles.map(signerRoleLabel).join(", ");
}
