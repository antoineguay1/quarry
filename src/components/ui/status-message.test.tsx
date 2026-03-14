import { fireEvent, render, screen } from '@testing-library/react'
import { ErrorMessage, SuccessMessage } from './status-message'

describe('ErrorMessage', () => {
  it('renders message text', () => {
    render(<ErrorMessage message="Something went wrong" />)
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('does not render dismiss button by default', () => {
    render(<ErrorMessage message="Error" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders dismiss button when onDismiss is provided', () => {
    const onDismiss = vi.fn()
    render(<ErrorMessage message="Error" onDismiss={onDismiss} />)
    const btn = screen.getByRole('button')
    expect(btn).toBeInTheDocument()
    fireEvent.click(btn)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('applies font-mono class when mono=true', () => {
    render(<ErrorMessage message="Error msg" mono />)
    const span = screen.getByText('Error msg')
    expect(span).toHaveClass('font-mono')
  })

  it('does not apply font-mono class when mono=false', () => {
    render(<ErrorMessage message="Error msg" />)
    const span = screen.getByText('Error msg')
    expect(span).not.toHaveClass('font-mono')
  })

  it('renders compact layout when compact=true', () => {
    const { container } = render(<ErrorMessage message="Compact error" compact />)
    // compact uses px-2 py-1 instead of px-3 py-2.5
    const div = container.firstChild as HTMLElement
    expect(div.className).toContain('px-2')
    expect(div.className).toContain('py-1')
  })

  it('renders dismiss button in compact layout', () => {
    const onDismiss = vi.fn()
    render(<ErrorMessage message="Compact" compact onDismiss={onDismiss} />)
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})

describe('SuccessMessage', () => {
  it('renders message text', () => {
    render(<SuccessMessage message="All good!" />)
    expect(screen.getByText('All good!')).toBeInTheDocument()
  })

  it('does not render dismiss button by default', () => {
    render(<SuccessMessage message="Success" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders dismiss button when onDismiss is provided', () => {
    const onDismiss = vi.fn()
    render(<SuccessMessage message="Done" onDismiss={onDismiss} />)
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
