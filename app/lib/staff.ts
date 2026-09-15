export function calcStaffLevel(a: number | null | undefined, b: number | null | undefined): number {
  const v1 = Number(a ?? 0);
  const v2 = Number(b ?? 0);
  const n1 = Number.isFinite(v1) ? v1 : 0;
  const n2 = Number.isFinite(v2) ? v2 : 0;
  return Math.round((n1 + n2) / 2);
}
