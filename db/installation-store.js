// Multi-tenant Slack installation store backed by the shared libSQL client, with
// tokens encrypted at rest. Implements Bolt's InstallationStore interface.
import { db, deleteTeamData } from './index.js';
import { encrypt, decrypt } from './crypto.js';

/**
 * Derive a stable key from either an Installation (store) or an InstallQuery
 * (fetch/delete). Org-wide installs key on enterprise id, else team id.
 * @param {any} source
 * @returns {string}
 */
function keyFrom(source) {
  const enterpriseId = source.enterprise?.id ?? source.enterpriseId;
  const teamId = source.team?.id ?? source.teamId;
  if (source.isEnterpriseInstall && enterpriseId) return `E:${enterpriseId}`;
  if (teamId) return `T:${teamId}`;
  if (enterpriseId) return `E:${enterpriseId}`;
  throw new Error('Could not derive an installation key from the Slack install query');
}

/** @type {import('@slack/bolt').InstallationStore} */
export const installationStore = {
  storeInstallation: async (installation) => {
    const k = keyFrom(installation);
    await db.execute({
      sql: `INSERT INTO installations (install_key, data, updated_at) VALUES (?, ?, ?)
            ON CONFLICT(install_key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
      args: [k, encrypt(JSON.stringify(installation)), Date.now()],
    });
  },

  fetchInstallation: async (query) => {
    const k = keyFrom(query);
    const row = (await db.execute({ sql: 'SELECT data FROM installations WHERE install_key = ?', args: [k] })).rows[0];
    if (!row) throw new Error(`No Slack installation found for ${k}`);
    return JSON.parse(decrypt(/** @type {string} */ (row.data)));
  },

  deleteInstallation: async (query) => {
    const k = keyFrom(query);
    await db.execute({ sql: 'DELETE FROM installations WHERE install_key = ?', args: [k] });
    const teamId = query.team?.id ?? query.teamId;
    if (teamId) await deleteTeamData(teamId); // purge the team's Loop data on uninstall
  },
};
