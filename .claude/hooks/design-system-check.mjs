#!/usr/bin/env node
/*
 * Hook Claude Code : contrôle du design system (déclaré dans .claude/settings.json)
 * ============================================================================
 *
 * - PostToolUse (Edit|Write) : dès qu'un fichier front-end est modifié
 *   (apps/**, libs/design-tokens/**, tools/design-system/**), lance
 *   tools/design-system/check.mjs. En cas de violation, le rapport est renvoyé
 *   à Claude (code de sortie 2) pour qu'il corrige aussitôt.
 *
 * - Stop : filet de sécurité en fin de tour, pour les fichiers modifiés hors des
 *   outils d'édition (ligne de commande, scripts). Si des fichiers front-end ont
 *   changé et que le contrôle échoue, Claude est relancé une seule fois.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';

const FRONTEND_PATHS = ['apps', 'libs/design-tokens', 'tools/design-system'];
const FRONTEND = new RegExp(`^(?:${FRONTEND_PATHS.join('|')})/`);
const GUIDANCE =
  'Corrige ces violations en suivant le skill frontend-ui (écrans : composants Empreinte, styles ' +
  'typographiques, classes .ds-*) ou design-system-evolution (couche de mise en page d’Apex ; Empreinte ' +
  "se change en amont, jamais par une surcharge locale). Ne contourne pas le contrôle et ne l'affaiblis pas.";

let input = {};
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  process.exit(0); // entrée illisible : ne jamais gêner le travail en cours
}

const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();

function runCheck() {
  const result = spawnSync(
    process.execPath,
    ['tools/design-system/check.mjs'],
    {
      cwd: projectDir,
      encoding: 'utf8',
    },
  );
  return {
    ok: result.status === 0,
    report: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim(),
  };
}

if (input.hook_event_name === 'PostToolUse') {
  const file = input.tool_input?.file_path;
  if (!file) process.exit(0);
  const path = relative(projectDir, resolve(projectDir, file))
    .split(sep)
    .join('/');
  if (!FRONTEND.test(path)) process.exit(0);

  const { ok, report } = runCheck();
  if (ok) process.exit(0);
  process.stderr.write(
    `Contrôle du design system après la modification de ${path} : des règles ne sont pas respectées.\n${GUIDANCE} ` +
      "Corrige d'abord ce qui relève de ton travail ; des violations dans des fichiers que tu n'as pas touchés " +
      "(écrans pas encore migrés vers Empreinte) se signalent à l'utilisateur.\n\n" +
      `${report}\n`,
  );
  process.exit(2);
}

if (input.hook_event_name === 'Stop') {
  // Claude a déjà été relancé une fois par ce hook : ne pas boucler
  if (input.stop_hook_active) process.exit(0);

  const status = spawnSync(
    'git',
    ['status', '--porcelain', '--', ...FRONTEND_PATHS],
    {
      cwd: projectDir,
      encoding: 'utf8',
    },
  );
  if (status.status !== 0 || !status.stdout.trim()) process.exit(0);

  const { ok, report } = runCheck();
  if (ok) process.exit(0);
  process.stdout.write(
    JSON.stringify({
      decision: 'block',
      reason:
        `Le contrôle du design system échoue sur les fichiers front-end modifiés. ${GUIDANCE} ` +
        "Si ces violations ne viennent pas de ton travail, ne les corrige pas sans accord : signale-les à l'utilisateur.\n\n" +
        report,
    }),
  );
  process.exit(0);
}

process.exit(0);
