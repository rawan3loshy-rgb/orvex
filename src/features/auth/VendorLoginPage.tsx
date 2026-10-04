import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { motion } from 'motion/react'
import { ArrowLeft, ArrowRight, ArrowUpRight, Eye, EyeOff, FlaskConical, KeyRound, LockKeyhole, Mail, ShieldCheck, Timer } from 'lucide-react'
import { Logo } from '@/components/brand'
import { Avatar, Button, Checkbox, Field, Input } from '@/components/ui'
import { useVendorMutation } from '@/hooks/vendor'
import { authService } from '@/services/vendor'
import { useSession } from '@/stores/session'
import { toast } from '@/stores/toast'
import { brand, demoInstallation } from '@/config/brand'
import { RoutingVisual } from './components/RoutingVisual'

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1]
const DEMO_PASSWORD = 'orvex-demo-2026'

const fade = (delay: number) => ({ initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.55, delay, ease } })

/**
 * Sign-in for the vendor account (account.orvex.io): the customer's
 * commercial relationship with ORVEX Systems. Not the installation admin.
 */
export default function VendorLoginPage() {
  const navigate = useNavigate()
  const existing = useSession((s) => s.vendor)
  const [email, setEmail] = useState('alex@unlockdesk-demo.com')
  const [password, setPassword] = useState(DEMO_PASSWORD)
  const [show, setShow] = useState(false)
  const [remember, setRemember] = useState(true)
  const [touched, setTouched] = useState(false)

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const passwordOk = password.length > 0

  const login = useVendorMutation(authService.login, {
    error: 'Sign-in failed',
    onSuccess: () => {
      useSession.getState().signInVendor(email.trim(), 'Alex Morgan')
      navigate('/account')
    },
  })

  const submit = () => {
    setTouched(true)
    if (!emailOk || !passwordOk) return
    login.mutate(email.trim())
  }

  return (
    <div className="grid min-h-dvh bg-bg lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      {/* Form column */}
      <div className="relative flex min-h-dvh flex-col px-5 pt-5 pb-20 sm:px-10 lg:px-14 lg:pb-8">
        <header className="flex items-center justify-between gap-4">
          <Link to="/" aria-label={`${brand.product} home`} className="rounded-lg">
            <Logo />
          </Link>
          <span className="text-[12.5px] text-fg-3">
            New to {brand.product}?{' '}
            <Link to="/" className="font-medium text-fg hover:underline">
              See plans
            </Link>
          </span>
        </header>

        <main className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[380px]">
            <motion.div {...fade(0)}>
              <p className="mono-label">{brand.accountDomain}</p>
              <h1 className="mt-2 font-display text-[30px] leading-[1.1] font-semibold tracking-[-0.03em] text-fg">Sign in to your {brand.product} account</h1>
              <p className="mt-2 text-[14px] text-fg-2">Subscription, license, invoices, releases and support for your self-hosted installation — in one place.</p>
            </motion.div>

            <motion.div {...fade(0.06)} className="mt-6 flex items-start gap-2.5 rounded-xl border border-dashed border-line-strong bg-surface-2/50 px-3.5 py-3">
              <FlaskConical className="mt-0.5 size-4 shrink-0 text-accent-ink" />
              <p className="text-[12.5px] leading-relaxed text-fg-2">
                <span className="font-medium text-fg">Demo environment</span> — any credentials work. Nothing you enter leaves your browser.
              </p>
            </motion.div>

            {existing && (
              <motion.button
                {...fade(0.1)}
                type="button"
                onClick={() => navigate('/account')}
                className="group mt-4 flex w-full items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-3 text-left shadow-card transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-pop"
              >
                <Avatar name={existing.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-fg">Continue as {existing.name}</span>
                  <span className="block truncate text-[12px] text-fg-3">{existing.email}</span>
                </span>
                <ArrowRight className="size-4 text-fg-3 transition-transform group-hover:translate-x-0.5" />
              </motion.button>
            )}

            <motion.form
              {...fade(0.12)}
              className="mt-6 space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                submit()
              }}
              noValidate
            >
              <Field label="Work email" htmlFor="email" error={touched && !emailOk ? 'Enter a valid email address' : undefined}>
                <Input id="email" type="email" autoComplete="username" inputSize="lg" leading={<Mail />} value={email} invalid={touched && !emailOk} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field
                label="Password"
                htmlFor="password"
                error={touched && !passwordOk ? 'Enter your password' : undefined}
                action={
                  <button type="button" onClick={() => toast.info('Demo: password reset', `We’d email a secure reset link to ${email || 'your address'}.`)} className="text-[12px] text-fg-3 hover:text-fg">
                    Forgot password?
                  </button>
                }
              >
                <Input
                  id="password"
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  inputSize="lg"
                  leading={<LockKeyhole />}
                  value={password}
                  invalid={touched && !passwordOk}
                  onChange={(e) => setPassword(e.target.value)}
                  trailing={
                    <button type="button" onClick={() => setShow(!show)} className="rounded p-0.5 text-fg-3 hover:text-fg" aria-label={show ? 'Hide password' : 'Show password'}>
                      {show ? <EyeOff /> : <Eye />}
                    </button>
                  }
                />
              </Field>
              <Checkbox checked={remember} onChange={setRemember} label="Keep me signed in for 30 days" />
              <Button type="submit" variant="accent" size="lg" className="w-full" loading={login.isPending} trailing={!login.isPending && <ArrowRight />}>
                {login.isPending ? 'Signing in…' : 'Sign in'}
              </Button>
            </motion.form>

            <motion.div {...fade(0.18)}>
              <div className="my-5 flex items-center gap-3 text-[11.5px] text-fg-3">
                <span className="h-px flex-1 bg-line" />
                or
                <span className="h-px flex-1 bg-line" />
              </div>
              <Button variant="secondary" size="lg" className="w-full" leading={<KeyRound />} onClick={() => toast.info('Demo: single sign-on', 'SAML / OIDC sign-in is available on Enterprise plans. Use the email form in this demo.')}>
                Continue with SSO
              </Button>

              <div className="mt-8 rounded-xl border border-line bg-surface-2/50 p-3.5">
                <p className="text-[12.5px] font-medium text-fg">Looking for your installation’s admin?</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-fg-3">
                  Your installation (e.g. {demoInstallation.adminTitle}) has its own users. Sign in on your own domain, e.g.{' '}
                  <span className="font-mono text-fg-2">
                    {demoInstallation.domain}
                    {demoInstallation.adminPath}
                  </span>
                  .
                </p>
                <Link to="/admin/login" className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-medium text-accent-ink hover:underline">
                  Go to installation sign-in <ArrowUpRight className="size-3.5" />
                </Link>
              </div>
            </motion.div>
          </div>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-3 text-[12px] text-fg-3 sm:justify-end sm:gap-5">
          <Link to="/" className="inline-flex items-center gap-1.5 hover:text-fg">
            <ArrowLeft className="size-3.5" /> Back to {brand.domain}
          </Link>
          <span>
            © 2026 {brand.company} · <button type="button" onClick={() => toast.info('Demo: privacy policy')} className="hover:text-fg">Privacy</button> ·{' '}
            <button type="button" onClick={() => toast.info('Demo: terms of service')} className="hover:text-fg">
              Terms
            </button>
          </span>
        </footer>
      </div>

      {/* Brand column */}
      <aside className="relative hidden overflow-hidden border-l border-line bg-bg-subtle lg:flex lg:flex-col">
        <div aria-hidden className="absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_at_45%_50%,#000_15%,transparent_72%)]" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-56 bg-hatch [mask-image:linear-gradient(0deg,#000,transparent)]" />
        <div aria-hidden className="absolute inset-y-0 left-10 w-px bg-line xl:left-14" />

        <div className="relative flex flex-1 flex-col justify-between gap-10 p-10 xl:p-14">
          <motion.div {...fade(0.2)}>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface py-1 pr-3 pl-1 text-[12px] text-fg-2 shadow-card">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-fg px-2 py-0.5 font-mono text-[11px] font-medium text-bg">
                <span className="size-1.5 rounded-full bg-accent" /> Core 2.5
              </span>
              Review-queue lookups · webhook message ids
            </span>
          </motion.div>

          <div className="flex flex-1 items-center">
            <RoutingVisual />
          </div>

          <motion.div {...fade(0.5)} className="max-w-[520px]">
            <p className="mono-label">{brand.descriptor}</p>
            <h2 className="mt-3 font-display text-[34px] leading-none font-semibold tracking-[-0.035em] text-fg font-wide xl:text-[40px]">
              Connect<span className="text-accent-ink">.</span> Route<span className="text-accent-ink">.</span> Fulfill<span className="text-accent-ink">.</span>
            </h2>
            <p className="mt-4 text-[14px] leading-relaxed text-fg-2">
              {brand.coreProduct} runs on your server with your own PostgreSQL — suppliers, catalog, pricing tiers, storefront, reseller portal, API and ledger. This account is where you manage the commercial side: license, billing, releases and support. It never sees your orders or balances.
            </p>
            <div className="mt-6 grid grid-cols-3 gap-3">
              {[
                { icon: <ShieldCheck />, t: 'Self-hosted', d: 'Your data stays yours' },
                { icon: <KeyRound />, t: 'Signed releases', d: 'Ed25519 verified' },
                { icon: <Timer />, t: 'Perpetual use', d: 'No shutdown on expiry' },
              ].map((x) => (
                <div key={x.t} className="rounded-xl border border-line bg-surface p-3">
                  <span className="text-fg-2 [&_svg]:size-4">{x.icon}</span>
                  <p className="mt-2 text-[12.5px] font-medium text-fg">{x.t}</p>
                  <p className="text-[11.5px] text-fg-3">{x.d}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </aside>
    </div>
  )
}
