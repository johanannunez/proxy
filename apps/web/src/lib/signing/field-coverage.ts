/**
 * Field coverage: a template is ready to send only when every signer role has
 * at least one field assigned to it in the DocuSeal layout. A signer with no
 * field has nothing to sign, so the document would be unsendable for them.
 *
 * Pure and dependency-free (no "server-only", no imports) so it runs in vitest
 * and on either side of the server/client boundary.
 */

export type CoverageResult = {
  ready: boolean;
  missingRoles: string[];
};

/**
 * @param fields      Each field's signer role (one entry per field).
 * @param signerRoles The roles the template expects to sign, in display order.
 * @returns missingRoles = signerRoles with zero fields, in signerRoles order.
 *          ready = every signer role is covered AND there is at least one role.
 */
export function computeCoverage(
  fields: { role: string }[],
  signerRoles: string[],
): CoverageResult {
  const covered = new Set(fields.map((f) => f.role));
  const missingRoles = signerRoles.filter((role) => !covered.has(role));
  return { ready: missingRoles.length === 0 && signerRoles.length > 0, missingRoles };
}
