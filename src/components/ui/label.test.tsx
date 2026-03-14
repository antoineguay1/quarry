import { render, screen } from '@testing-library/react'
import { Label } from './label'

describe('Label', () => {
  it('renders a label element with data-slot', () => {
    render(<Label>My label</Label>)
    const label = screen.getByText('My label')
    expect(label.tagName).toBe('LABEL')
    expect(label).toHaveAttribute('data-slot', 'label')
  })

  it('forwards htmlFor prop', () => {
    render(<Label htmlFor="my-input">Name</Label>)
    const label = screen.getByText('Name')
    expect(label).toHaveAttribute('for', 'my-input')
  })

  it('forwards custom className', () => {
    render(<Label className="custom-label">x</Label>)
    expect(screen.getByText('x')).toHaveClass('custom-label')
  })
})
