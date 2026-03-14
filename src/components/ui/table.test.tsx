import { render } from '@testing-library/react'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from './table'

describe('Table', () => {
  it('renders table-container div and table element', () => {
    const { container } = render(<Table />)
    expect(container.querySelector('[data-slot="table-container"]')).toBeInTheDocument()
    expect(container.querySelector('[data-slot="table"]')).toBeInTheDocument()
    expect(container.querySelector('[data-slot="table"]')?.tagName).toBe('TABLE')
  })

  it('forwards className to the table element', () => {
    const { container } = render(<Table className="custom-table" />)
    expect(container.querySelector('[data-slot="table"]')).toHaveClass('custom-table')
  })
})

describe('TableHeader', () => {
  it('renders thead with data-slot', () => {
    const { container } = render(
      <table><TableHeader /></table>
    )
    const el = container.querySelector('[data-slot="table-header"]')
    expect(el?.tagName).toBe('THEAD')
  })

  it('forwards className', () => {
    const { container } = render(
      <table><TableHeader className="my-header" /></table>
    )
    expect(container.querySelector('[data-slot="table-header"]')).toHaveClass('my-header')
  })
})

describe('TableBody', () => {
  it('renders tbody with data-slot', () => {
    const { container } = render(
      <table><TableBody /></table>
    )
    const el = container.querySelector('[data-slot="table-body"]')
    expect(el?.tagName).toBe('TBODY')
  })

  it('forwards className', () => {
    const { container } = render(
      <table><TableBody className="my-body" /></table>
    )
    expect(container.querySelector('[data-slot="table-body"]')).toHaveClass('my-body')
  })
})

describe('TableFooter', () => {
  it('renders tfoot with data-slot', () => {
    const { container } = render(
      <table><TableFooter /></table>
    )
    const el = container.querySelector('[data-slot="table-footer"]')
    expect(el?.tagName).toBe('TFOOT')
  })

  it('forwards className', () => {
    const { container } = render(
      <table><TableFooter className="my-footer" /></table>
    )
    expect(container.querySelector('[data-slot="table-footer"]')).toHaveClass('my-footer')
  })
})

describe('TableRow', () => {
  it('renders tr with data-slot', () => {
    const { container } = render(
      <table><tbody><TableRow /></tbody></table>
    )
    const el = container.querySelector('[data-slot="table-row"]')
    expect(el?.tagName).toBe('TR')
  })

  it('forwards className', () => {
    const { container } = render(
      <table><tbody><TableRow className="my-row" /></tbody></table>
    )
    expect(container.querySelector('[data-slot="table-row"]')).toHaveClass('my-row')
  })
})

describe('TableHead', () => {
  it('renders th with data-slot', () => {
    const { container } = render(
      <table><thead><tr><TableHead>H</TableHead></tr></thead></table>
    )
    const el = container.querySelector('[data-slot="table-head"]')
    expect(el?.tagName).toBe('TH')
  })

  it('forwards className', () => {
    const { container } = render(
      <table><thead><tr><TableHead className="my-head">H</TableHead></tr></thead></table>
    )
    expect(container.querySelector('[data-slot="table-head"]')).toHaveClass('my-head')
  })
})

describe('TableCell', () => {
  it('renders td with data-slot', () => {
    const { container } = render(
      <table><tbody><tr><TableCell>Cell</TableCell></tr></tbody></table>
    )
    const el = container.querySelector('[data-slot="table-cell"]')
    expect(el?.tagName).toBe('TD')
  })

  it('forwards className', () => {
    const { container } = render(
      <table><tbody><tr><TableCell className="my-cell">C</TableCell></tr></tbody></table>
    )
    expect(container.querySelector('[data-slot="table-cell"]')).toHaveClass('my-cell')
  })
})

describe('TableCaption', () => {
  it('renders caption with data-slot', () => {
    const { container } = render(
      <table><TableCaption>Caption text</TableCaption></table>
    )
    const el = container.querySelector('[data-slot="table-caption"]')
    expect(el?.tagName).toBe('CAPTION')
  })

  it('forwards className', () => {
    const { container } = render(
      <table><TableCaption className="my-caption">C</TableCaption></table>
    )
    expect(container.querySelector('[data-slot="table-caption"]')).toHaveClass('my-caption')
  })
})
