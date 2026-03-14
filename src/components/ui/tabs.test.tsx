import { fireEvent, render, screen } from '@testing-library/react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs'

describe('Tabs', () => {
  it('renders with default horizontal orientation', () => {
    const { container } = render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Content A</TabsContent>
      </Tabs>
    )
    const root = container.querySelector('[data-slot="tabs"]')
    expect(root).toHaveAttribute('data-orientation', 'horizontal')
  })

  it('renders with vertical orientation', () => {
    const { container } = render(
      <Tabs defaultValue="a" orientation="vertical">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Content A</TabsContent>
      </Tabs>
    )
    const root = container.querySelector('[data-slot="tabs"]')
    expect(root).toHaveAttribute('data-orientation', 'vertical')
  })
})

describe('TabsList', () => {
  it('renders with default variant', () => {
    const { container } = render(
      <Tabs defaultValue="a">
        <TabsList><TabsTrigger value="a">A</TabsTrigger></TabsList>
      </Tabs>
    )
    const list = container.querySelector('[data-slot="tabs-list"]')
    expect(list).toHaveAttribute('data-variant', 'default')
  })

  it('renders with line variant', () => {
    const { container } = render(
      <Tabs defaultValue="a">
        <TabsList variant="line"><TabsTrigger value="a">A</TabsTrigger></TabsList>
      </Tabs>
    )
    const list = container.querySelector('[data-slot="tabs-list"]')
    expect(list).toHaveAttribute('data-variant', 'line')
  })

  it('forwards custom className', () => {
    const { container } = render(
      <Tabs defaultValue="a">
        <TabsList className="my-list"><TabsTrigger value="a">A</TabsTrigger></TabsList>
      </Tabs>
    )
    expect(container.querySelector('[data-slot="tabs-list"]')).toHaveClass('my-list')
  })
})

describe('TabsTrigger', () => {
  it('renders with data-slot', () => {
    const { container } = render(
      <Tabs defaultValue="a">
        <TabsList><TabsTrigger value="a">Tab A</TabsTrigger></TabsList>
      </Tabs>
    )
    expect(container.querySelector('[data-slot="tabs-trigger"]')).toBeInTheDocument()
  })
})

describe('TabsContent', () => {
  it('renders with data-slot', () => {
    const { container } = render(
      <Tabs defaultValue="a">
        <TabsList><TabsTrigger value="a">A</TabsTrigger></TabsList>
        <TabsContent value="a">Content A</TabsContent>
      </Tabs>
    )
    expect(container.querySelector('[data-slot="tabs-content"]')).toBeInTheDocument()
  })
})

describe('Tabs integration', () => {
  it('calls onValueChange when a trigger is clicked', () => {
    const onChange = vi.fn()
    render(
      <Tabs value="a" onValueChange={onChange}>
        <TabsList>
          <TabsTrigger value="a">Tab A</TabsTrigger>
          <TabsTrigger value="b">Tab B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Panel A</TabsContent>
        <TabsContent value="b">Panel B</TabsContent>
      </Tabs>
    )
    // Radix Tabs activates on mouseDown, not click
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Tab B' }))
    expect(onChange).toHaveBeenCalledWith('b')
  })
})
