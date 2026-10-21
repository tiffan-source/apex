/**
 * Le prénom à écrire en signature d'une réplique (nouvel objectif, Akari) : le premier mot du nom.
 * Après une inscription, le nom vaut souvent l'adresse e-mail : une adresse n'est pas un prénom, et elle
 * déborderait de la colonne du nom. Sans prénom, on écrit `fallback` (« Toi »).
 */
export function firstName(name: string | null | undefined, fallback: string): string {
  const first = (name ?? '').trim().split(/\s+/)[0] ?? '';
  return first && !first.includes('@') ? first : fallback;
}
