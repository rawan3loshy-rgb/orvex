import { ArrowRight, Globe, LockKeyhole, Server } from 'lucide-react'
import { Badge, Button, Card, CodeBlock, MonoValue, Skeleton } from '@/components/ui'
import { useInstallation, useSite } from '@/hooks/installation'
import { relative } from '@/lib/format'
import { SettingRow, SettingsCard } from './form'

export function WebsiteTab() {
  const site = useSite()
  const installation = useInstallation()
  const domain = installation.data?.domain ?? site.data?.domain ?? 'portal.unlockdesk-demo.com'
  const pages = site.data?.pages ?? []
  const published = pages.filter((p) => p.status === 'published').length

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-dots opacity-60 [mask-image:linear-gradient(90deg,transparent,#000_70%)]" />
        <div className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-line bg-surface-2 text-fg-2">
              <Globe className="size-5" />
            </span>
            <div>
              <p className="text-[15px] font-semibold text-fg">{site.data?.theme.siteName ?? 'Public website'}</p>
              {site.data ? (
                <p className="mt-0.5 text-[12.5px] text-fg-3">
                  {published} of {pages.length} pages published · {site.data.sections.length} sections · last published {relative(site.data.publishedAt)}
                </p>
              ) : (
                <Skeleton className="mt-1.5 h-3.5 w-64" />
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" to="/site">
              View site
            </Button>
            <Button variant="primary" to="/admin/website" trailing={<ArrowRight />}>
              Open website builder
            </Button>
          </div>
        </div>
      </Card>

      <SettingsCard icon={<LockKeyhole />} title="Domain & TLS" description="Served by Caddy in front of ORVEX Core. Certificates are issued and renewed automatically." footer={<span>Domains are configured on the server (APP_URL and the Caddyfile) so DNS and certificates stay under your control.</span>}>
        <SettingRow label="Primary domain" description="Website, admin (/admin) and Reseller API (/api/v1) share this domain.">
          <div className="flex flex-wrap items-center gap-2">
            <MonoValue value={domain} className="text-[13px] text-fg" />
            <Badge tone="success" dot>
              DNS verified
            </Badge>
          </div>
        </SettingRow>
        <SettingRow label="TLS certificate" description="HTTPS is always on. HTTP requests are redirected.">
          <div className="space-y-1.5 text-[13px]">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="success" dot>
                Valid
              </Badge>
              <span className="text-fg">Automatic via Caddy</span>
              <span className="text-fg-3">· Let’s Encrypt (ACME)</span>
            </div>
            <p className="text-[12px] text-fg-3">Renews automatically about 30 days before expiry — no action needed.</p>
          </div>
        </SettingRow>
        <SettingRow label="Admin path" description="Where your team signs in.">
          <span className="font-mono text-[13px] text-fg-2">
            {domain}
            <span className="font-semibold text-fg">/admin</span>
          </span>
        </SettingRow>
      </SettingsCard>

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-[12.5px] text-fg-3">
          <Server className="size-3.5" /> Caddyfile on your server
        </p>
        <CodeBlock
          lang="text"
          title="/etc/orvex/Caddyfile"
          code={`${domain} {\n  # certificates are obtained and renewed automatically\n  encode zstd gzip\n  reverse_proxy core-api:3000\n}`}
        />
      </div>
    </div>
  )
}
