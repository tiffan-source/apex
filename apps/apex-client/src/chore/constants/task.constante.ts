const levelLabels = ['très faible', 'faible', 'moyenne', 'élevée', 'critique'];

export const ImportanceValueOption: { label: string, value: number }[] = levelLabels.map((level, index) => ({
  label: `Importance ${index + 1} – ${level}`,
  value: index + 1,
}));

export const UrgencyValueOption: { label: string, value: number }[] = levelLabels.map((level, index) => ({
  label: `Urgence ${index + 1} – ${level}`,
  value: index + 1,
}));
