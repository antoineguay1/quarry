import { fireEvent, render, screen } from '@testing-library/react'
import { Textarea } from './textarea'

describe('Textarea', () => {
  it('renders a textarea element with data-slot', () => {
    render(<Textarea />)
    const el = screen.getByRole('textbox')
    expect(el.tagName).toBe('TEXTAREA')
    expect(el).toHaveAttribute('data-slot', 'textarea')
  })

  it('forwards placeholder prop', () => {
    render(<Textarea placeholder="Write something" />)
    expect(screen.getByPlaceholderText('Write something')).toBeInTheDocument()
  })

  it('forwards disabled prop', () => {
    render(<Textarea disabled />)
    expect(screen.getByRole('textbox')).toBeDisabled()
  })

  it('calls onChange handler', () => {
    const handler = vi.fn()
    render(<Textarea onChange={handler} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hello' } })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('forwards custom className', () => {
    render(<Textarea className="custom" />)
    expect(screen.getByRole('textbox')).toHaveClass('custom')
  })
})
