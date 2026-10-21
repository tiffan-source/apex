/**
 * Pour les tests, à la place de l'assertion `!` : la valeur, ou un échec qui dit tout de suite ce qui
 * manque (« Introuvable : le bouton d'envoi »). Avec `!`, une valeur absente passerait, et le test
 * échouerait plus loin sur un message obscur (« Cannot read properties of null »).
 */
export function present<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`Introuvable : ${what}`);
  return value;
}
