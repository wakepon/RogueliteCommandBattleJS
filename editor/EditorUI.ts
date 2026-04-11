import { TUNING_SCHEMA, TUNING_CATEGORIES, TuningFieldMeta } from '../src/Lib/Tuning/TuningSchema'

type OnChangeCallback = (key: string, value: unknown) => void

/** エディタUI自動生成 */
export class EditorUI {
  private sidebar: HTMLElement
  private content: HTMLElement
  private activeCategory: string
  private onChange: OnChangeCallback
  private currentState: Record<string, unknown>
  private savedState: Record<string, unknown>
  private fieldElements: Map<string, HTMLElement> = new Map()

  constructor(
    sidebar: HTMLElement,
    content: HTMLElement,
    onChange: OnChangeCallback,
    currentState: Record<string, unknown>,
    savedState: Record<string, unknown>,
  ) {
    this.sidebar = sidebar
    this.content = content
    this.onChange = onChange
    this.currentState = currentState
    this.savedState = savedState

    // 最初のカテゴリを選択
    const categories = this.getCategories()
    this.activeCategory = categories[0] || 'character'

    this.renderSidebar()
    this.renderContent()
  }

  /** カテゴリ一覧を取得 */
  private getCategories(): string[] {
    const seen = new Set<string>()
    for (const field of TUNING_SCHEMA) {
      seen.add(field.category)
    }
    return Array.from(seen)
  }

  /** サイドバーを描画 */
  private renderSidebar(): void {
    this.sidebar.innerHTML = ''

    const title = document.createElement('h2')
    title.textContent = 'Categories'
    this.sidebar.appendChild(title)

    for (const cat of this.getCategories()) {
      const btn = document.createElement('button')
      btn.className = `sidebar-item${cat === this.activeCategory ? ' active' : ''}`
      btn.textContent = TUNING_CATEGORIES[cat] || cat
      btn.addEventListener('click', () => {
        this.activeCategory = cat
        this.renderSidebar()
        this.renderContent()
      })
      this.sidebar.appendChild(btn)
    }
  }

  /** メインコンテンツを描画 */
  private renderContent(): void {
    this.content.innerHTML = ''
    this.fieldElements.clear()

    const fields = TUNING_SCHEMA.filter(f => f.category === this.activeCategory)

    const group = document.createElement('div')
    group.className = 'field-group'

    const heading = document.createElement('h3')
    heading.textContent = TUNING_CATEGORIES[this.activeCategory] || this.activeCategory
    group.appendChild(heading)

    for (const field of fields) {
      const row = this.createFieldRow(field)
      this.fieldElements.set(field.key, row)
      group.appendChild(row)
    }

    this.content.appendChild(group)
  }

  /** フィールド1行分のUIを生成 */
  private createFieldRow(field: TuningFieldMeta): HTMLElement {
    const currentValue = this.currentState[field.key] ?? field.defaultValue
    const isModified = currentValue !== this.savedState[field.key]

    const row = document.createElement('div')
    row.className = `field-row${isModified ? ' field-modified' : ''}`

    // ラベル
    const label = document.createElement('div')
    label.className = 'field-label'
    label.textContent = field.label
    row.appendChild(label)

    // コントロール
    const control = document.createElement('div')
    control.className = 'field-control'

    switch (field.control.type) {
      case 'slider':
        this.renderSlider(control, field, currentValue as number)
        break
      case 'number':
        this.renderNumber(control, field, currentValue as number)
        break
      case 'toggle':
        this.renderToggle(control, field, currentValue as boolean)
        break
    }

    row.appendChild(control)
    return row
  }

  /** スライダーコントロール */
  private renderSlider(container: HTMLElement, field: TuningFieldMeta, value: number): void {
    const ctrl = field.control as { type: 'slider'; min: number; max: number; step: number }

    const range = document.createElement('input')
    range.type = 'range'
    range.min = String(ctrl.min)
    range.max = String(ctrl.max)
    range.step = String(ctrl.step)
    range.value = String(value)

    const valueDisplay = document.createElement('span')
    valueDisplay.className = 'field-value'
    valueDisplay.textContent = String(value)

    const defaultDisplay = document.createElement('span')
    defaultDisplay.className = 'field-default'
    defaultDisplay.textContent = `(default: ${field.defaultValue})`

    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    range.addEventListener('input', () => {
      const v = parseFloat(range.value)
      valueDisplay.textContent = String(v)
      this.currentState[field.key] = v

      // デバウンス: 50ms
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        this.onChange(field.key, v)
        this.updateModifiedState(field.key)
      }, 50)
    })

    container.appendChild(range)
    container.appendChild(valueDisplay)
    container.appendChild(defaultDisplay)
  }

  /** 数値入力コントロール */
  private renderNumber(container: HTMLElement, field: TuningFieldMeta, value: number): void {
    const ctrl = field.control as { type: 'number'; min: number; max: number; step: number }

    const input = document.createElement('input')
    input.type = 'number'
    input.min = String(ctrl.min)
    input.max = String(ctrl.max)
    input.step = String(ctrl.step)
    input.value = String(value)

    const defaultDisplay = document.createElement('span')
    defaultDisplay.className = 'field-default'
    defaultDisplay.textContent = `(default: ${field.defaultValue})`

    input.addEventListener('change', () => {
      let v = parseFloat(input.value)
      if (isNaN(v)) v = field.defaultValue as number
      v = Math.min(Math.max(v, ctrl.min), ctrl.max)
      input.value = String(v)
      this.currentState[field.key] = v
      this.onChange(field.key, v)
      this.updateModifiedState(field.key)
    })

    container.appendChild(input)
    container.appendChild(defaultDisplay)
  }

  /** トグルコントロール */
  private renderToggle(container: HTMLElement, field: TuningFieldMeta, value: boolean): void {
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = value

    checkbox.addEventListener('change', () => {
      this.currentState[field.key] = checkbox.checked
      this.onChange(field.key, checkbox.checked)
      this.updateModifiedState(field.key)
    })

    container.appendChild(checkbox)
  }

  /** 変更状態を更新 */
  private updateModifiedState(key: string): void {
    const row = this.fieldElements.get(key)
    if (!row) return
    const isModified = this.currentState[key] !== this.savedState[key]
    row.classList.toggle('field-modified', isModified)
  }

  /** 外部から状態を更新して再描画 */
  updateState(state: Record<string, unknown>, saved: Record<string, unknown>): void {
    this.currentState = state
    this.savedState = saved
    this.renderContent()
  }
}
