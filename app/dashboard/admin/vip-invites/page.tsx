'use client'

import { useEffect, useState } from 'react'

type Invite = {
  id: string
  code: string
  is_used: boolean
  used_by: string | null
  used_at: string | null
  created_by: string | null
  created_at: string
  expires_at: string | null
  revoked_at: string | null
  revoked_by: string | null
  invite_type: string | null
  status: 'disponivel' | 'utilizado' | 'expirado' | 'revogado'
}

type ValidityType = '7_days' | '30_days' | '90_days' | '365_days' | 'lifetime' | 'custom'

const statusStyles: Record<string, string> = {
  disponivel: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  utilizado: 'bg-slate-100 text-slate-600 border-slate-200',
  expirado: 'bg-amber-50 text-amber-700 border-amber-200',
  revogado: 'bg-rose-50 text-rose-700 border-rose-200',
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleString('pt-BR') } catch { return iso }
}

function maskCode(code: string) {
  // Exibir somente quando necessário: mostrar completo para admin, mas com botão copiar
  return code
}

export default function VipInvitesPage() {
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [validityType, setValidityType] = useState<ValidityType>('30_days')
  const [customDate, setCustomDate] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  async function fetchInvites() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/vip-invites', { method: 'GET', headers: { 'Content-Type': 'application/json' } })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao listar')
      setInvites(json.invites || [])
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar convites')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchInvites() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setMessage(null)
    setError(null)
    try {
      const body: any = { validityType }
      // FASE 1: envia durationDays explicitamente para 7/30/90/365
      if (validityType === '7_days') body.durationDays = 7
      else if (validityType === '90_days') body.durationDays = 90
      else if (validityType === '365_days') body.durationDays = 365
      else if (validityType === '30_days') body.durationDays = 30
      else if (validityType === 'lifetime') body.durationDays = null
      // custom mantém compatibilidade (durationDays não enviado, usa fallback legado)
      if (validityType === 'custom') {
        if (!customDate) throw new Error('Informe a data personalizada')
        body.customExpiresAt = new Date(customDate).toISOString()
      }
      const res = await fetch('/api/admin/vip-invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao criar')
      setMessage(`Convite criado: ${json.invite.code}`)
      setCustomDate('')
      await fetchInvites()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setCreating(false)
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm('Revogar este convite? O registro não será apagado, apenas marcado como revogado.')) return
    setError(null)
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/vip-invites/${id}/revoke`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao revogar')
      setMessage('Convite revogado com sucesso')
      await fetchInvites()
    } catch (e: any) {
      setError(e.message)
    }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code)
    setCopied(code)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-800">Convites VIP</h1>
        <p className="text-sm text-slate-500 mt-1">Gerencie convites com validade configurável. Acesso restrito a administradores.</p>
      </div>

      {/* Criar convite */}
      <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-xl p-4 md:p-5 shadow-sm space-y-4">
        <h2 className="font-semibold text-slate-700">Criar convite</h2>
        <div className="flex flex-col md:flex-row gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-600">Validade</span>
            <select
              value={validityType}
              onChange={e => setValidityType(e.target.value as ValidityType)}
              className="border border-slate-200 rounded-lg px-3 py-2 bg-white"
            >
              <option value="7_days">7 dias</option>
              <option value="30_days">30 dias</option>
              <option value="90_days">90 dias</option>
              <option value="365_days">365 dias</option>
              <option value="lifetime">Vitalício</option>
              <option value="custom">Data personalizada</option>
            </select>
          </label>

          {validityType === 'custom' && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-600">Data personalizada</span>
              <input
                type="datetime-local"
                value={customDate}
                onChange={e => setCustomDate(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2"
                required
              />
            </label>
          )}

          <div className="flex items-end">
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold disabled:opacity-50"
            >
              {creating ? 'Criando...' : 'Criar convite'}
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-400">O código é gerado no servidor com aleatoriedade criptográfica e não pode ser escolhido pelo cliente.</p>
      </form>

      {message && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2 rounded-lg text-sm">{message}</div>}
      {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-2 rounded-lg text-sm">{error}</div>}

      {/* Lista */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-700">Convites criados ({invites.length})</h2>
          <button onClick={fetchInvites} className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50">Atualizar</button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Carregando...</div>
        ) : invites.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-slate-500">Nenhum convite criado ainda.</p>
            <p className="text-xs text-slate-400 mt-1">Crie um convite de 30 dias, vitalício ou com data personalizada.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Código</th>
                  <th className="text-left px-4 py-2 font-medium">Tipo</th>
                  <th className="text-left px-4 py-2 font-medium">Status</th>
                  <th className="text-left px-4 py-2 font-medium">Criado em</th>
                  <th className="text-left px-4 py-2 font-medium">Expira em</th>
                  <th className="text-right px-4 py-2 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {invites.map(inv => (
                  <tr key={inv.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 font-mono text-xs">
                      <span className="inline-flex items-center gap-2">
                        {maskCode(inv.code)}
                        <button
                          onClick={() => copyCode(inv.code)}
                          className="text-[10px] px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 border border-slate-200"
                        >
                          {copied === inv.code ? 'Copiado' : 'Copiar'}
                        </button>
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-600">{inv.invite_type ?? '—'}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium border ${statusStyles[inv.status]}`}>{inv.status}</span>
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-600">{formatDate(inv.created_at)}</td>
                    <td className="px-4 py-2 text-xs text-slate-600">{inv.expires_at ? formatDate(inv.expires_at) : 'Vitalício'}</td>
                    <td className="px-4 py-2 text-right">
                      {inv.status === 'disponivel' && (
                        <button
                          onClick={() => handleRevoke(inv.id)}
                          className="text-xs px-3 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
                        >
                          Revogar
                        </button>
                      )}
                      {inv.status !== 'disponivel' && <span className="text-xs text-slate-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
