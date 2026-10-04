import { useState } from 'react'
import { FileKey, ListChecks, PackageCheck, ShieldCheck, Upload, UserCheck } from 'lucide-react'
import { Button, CodeBlock, DemoTag, Modal, Segmented } from '@/components/ui'
import { cn } from '@/lib/cn'
import { toast } from '@/stores/toast'

const STEPS = [
  { icon: FileKey, title: 'Signature', text: 'The package signature (Ed25519) is verified against the ORVEX Systems release key or your organisation’s publisher key.' },
  { icon: ListChecks, title: 'Manifest & Core range', text: 'The declared Core range must include the running version. Incompatible packages are refused.' },
  { icon: UserCheck, title: 'Permission review', text: 'You approve every capability the extension requests — supplier network access, credentials, storage, routing.' },
  { icon: PackageCheck, title: 'Activation', text: 'The extension is loaded by Core workers. It is stored outside Core, so updates never overwrite it.' },
]

export function InstallExtensionModal({ open, onClose, coreVersion }: { open: boolean; onClose: () => void; coreVersion?: string }) {
  const [source, setSource] = useState<'upload' | 'cli'>('upload')
  const [dragging, setDragging] = useState(false)

  const demo = () => {
    toast.info('Prototype only', 'Installing extension packages is simulated — no file is uploaded or executed.')
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon={<ShieldCheck />}
      title={
        <span className="flex items-center gap-2">
          Install extension <DemoTag />
        </span>
      }
      description="Extensions are signed packages (.orx). ORVEX Core verifies them locally before anything runs."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" leading={<Upload />} onClick={demo}>
            Choose package…
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <ol className="grid gap-3 sm:grid-cols-2">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3 rounded-xl border border-line bg-surface-2/50 p-3.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-surface text-fg-2">
                <s.icon className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-fg">
                  <span className="mr-1.5 font-mono text-[11px] text-fg-3">0{i + 1}</span>
                  {s.title}
                </p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-fg-3">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <div>
          <Segmented
            value={source}
            onChange={setSource}
            items={[
              { value: 'upload', label: 'Upload package' },
              { value: 'cli', label: 'Server CLI' },
            ]}
          />
          {source === 'upload' ? (
            <button
              type="button"
              onClick={demo}
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                demo()
              }}
              className={cn(
                'mt-3 flex w-full flex-col items-center justify-center rounded-xl border border-dashed px-6 py-8 text-center transition-colors',
                dragging ? 'border-accent bg-accent/[0.06]' : 'border-line-strong bg-bg-subtle/60 hover:border-accent/50 hover:bg-surface-2',
              )}
            >
              <span className="grid size-10 place-items-center rounded-xl border border-line bg-surface text-fg-2 shadow-card">
                <Upload className="size-4.5" />
              </span>
              <span className="mt-3 text-[13.5px] font-medium text-fg">Drop a signed .orx package</span>
              <span className="mt-0.5 text-[12px] text-fg-3">or click to browse · max 50 MB · must declare a Core range including {coreVersion ?? 'the running version'}</span>
            </button>
          ) : (
            <CodeBlock
              className="mt-3"
              lang="bash"
              title="on your server"
              code={`# Verify and install a package (runs inside the core-api container)\ndocker compose exec core-api orvex ext install ./unlockdesk-vip-routing-1.0.0.orx\n\n# Review requested permissions before enabling\ndocker compose exec core-api orvex ext permissions rule.unlockdesk.vip-routing`}
            />
          )}
        </div>
        <p className="text-[12px] text-fg-3">Unsigned or tampered packages are rejected. Custom adapters and rules built by ORVEX Systems professional services — like the DSN Batch Adapter — are signed with your organisation’s publisher key.</p>
      </div>
    </Modal>
  )
}
