import { fireEvent, render, screen } from '@testing-library/react'
import { Input } from './input'

describe('Input', () => {
  it('renders an input element with data-slot', () => {
    render(<Input />)
    const input = screen.getByRole('textbox')
    expect(input.tagName).toBe('INPUT')
    expect(input).toHaveAttribute('data-slot', 'input')
  })

  it('forwards type prop', () => {
    render(<Input type="email" />)
    expect(screen.getByRole('textbox')).toHaveAttribute('type', 'email')
  })

  it('forwards placeholder prop', () => {
    render(<Input placeholder="Enter value" />)
    expect(screen.getByPlaceholderText('Enter value')).toBeInTheDocument()
  })

  it('forwards disabled prop', () => {
    render(<Input disabled />)
    expect(screen.getByRole('textbox')).toBeDisabled()
  })

  it('forwards aria-invalid attribute', () => {
    render(<Input aria-invalid="true" />)
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')
  })

  it('calls onChange handler', () => {
    const handler = vi.fn()
    render(<Input onChange={handler} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hello' } })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('forwards custom className', () => {
    render(<Input className="custom" />)
    expect(screen.getByRole('textbox')).toHaveClass('custom')
  })
})
