import { fireEvent, render, screen } from '@testing-library/react'
import { Button } from './button'

describe('Button', () => {
  it('renders a button element by default', () => {
    render(<Button>Click me</Button>)
    const btn = screen.getByRole('button', { name: 'Click me' })
    expect(btn.tagName).toBe('BUTTON')
    expect(btn).toHaveAttribute('data-slot', 'button')
  })

  it('renders children element when asChild=true', () => {
    render(<Button asChild><a href="#">link</a></Button>)
    const el = screen.getByText('link')
    expect(el.tagName).toBe('A')
    expect(el).toHaveAttribute('data-slot', 'button')
  })

  it('forwards disabled prop', () => {
    render(<Button disabled>Disabled</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('calls onClick handler', () => {
    const handler = vi.fn()
    render(<Button onClick={handler}>Click</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('forwards custom className', () => {
    render(<Button className="my-class">x</Button>)
    expect(screen.getByRole('button')).toHaveClass('my-class')
  })

  it.each(['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'] as const)(
    'renders variant=%s with data-variant',
    (variant) => {
      render(<Button variant={variant}>v</Button>)
      expect(screen.getByRole('button')).toHaveAttribute('data-variant', variant)
    }
  )

  it.each(['default', 'xs', 'sm', 'lg', 'icon', 'icon-xs', 'icon-sm', 'icon-lg'] as const)(
    'renders size=%s with data-size',
    (size) => {
      render(<Button size={size}>s</Button>)
      expect(screen.getByRole('button')).toHaveAttribute('data-size', size)
    }
  )

  it('defaults to variant=default and size=default', () => {
    render(<Button>x</Button>)
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('data-variant', 'default')
    expect(btn).toHaveAttribute('data-size', 'default')
  })
})
