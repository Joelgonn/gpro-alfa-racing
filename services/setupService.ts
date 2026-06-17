// services/setupService.ts

import { calculateSetup, SetupInput } from "@/domain/setup/calculateSetup"
import { compareResults } from "@/utils/compareResults"

export async function calculateSetupService(
  input: SetupInput,
  userId: string
) {
  // 🟢 Engine atual (Excel)
  const res = await fetch('/api/python?action=setup_calculate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'user-id': userId
    },
    body: JSON.stringify(input)
  })

  const excelResponse = await res.json()

  // 🔵 Nova engine (TypeScript)
  const tsResult = calculateSetup(input)

  // 🧠 Comparação
  const diff = compareResults(excelResponse?.data, tsResult)

  console.log("🧪 Setup Diff:", diff)

  // 🔍 LOG ESPECÍFICO PARA ASA DIANTEIRA Q1
  console.log("🔍 ASA DIANTEIRA Q1", {
    excel: excelResponse?.data?.asaDianteira?.q1,
    ts: tsResult?.asaDianteira?.q1
  })

  if (diff > 0) {
    console.log("🚨 Divergência detectada", {
      diff,
      excel: excelResponse?.data,
      ts: tsResult
    })
  } else {
    console.log("✅ Setup TS bate com Excel")
  }

  // 🔒 Continua usando Excel como fonte oficial
  return excelResponse
}