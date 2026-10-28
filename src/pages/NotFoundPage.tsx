import { Link } from 'react-router-dom'
import { Compass, Home } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
        <Compass className="h-7 w-7" />
      </span>
      <h1 className="mt-6 text-2xl font-bold text-ink-text">Page not found</h1>
      <p className="mt-2 text-[14px] text-muted">
        The page you were looking for isn't part of this prototype yet.
      </p>
      <div className="mt-6 flex gap-3">
        <Button variant="primary" icon={<Home className="h-4 w-4" />}>
          <Link to="/">Back to Home</Link>
        </Button>
      </div>
    </div>
  )
}
