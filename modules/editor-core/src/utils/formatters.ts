export const formatPercent = (value: number, max = 100): string =>
  `${Math.round((value / max) * 100)}%`;

export const formatSigned = (value: number, center = 50): string => {
  const offset = value - center;
  if (offset === 0) return '0';
  return offset > 0 ? `+${offset}` : String(offset);
};

export const formatPitch = (value: number): string => {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(value / 12) - 1;
  const note = notes[value % 12] ?? 'C';
  return `${note}${octave}`;
};

export const formatKeyfollow = (value: number): string => {
  const names = [
    '-1', '-1/2', '-1/4', '0', '1/8', '1/4', '3/8', '1/2',
    '5/8', '3/4', '7/8', '1', '5/4', '3/2', '2', 's1', 's2',
  ];
  return names[value] ?? String(value);
};

export const formatPan = (value: number, center = 64): string => {
  if (value === center) return 'C';
  if (value < center) return `L${center - value}`;
  return `R${value - center}`;
};
