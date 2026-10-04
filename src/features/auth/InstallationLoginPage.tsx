import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, ArrowRight, Eye, EyeOff, Info, LockKeyhole, Mail, ShieldCheck, Smartphone, WandSparkles } from 'lucide-react'
import { LogoMark, TenantMark } from '@/components/brand'
import { Avatar, Button, Field, Input } from '@/components/ui'
import { useSession } from '@/stores/session'
import { toast } from '@/stores/toast'
import { brand, demoInstallation } from '@/config/brand'
import { cn } from '@/lib/cn'
import { OtpInput, type OtpInputHandle } from './components/OtpInput'

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1]
const DEMO_CODE = '482917'
const CORE_VERSION = '2.4.1'

type Step = 'credentials' | 'mfa'

/**
 * Sign-in screen of the CUSTOMER's own installation (portal.unlockdesk-demo.com/admin).
 * Separate user directory — the ORVEX vendor account is not used here.
 */
export default function InstallationLoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const existing = useSession((s) => s.installation)
  const rawFrom = (location.state as { from?: string } | null)?.from
  const from = rawFrom && rawFrom.startsWith('/admin') && !rawFrom.startsWith('/admin/login') ? rawFrom : '/admin'

  const [step, setStep] = useState<Step>('credentials')
  const [email, setEmail] = useState('alex@unlockdesk-demo.com')
  const [password, setPassword] = useState('unlockdesk-admin-demo')
  const [show, setShow] = useState(false)
  const [touched, setTouched] = useState(false)
  const [checking, setChecking] = useState(false)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [filling, setFilling] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const otp = useRef<OtpInputHandle>(null)
  const busy = useRef(false)

  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms))

  useEffect(() => {
    if (step === 'mfa') later(() => otp.current?.focus(0), 260)
  }, [step])

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  const submitCredentials = () => {
    setTouched(true)
    if (!emailOk || !password) return
    setChecking(true)
    later(() => {
      setChecking(false)
      setCode('')
      setCodeError(null)
      setStep('mfa')
    }, 650)
  }

  const verify = (value: string) => {
    if (busy.current) return
    if (value.length < 6) {
      setCodeError('Enter all 6 digits from your authenticator app.')
      return
    }
    busy.current = true
    setCodeError(null)
    setVerifying(true)
    later(() => {
      useSession.getState().signInInstallation(email.trim() || 'alex@unlockdesk-demo.com', 'Alex Morgan')
      toast.success(`Signed in to ${demoInstallation.adminTitle}`, 'Session secured with two-factor authentication.')
      navigate(from, { replace: true })
    }, 750)
  }

  const fillDemo = () => {
    if (filling || verifying) return
    setFilling(true)
    setCodeError(null)
    setCode('')
    DEMO_CODE.split('').forEach((_, i) => {
      later(() => {
        setCode(DEMO_CODE.slice(0, i + 1))
        if (i === DEMO_CODE.length - 1) {
          setFilling(false)
          later(() => verify(DEMO_CODE), 380)
        }
      }, 130 * (i + 1))
    })
  }

  return (
    <div className="relative flex min-h-dvh flex-col bg-bg">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-grid [mask-image:radial-gradient(60%_80%_at_50%_0%,#000_20%,transparent_75%)]" />

      <main className="relative flex flex-1 items-start justify-center px-5 pt-[9vh] pb-16 sm:items-center sm:pt-10">
        <div className="w-full max-w-[408px]">
          {/* Tenant identity */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }} className="flex flex-col items-center text-center">
            <TenantMark className="size-12 rounded-2xl text-[19px]" />
            <h1 className="mt-4 font-display text-[22px] font-semibold tracking-[-0.02em] text-fg">{demoInstallation.adminTitle}</h1>
            <p className="mt-1 text-[12.5px] text-fg-3">{demoInstallation.orgName} · operations console</p>
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 font-mono text-[11.5px] text-fg-2">
              <LockKeyhole className="size-3 text-success" />
              {demoInstallation.domain}
              {demoInstallation.adminPath}
            </span>
          </motion.div>

          {/* Card */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.08, ease }} className="mt-7 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
            <div className="flex items-center justify-between border-b border-line px-6 py-3">
              <span className="mono-label">Step {step === 'credentials' ? 1 : 2} of 2</span>
              <div className="flex gap-1">
                {(['credentials', 'mfa'] as Step[]).map((s, i) => (
                  <span key={s} className={cn('h-1 w-6 rounded-full transition-colors duration-300', i <= (step === 'mfa' ? 1 : 0) ? 'bg-fg' : 'bg-fg/12')} />
                ))}
              </div>
            </div>

            <div className="p-6 sm:p-7">
              {existing && step === 'credentials' && (
                <button
                  type="button"
                  onClick={() => navigate(from, { replace: true })}
                  className="group mb-5 flex w-full items-center gap-3 rounded-xl border border-line bg-surface-2/60 px-3 py-2.5 text-left transition-colors hover:border-line-strong"
                >
                  <Avatar name={existing.name} size="sm" color="var(--c3)" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-medium text-fg">Continue as {existing.name}</span>
                    <span className="block truncate text-[11.5px] text-fg-3">Already signed in on this device</span>
                  </span>
                  <ArrowRight className="size-4 text-fg-3 transition-transform group-hover:translate-x-0.5" />
                </button>
              )}

              <AnimatePresence mode="wait" initial={false}>
                {step === 'credentials' ? (
                  <motion.div key="credentials" initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }} transition={{ duration: 0.25, ease }}>
                    <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-fg">Sign in</h2>
                    <p className="mt-1 text-[13px] text-fg-3">Administrator access to this installation.</p>

                    <div className="mt-5 flex items-start gap-2.5 rounded-xl bg-surface-2 px-3.5 py-3 ring-1 ring-line ring-inset">
                      <Info className="mt-0.5 size-4 shrink-0 text-fg-3" />
                      <p className="text-[12.5px] leading-relaxed text-fg-2">This installation has its own user directory — your {brand.product} account is not used here.</p>
                    </div>

                    <form
                      className="mt-5 space-y-4"
                      noValidate
                      onSubmit={(e) => {
                        e.preventDefault()
                        submitCredentials()
                      }}
                    >
                      <Field label="Email" htmlFor="inst-email" error={touched && !emailOk ? 'Enter a valid email address' : undefined}>
                        <Input id="inst-email" type="email" autoComplete="username" leading={<Mail />} value={email} invalid={touched && !emailOk} onChange={(e) => setEmail(e.target.value)} inputSize="lg" />
                      </Field>
                      <Field
                        label="Password"
                        htmlFor="inst-password"
                        error={touched && !password ? 'Enter your password' : undefined}
                        action={
                          <button
                            type="button"
                            onClick={() => toast.info('Password reset', `Ask an Owner of ${demoInstallation.adminTitle} to reset it, or run “orvex users:reset-password” on the server.`)}
                            className="text-[12px] text-fg-3 hover:text-fg"
                          >
                            Forgot?
                          </button>
                        }
                      >
                        <Input
                          id="inst-password"
                          type={show ? 'text' : 'password'}
                          autoComplete="current-password"
                          leading={<LockKeyhole />}
                          value={password}
                          invalid={touched && !password}
                          onChange={(e) => setPassword(e.target.value)}
                          inputSize="lg"
                          trailing={
                            <button type="button" onClick={() => setShow(!show)} className="rounded p-0.5 text-fg-3 hover:text-fg" aria-label={show ? 'Hide password' : 'Show password'}>
                              {show ? <EyeOff /> : <Eye />}
                            </button>
                          }
                        />
                      </Field>
                      <Button type="submit" variant="primary" size="lg" className="w-full" loading={checking} trailing={!checking && <ArrowRight />}>
                        {checking ? 'Checking…' : 'Continue'}
                      </Button>
                      <p className="text-center text-[11.5px] text-fg-3">Demo: credentials are prefilled — any password works.</p>
                    </form>
                  </motion.div>
                ) : (
                  <motion.div key="mfa" initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 14 }} transition={{ duration: 0.25, ease }}>
                    <button type="button" onClick={() => !verifying && setStep('credentials')} className="mb-4 inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-surface-2/60 py-1 pr-2.5 pl-1.5 text-[12px] text-fg-2 transition-colors hover:text-fg">
                      <ArrowLeft className="size-3.5 shrink-0" />
                      <span className="truncate">{email}</span>
                    </button>
                    <div className="flex items-start gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-fg-2 ring-1 ring-line">
                        <Smartphone className="size-4.5" />
                      </span>
                      <div>
                        <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-fg">Two-factor authentication</h2>
                        <p className="mt-0.5 text-[13px] text-fg-3">Enter the 6-digit code from your authenticator app.</p>
                      </div>
                    </div>

                    <form
                      className="mt-6"
                      onSubmit={(e) => {
                        e.preventDefault()
                        verify(code)
                      }}
                    >
                      <OtpInput
                        ref={otp}
                        value={code}
                        onChange={(v) => {
                          setCode(v)
                          if (codeError) setCodeError(null)
                        }}
                        onComplete={(v) => later(() => verify(v), 250)}
                        invalid={!!codeError}
                        disabled={verifying || filling}
                      />
                      <div className="mt-2 min-h-5 text-[12px]">{codeError ? <p className="text-danger">{codeError}</p> : <p className="text-fg-3">Demo: any 6 digits work.</p>}</div>

                      <Button type="submit" variant="primary" size="lg" className="mt-3 w-full" loading={verifying} disabled={filling}>
                        {verifying ? 'Verifying…' : 'Verify and sign in'}
                      </Button>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <Button type="button" variant="ghost" size="sm" leading={<WandSparkles />} onClick={fillDemo} disabled={filling || verifying}>
                          Use demo code
                        </Button>
                        <button type="button" onClick={() => toast.info('Recovery codes', 'Enter one of the 10 recovery codes you saved when enabling two-factor authentication.')} className="text-[12px] text-fg-3 hover:text-fg">
                          Use a recovery code
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mt-5 flex items-center justify-center gap-1.5 text-[12px] text-fg-3">
            <ShieldCheck className="size-3.5" /> Sessions are bound to this device and expire after 12 hours of inactivity.
          </motion.p>
        </div>
      </main>

      <footer className="relative flex flex-col items-center gap-1 px-5 pb-16 text-center text-[11.5px] text-fg-3 sm:pb-6">
        <span className="inline-flex items-center gap-1.5">
          <LogoMark mono className="size-4 text-fg-3" />
          Powered by {brand.coreProduct} {CORE_VERSION}
        </span>
        <span>
          © 2026 {demoInstallation.orgName} · Operated by {demoInstallation.siteName} on its own infrastructure
        </span>
      </footer>
    </div>
  )
}
