import { Check, Crown, Zap } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

const PRO_FEATURES = [
  'Unlimited project drafts',
  'Priority AI generation queue',
  'Export to PDF, PNG and future CAD formats',
  'Shared team workspace',
]

const FREE_FEATURES = [
  'Up to 3 saved projects',
  '2D plan preview and 3D walkthrough',
  'Groq assistant (bring your API key)',
  'Community support',
]

export function PlanCard() {
  return (
    <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-ink-text">Your plan</h3>
        <Badge tone="violet">Pro</Badge>
      </div>
      <p className="mt-1.5 text-[13px] text-muted">
        For builders, architects and repeat clients who produce several houses a month.
      </p>

      <div className="mt-5 flex items-end gap-1.5">
        <span className="text-[30px] font-bold leading-none text-ink-text">₦120,000</span>
        <span className="mb-1 text-[13px] text-muted">/ month</span>
      </div>

      <ul className="mt-5 space-y-2.5">
        {PRO_FEATURES.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5 text-[13px] text-ink-text">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            {feature}
          </li>
        ))}
      </ul>

      <Button variant="primary" size="md" fullWidth className="mt-6" icon={<Crown className="h-4 w-4" />}>
        Upgrade to Pro
      </Button>
      <p className="mt-3 text-[11px] leading-relaxed text-faint">
        Billing and subscriptions are a future integration point. No payment is processed and no
        plan is charged in this prototype.
      </p>

      <div className="mt-6 border-t border-line-soft pt-5">
        <div className="flex items-center gap-2 text-[12px] font-semibold text-muted">
          <Zap className="h-3.5 w-3.5" /> Free tier
        </div>
        <ul className="mt-3 space-y-2">
          {FREE_FEATURES.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5 text-[12.5px] text-ink-text">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint" />
              {feature}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
