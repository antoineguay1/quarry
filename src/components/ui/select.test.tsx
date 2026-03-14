import { fireEvent, render, screen } from '@testing-library/react'

// jsdom doesn't implement scrollIntoView — Radix Select uses it on open
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from './select'

function renderSelect({
  onValueChange,
  defaultOpen = false,
  triggerSize,
  contentPosition,
}: {
  onValueChange?: (v: string) => void
  defaultOpen?: boolean
  triggerSize?: 'default' | 'sm'
  contentPosition?: 'item-aligned' | 'popper'
} = {}) {
  return render(
    <Select onValueChange={onValueChange} defaultOpen={defaultOpen}>
      <SelectTrigger size={triggerSize}>
        <SelectValue placeholder="Pick one" />
      </SelectTrigger>
      <SelectContent position={contentPosition}>
        <SelectGroup>
          <SelectLabel>Fruits</SelectLabel>
          <SelectItem value="apple">Apple</SelectItem>
          <SelectItem value="banana">Banana</SelectItem>
          <SelectSeparator />
          <SelectItem value="cherry">Cherry</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

describe('Select', () => {
  describe('SelectTrigger', () => {
    it('renders with data-slot and default size', () => {
      renderSelect()
      const trigger = screen.getByRole('combobox')
      expect(trigger).toHaveAttribute('data-slot', 'select-trigger')
      expect(trigger).toHaveAttribute('data-size', 'default')
    })

    it('renders with size=sm', () => {
      renderSelect({ triggerSize: 'sm' })
      expect(screen.getByRole('combobox')).toHaveAttribute('data-size', 'sm')
    })
  })

  describe('SelectContent', () => {
    it('renders items when open (item-aligned position)', () => {
      renderSelect({ defaultOpen: true })
      const items = document.body.querySelectorAll('[data-slot="select-item"]')
      expect(items.length).toBe(3)
    })

    it('renders with popper position', () => {
      renderSelect({ defaultOpen: true, contentPosition: 'popper' })
      const content = document.body.querySelector('[data-slot="select-content"]')
      expect(content).toBeInTheDocument()
      expect(content?.className).toContain('data-[side=bottom]:translate-y-1')
    })

    it('renders with item-aligned position (no popper classes)', () => {
      renderSelect({ defaultOpen: true, contentPosition: 'item-aligned' })
      const content = document.body.querySelector('[data-slot="select-content"]')
      expect(content?.className).not.toContain('data-[side=bottom]:translate-y-1')
    })
  })

  describe('SelectGroup and SelectLabel', () => {
    it('renders select-group and select-label data-slots', () => {
      renderSelect({ defaultOpen: true })
      expect(document.body.querySelector('[data-slot="select-group"]')).toBeInTheDocument()
      expect(document.body.querySelector('[data-slot="select-label"]')).toBeInTheDocument()
    })
  })

  describe('SelectSeparator', () => {
    it('renders with data-slot', () => {
      renderSelect({ defaultOpen: true })
      expect(document.body.querySelector('[data-slot="select-separator"]')).toBeInTheDocument()
    })
  })

  describe('SelectValue', () => {
    it('renders with data-slot', () => {
      renderSelect()
      expect(document.body.querySelector('[data-slot="select-value"]')).toBeInTheDocument()
    })
  })

  describe('integration: selecting an item', () => {
    it('calls onValueChange when an item is clicked', () => {
      const onChange = vi.fn()
      renderSelect({ defaultOpen: true, onValueChange: onChange })
      const items = document.body.querySelectorAll('[data-slot="select-item"]')
      const appleItem = Array.from(items).find(el => el.textContent?.includes('Apple')) as HTMLElement
      expect(appleItem).toBeTruthy()
      fireEvent.click(appleItem)
      expect(onChange).toHaveBeenCalledWith('apple')
    })
  })
})
