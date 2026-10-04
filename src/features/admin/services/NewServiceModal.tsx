import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { PackagePlus } from 'lucide-react'
import { Badge, Button, Field, Input, Modal, Segmented, Select, Textarea } from '@/components/ui'
import { PermissionHint } from '@/components/domain'
import { useCategories, useInstMutation } from '@/hooks/installation'
import { catalogService } from '@/services/installation'
import { fieldType } from '@/core/fields'
import { GSM_FIELDS, GSM_RESULT_SCHEMAS } from '@/core/verticals/gsm'
import type { FieldDef, ProcessingMode } from '@/types/installation'
import { cn } from '@/lib/cn'
import { PROCESSING_HINT } from '../catalog/helpers'

const PRESETS = Object.entries(GSM_FIELDS) as [keyof typeof GSM_FIELDS, FieldDef][]

const PRESET_NOTE: Partial<Record<keyof typeof GSM_FIELDS, string>> = {
  imei: '15 digits + Luhn',
  serial: '8–14 A–Z / 0–9',
  brand: `${GSM_FIELDS.brand.options.length} brands`,
  model: 'required',
  modelOptional: 'optional',
  carrier: 'all carriers',
  carrierUS: 'US carriers',
  carrierUK: 'UK networks',
  country: 'ISO alpha-2',
}

const TURNAROUND = [
  { value: '0-60', label: 'Instant (under 1 min)' },
  { value: '60-300', label: '1–5 minutes' },
  { value: '300-1800', label: '5–30 minutes' },
  { value: '3600-43200', label: '1–12 hours' },
  { value: '3600-86400', label: '1–24 hours' },
  { value: '86400-345600', label: '1–4 days' },
]

const SCHEMA_LABEL: Record<string, string> = {
  carrier_check: 'Carrier check',
  blacklist: 'Blacklist',
  full_report: 'Full report',
  device_info: 'Device info',
  warranty: 'Warranty',
  activation_status: 'Activation status',
  compatibility: 'Compatibility',
  unlock_code: 'Unlock code',
  official_unlock: 'Official unlock',
  serial: 'Serial check',
}

export function NewServiceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const categories = useCategories()
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [processing, setProcessing] = useState<ProcessingMode>('instant')
  const [turn, setTurn] = useState('0-60')
  const [summary, setSummary] = useState('')
  const [picked, setPicked] = useState<(keyof typeof GSM_FIELDS)[]>(['imei'])
  const [schema, setSchema] = useState('carrier_check')

  const fields = useMemo(() => picked.map((k) => GSM_FIELDS[k] as FieldDef), [picked])
  const create = useInstMutation(catalogService.createService, {
    success: (s) => `${s.name} created as draft`,
    onSuccess: (s) => {
      onClose()
      navigate(`/admin/services/${s.id}?tab=fields`)
    },
  })

  const toggle = (k: keyof typeof GSM_FIELDS) => {
    setPicked((cur) => {
      if (cur.includes(k)) return cur.filter((x) => x !== k)
      // One field per key — picking "carrier (US)" replaces "carrier".
      const key = GSM_FIELDS[k].key
      return [...cur.filter((x) => GSM_FIELDS[x].key !== key), k]
    })
  }

  const cat = categoryId || categories.data?.[0]?.id || ''
  const [minSec, maxSec] = turn.split('-').map(Number) as [number, number]
  const valid = name.trim().length >= 3 && !!cat && fields.length > 0

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon={<PackagePlus />}
      title="New service"
      description="Created as a draft with revision 1. Map supplier offers and set a price before activating it."
      footer={
        <>
          <PermissionHint permission="catalog.manage" className="mr-auto" />
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="accent"
            disabled={!valid}
            loading={create.isPending}
            onClick={() => create.mutate({ name: name.trim(), categoryId: cat, processing, turnaround: { minSec, maxSec }, summary: summary.trim() || name.trim(), fields, resultSchema: GSM_RESULT_SCHEMAS[schema] ?? [] })}
          >
            Create draft
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="ns_name">
            <Input id="ns_name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. iPhone 17 Carrier Check" autoFocus />
          </Field>
          <Field label="Category">
            <Select value={cat} onChange={(e) => setCategoryId(e.target.value)} options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Processing" hint={PROCESSING_HINT[processing]}>
            <Segmented
              value={processing}
              onChange={setProcessing}
              items={[
                { value: 'instant', label: 'Instant' },
                { value: 'async', label: 'Async' },
                { value: 'manual', label: 'Manual' },
              ]}
            />
          </Field>
          <Field label="Turnaround shown to customers">
            <Select value={turn} onChange={(e) => setTurn(e.target.value)} options={TURNAROUND} />
          </Field>
        </div>
        <Field label="Summary" optional>
          <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="One sentence shown on the storefront and in the portal." className="min-h-16" />
        </Field>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-[12.5px] font-medium">Input fields</span>
            <span className="text-[11.5px] text-fg-3">GSM Services Pack field types</span>
          </div>
          <div className="grid gap-1.5 sm:grid-cols-3">
            {PRESETS.map(([k, f]) => {
              const on = picked.includes(k)
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => toggle(k)}
                  className={cn('flex flex-col items-start rounded-lg border px-3 py-2 text-left transition-colors', on ? 'border-accent/50 bg-accent/[0.05]' : 'border-line hover:border-line-strong hover:bg-surface-2/50')}
                >
                  <span className="flex w-full items-center justify-between gap-2 text-[12.5px] font-medium">
                    {f.label}
                    {on && <span className="font-mono text-[10.5px] text-accent-ink">#{picked.indexOf(k) + 1}</span>}
                  </span>
                  <span className="font-mono text-[10.5px] text-fg-3">
                    {fieldType(f.type).id} · {PRESET_NOTE[k]}
                  </span>
                </button>
              )
            })}
          </div>
          <p className="mt-1.5 text-[11.5px] text-fg-3">One field list powers the storefront form, the portal form, the API schema, server-side validation and the DHRU parameter mapping.</p>
        </div>

        <div>
          <div className="mb-1.5 text-[12.5px] font-medium">Result schema</div>
          <div className="flex flex-wrap gap-1.5">
            {Object.keys(GSM_RESULT_SCHEMAS).map((k) => (
              <button key={k} type="button" onClick={() => setSchema(k)} className={cn('h-7 rounded-md border px-2.5 text-[12px] font-medium transition-colors', schema === k ? 'border-accent/50 bg-accent/[0.06] text-fg' : 'border-line text-fg-3 hover:text-fg-2')}>
                {SCHEMA_LABEL[k] ?? k}
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5 rounded-lg border border-line bg-surface-2/40 p-2.5">
            {(GSM_RESULT_SCHEMAS[schema] ?? []).map((r) => (
              <Badge key={r.key} tone={r.primary ? 'accent' : 'neutral'} variant={r.primary ? 'soft' : 'outline'}>
                {r.label} <span className="font-mono text-[10px] opacity-70">{r.kind}</span>
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}
