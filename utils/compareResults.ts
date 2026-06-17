export function compareResults(a: any, b: any): number {
  if (!a || !b) return 999

  let diff = 0

  const keys = [
    "asaDianteira",
    "asaTraseira",
    "motor",
    "freios",
    "cambio",
    "suspensao"
  ]

  for (const part of keys) {
    const aPart = a?.[part]
    const bPart = b?.[part]

    if (!aPart || !bPart) {
      diff++
      continue
    }

    const fields = ["q1", "q2", "race"]

    for (const field of fields) {
      const valA = Number(aPart[field] || 0)
      const valB = Number(bPart[field] || 0)

      const delta = Math.abs(valA - valB)

      if (delta > 0.1) {
        diff++
      }
    }
  }

  return diff
}