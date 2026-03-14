import { render, screen } from '@testing-library/react'
import { Badge } from './badge'

describe('Badge', () => {
  it('renders a span by default', () => {
    render(<Badge>Hello</Badge>)
    const badge = screen.getByText('Hello')
    expect(badge.tagName).toBe('SPAN')
    expect(badge).toHaveAttribute('data-slot', 'badge')
  })

  it('renders children element when asChild=true', () => {
    render(<Badge asChild><a href="#">link</a></Badge>)
    const el = screen.getByText('link')
    expect(el.tagName).toBe('A')
    expect(el).toHaveAttribute('data-slot', 'badge')
  })

  it('forwards custom className', () => {
    render(<Badge className="custom-class">x</Badge>)
    expect(screen.getByText('x')).toHaveClass('custom-class')
  })

  it.each(['default', 'secondary', 'destructive', 'outline', 'ghost', 'link'] as const)(
    'renders variant=%s with data-variant',
    (variant) => {
      render(<Badge variant={variant}>v</Badge>)
      expect(screen.getByText('v')).toHaveAttribute('data-variant', variant)
    }
  )

  it('defaults to variant=default', () => {
    render(<Badge>x</Badge>)
    expect(screen.getByText('x')).toHaveAttribute('data-variant', 'default')
  })
})
