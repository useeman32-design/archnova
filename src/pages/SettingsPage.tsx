import { useState } from 'react'
import { CreditCard, Crown, RefreshCw, Shield, Trash2, User } from 'lucide-react'
import { AppShell, PageHeader } from '@/components/layout/AppShell'
import { Card, CardHeader } from '@/components/ui/Card'
import { TextField, SelectField } from '@/components/ui/Field'
import { SegmentedControl, Toggle } from '@/components/ui/FormControls'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { storageKeys, removeKey } from '@/lib/storage'
import { useProjects } from '@/hooks/useProjects'
import { CURRENCIES } from '@/data/catalog'
import type { Units } from '@/types'

interface SettingsState {
  displayName: string
  email: string
  units: Units
  currency: string
  appearance: 'light' | 'dark' | 'system'
  emailUpdates: boolean
}

const DEFAULT_SETTINGS: SettingsState = {
  displayName: 'Adebayo Okonkwo',
  email: 'adebayo@pixelstudios.ng',
  units: 'ft',
  currency: 'NGN',
  appearance: 'light',
  emailUpdates: true,
}

export function SettingsPage() {
  const [settings, setSettings] = useLocalStorage<SettingsState>(storageKeys.settings, DEFAULT_SETTINGS)
  const { resetSamples, projects } = useProjects()
  const [resetDone, setResetDone] = useState(false)

  const patch = (next: Partial<SettingsState>) => setSettings((prev) => ({ ...prev, ...next }))

  return (
    <AppShell>
      <PageHeader
        title="Settings & account"
        subtitle="Profile, measurement preferences and prototype data controls."
      />

      <div className="mx-auto grid max-w-5xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-2 lg:px-8">
        <Card>
          <CardHeader
            icon={<User className="h-4 w-4" />}
            title="Profile"
            subtitle="How you appear across Pixel Studios."
          />
          <div className="mt-4 space-y-4">
            <TextField
              label="Display name"
              value={settings.displayName}
              onChange={(event) => patch({ displayName: event.target.value })}
            />
            <TextField
              label="Email"
              type="email"
              value={settings.email}
              onChange={(event) => patch({ email: event.target.value })}
              hint="Sign-in and billing attach to this address once authentication is connected."
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            icon={<CreditCard className="h-4 w-4" />}
            title="Units & currency"
            subtitle="Defaults for new projects and drawings."
          />
          <div className="mt-4 space-y-4">
            <div>
              <span className="mb-1.5 block text-[13px] font-medium text-ink-text">
                Measurement system
              </span>
              <SegmentedControl<Units>
                options={[
                  { value: 'ft', label: 'Feet / inches' },
                  { value: 'm', label: 'Metres' },
                ]}
                value={settings.units}
                onChange={(units) => patch({ units })}
              />
            </div>
            <SelectField
              label="Default currency"
              value={settings.currency}
              onChange={(event) => patch({ currency: event.target.value })}
            >
              {CURRENCIES.map((currency) => (
                <option key={currency.value} value={currency.value}>
                  {currency.label}
                </option>
              ))}
            </SelectField>
          </div>
        </Card>

        <Card>
          <CardHeader
            icon={<Shield className="h-4 w-4" />}
            title="Appearance & notifications"
            subtitle="Interface preferences for this device."
          />
          <div className="mt-4 space-y-4">
            <div>
              <span className="mb-1.5 block text-[13px] font-medium text-ink-text">Theme</span>
              <SegmentedControl<SettingsState['appearance']>
                options={[
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'Dark' },
                  { value: 'system', label: 'System' },
                ]}
                value={settings.appearance}
                onChange={(appearance) => patch({ appearance })}
              />
              <p className="mt-2 text-[12px] text-muted">
                The dark workspace theme ships with a later release; the sidebar is already dark.
              </p>
            </div>
            <Toggle
              checked={settings.emailUpdates}
              onChange={(emailUpdates) => patch({ emailUpdates })}
              label="Project update emails"
              description="A digest when a design is shared with you for review."
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            icon={<Crown className="h-4 w-4" />}
            title="Plan & billing"
            subtitle="Placeholder — payments are not part of this prototype."
            action={<Badge tone="brand">Free plan</Badge>}
          />
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-canvas-soft px-3.5 py-3">
              <span className="text-[13px] text-muted">Active plan</span>
              <span className="text-[13px] font-semibold text-ink-text">Free · 3 projects</span>
            </div>
            <Button variant="secondary" disabled fullWidth>
              Upgrade to Pro (coming soon)
            </Button>
            <p className="text-[11.5px] leading-relaxed text-faint">
              Billing, invoices and subscription management connect to the payment provider in the
              SaaS phase. No payment is processed here.
            </p>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            icon={<RefreshCw className="h-4 w-4" />}
            title="Prototype data"
            subtitle="Everything lives in this browser only."
          />
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              variant="secondary"
              icon={<RefreshCw className="h-4 w-4" />}
              onClick={() => {
                void resetSamples().then(() => {
                  setResetDone(true)
                  window.setTimeout(() => setResetDone(false), 2000)
                })
              }}
            >
              {resetDone ? 'Samples restored' : 'Reset sample projects'}
            </Button>
            <Button
              variant="danger"
              icon={<Trash2 className="h-4 w-4" />}
              onClick={() => {
                removeKey(storageKeys.projects)
                removeKey(storageKeys.questionnaire)
                window.location.href = '/'
              }}
            >
              Clear all local data
            </Button>
            <p className="text-[12px] text-muted">
              {projects.length} project{projects.length === 1 ? '' : 's'} stored locally. Clearing
              reloads the demo samples on next visit.
            </p>
          </div>
        </Card>
      </div>
    </AppShell>
  )
}
