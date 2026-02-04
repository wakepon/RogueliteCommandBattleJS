---
name: frontend-patterns
description: React、状態管理、パフォーマンス最適化、UI ベストプラクティスのためのフロントエンド開発パターン。
---

# フロントエンド開発パターン

React + Vite を使用したオフラインゲーム開発のためのモダンなフロントエンドパターン。

## コンポーネントパターン

### 継承よりコンポジション

```typescript
// ✅ 良い例: コンポーネントのコンポジション
interface CardProps {
  children: React.ReactNode
  variant?: 'default' | 'outlined'
}

export function Card({ children, variant = 'default' }: CardProps) {
  return <div className={`card card-${variant}`}>{children}</div>
}

export function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="card-header">{children}</div>
}

export function CardBody({ children }: { children: React.ReactNode }) {
  return <div className="card-body">{children}</div>
}

// 使用例
<Card>
  <CardHeader>Title</CardHeader>
  <CardBody>Content</CardBody>
</Card>
```

### Compound Components

```typescript
interface TabsContextValue {
  activeTab: string
  setActiveTab: (tab: string) => void
}

const TabsContext = createContext<TabsContextValue | undefined>(undefined)

export function Tabs({ children, defaultTab }: {
  children: React.ReactNode
  defaultTab: string
}) {
  const [activeTab, setActiveTab] = useState(defaultTab)

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </TabsContext.Provider>
  )
}

export function TabList({ children }: { children: React.ReactNode }) {
  return <div className="tab-list">{children}</div>
}

export function Tab({ id, children }: { id: string, children: React.ReactNode }) {
  const context = useContext(TabsContext)
  if (!context) throw new Error('Tab must be used within Tabs')

  return (
    <button
      className={context.activeTab === id ? 'active' : ''}
      onClick={() => context.setActiveTab(id)}
    >
      {children}
    </button>
  )
}

// 使用例
<Tabs defaultTab="overview">
  <TabList>
    <Tab id="overview">Overview</Tab>
    <Tab id="details">Details</Tab>
  </TabList>
</Tabs>
```

## カスタム Hooks パターン

### 状態管理 Hook

```typescript
export function useToggle(initialValue = false): [boolean, () => void] {
  const [value, setValue] = useState(initialValue)

  const toggle = useCallback(() => {
    setValue(v => !v)
  }, [])

  return [value, toggle]
}

// 使用例
const [isOpen, toggleOpen] = useToggle()
```

### ゲームループ Hook

```typescript
export function useGameLoop(
  callback: (deltaTime: number) => void,
  isRunning: boolean = true
) {
  const callbackRef = useRef(callback)
  const previousTimeRef = useRef<number>(0)
  const frameIdRef = useRef<number>(0)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    if (!isRunning) return

    const loop = (currentTime: number) => {
      const deltaTime = currentTime - previousTimeRef.current
      previousTimeRef.current = currentTime
      callbackRef.current(deltaTime)
      frameIdRef.current = requestAnimationFrame(loop)
    }

    frameIdRef.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(frameIdRef.current)
    }
  }, [isRunning])
}

// 使用例
useGameLoop((deltaTime) => {
  updateGameState(deltaTime)
  renderGame()
}, isGameRunning)
```

### キーボード入力 Hook

```typescript
export function useKeyboard() {
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set())

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      setPressedKeys(prev => new Set(prev).add(e.code))
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      setPressedKeys(prev => {
        const next = new Set(prev)
        next.delete(e.code)
        return next
      })
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  const isPressed = useCallback(
    (key: string) => pressedKeys.has(key),
    [pressedKeys]
  )

  return { pressedKeys, isPressed }
}

// 使用例
const { isPressed } = useKeyboard()
if (isPressed('ArrowLeft')) moveLeft()
if (isPressed('ArrowRight')) moveRight()
```

### タッチ入力 Hook

```typescript
interface TouchState {
  isTouching: boolean
  startPosition: { x: number; y: number } | null
  currentPosition: { x: number; y: number } | null
  delta: { x: number; y: number }
}

export function useTouch(elementRef: RefObject<HTMLElement>) {
  const [touchState, setTouchState] = useState<TouchState>({
    isTouching: false,
    startPosition: null,
    currentPosition: null,
    delta: { x: 0, y: 0 }
  })

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0]
      setTouchState({
        isTouching: true,
        startPosition: { x: touch.clientX, y: touch.clientY },
        currentPosition: { x: touch.clientX, y: touch.clientY },
        delta: { x: 0, y: 0 }
      })
    }

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0]
      setTouchState(prev => ({
        ...prev,
        currentPosition: { x: touch.clientX, y: touch.clientY },
        delta: prev.startPosition
          ? {
              x: touch.clientX - prev.startPosition.x,
              y: touch.clientY - prev.startPosition.y
            }
          : { x: 0, y: 0 }
      }))
    }

    const handleTouchEnd = () => {
      setTouchState(prev => ({
        ...prev,
        isTouching: false
      }))
    }

    element.addEventListener('touchstart', handleTouchStart)
    element.addEventListener('touchmove', handleTouchMove)
    element.addEventListener('touchend', handleTouchEnd)

    return () => {
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('touchmove', handleTouchMove)
      element.removeEventListener('touchend', handleTouchEnd)
    }
  }, [elementRef])

  return touchState
}
```

### Debounce Hook

```typescript
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => clearTimeout(handler)
  }, [value, delay])

  return debouncedValue
}
```

### ローカルストレージ永続化 Hook

```typescript
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch {
      return initialValue
    }
  })

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue(prev => {
        const valueToStore = value instanceof Function ? value(prev) : value
        localStorage.setItem(key, JSON.stringify(valueToStore))
        return valueToStore
      })
    },
    [key]
  )

  return [storedValue, setValue]
}

// 使用例: ゲームの進行状況を保存
const [gameProgress, setGameProgress] = useLocalStorage('game-progress', {
  level: 1,
  score: 0,
  unlockedPieces: []
})
```

## 状態管理パターン

### Context + Reducer パターン

```typescript
interface GameState {
  board: Cell[][]
  currentPiece: Piece | null
  score: number
  phase: 'playing' | 'paused' | 'gameover'
}

type GameAction =
  | { type: 'PLACE_PIECE'; payload: { piece: Piece; position: Position } }
  | { type: 'CLEAR_LINES'; payload: number[] }
  | { type: 'SET_PHASE'; payload: GameState['phase'] }
  | { type: 'RESET_GAME' }

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'PLACE_PIECE':
      return {
        ...state,
        board: placePieceOnBoard(state.board, action.payload.piece, action.payload.position)
      }
    case 'CLEAR_LINES':
      return {
        ...state,
        board: clearLines(state.board, action.payload),
        score: state.score + calculateScore(action.payload.length)
      }
    case 'SET_PHASE':
      return { ...state, phase: action.payload }
    case 'RESET_GAME':
      return initialGameState
    default:
      return state
  }
}

const GameContext = createContext<{
  state: GameState
  dispatch: Dispatch<GameAction>
} | undefined>(undefined)

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialGameState)

  return (
    <GameContext.Provider value={{ state, dispatch }}>
      {children}
    </GameContext.Provider>
  )
}

export function useGame() {
  const context = useContext(GameContext)
  if (!context) throw new Error('useGame must be used within GameProvider')
  return context
}
```

## パフォーマンス最適化

### メモ化

```typescript
// ✅ 重い計算には useMemo を使用
const validMoves = useMemo(() => {
  return calculateValidMoves(board, currentPiece)
}, [board, currentPiece])

// ✅ 子に渡す関数には useCallback を使用
const handleCellClick = useCallback((x: number, y: number) => {
  dispatch({ type: 'CELL_CLICK', payload: { x, y } })
}, [dispatch])

// ✅ 純粋なコンポーネントには React.memo を使用
export const BoardCell = React.memo<BoardCellProps>(({ cell, onClick }) => {
  return (
    <div
      className={`cell cell-${cell.type}`}
      onClick={onClick}
    />
  )
})
```

### コード分割 & 遅延読み込み

```typescript
import { lazy, Suspense } from 'react'

// ✅ 重いコンポーネントを遅延読み込み
const SettingsPanel = lazy(() => import('./SettingsPanel'))
const TutorialOverlay = lazy(() => import('./TutorialOverlay'))

export function Game() {
  const [showSettings, setShowSettings] = useState(false)

  return (
    <div>
      <GameBoard />

      {showSettings && (
        <Suspense fallback={<LoadingSpinner />}>
          <SettingsPanel onClose={() => setShowSettings(false)} />
        </Suspense>
      )}
    </div>
  )
}
```

### requestAnimationFrame によるスムーズなアニメーション

```typescript
export function useAnimatedValue(
  targetValue: number,
  duration: number = 300
): number {
  const [currentValue, setCurrentValue] = useState(targetValue)
  const startValueRef = useRef(targetValue)
  const startTimeRef = useRef<number | null>(null)

  useEffect(() => {
    startValueRef.current = currentValue
    startTimeRef.current = null

    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp
      }

      const elapsed = timestamp - startTimeRef.current
      const progress = Math.min(elapsed / duration, 1)

      // イージング関数（ease-out）
      const eased = 1 - Math.pow(1 - progress, 3)

      const newValue =
        startValueRef.current + (targetValue - startValueRef.current) * eased

      setCurrentValue(newValue)

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    const frameId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameId)
  }, [targetValue, duration])

  return currentValue
}

// 使用例: スコア表示のアニメーション
const animatedScore = useAnimatedValue(score, 500)
return <div className="score">{Math.round(animatedScore)}</div>
```

## ドラッグ＆ドロップパターン

### ピースのドラッグ操作

```typescript
interface DragState {
  isDragging: boolean
  piece: Piece | null
  offset: { x: number; y: number }
  position: { x: number; y: number }
}

export function usePieceDrag() {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    piece: null,
    offset: { x: 0, y: 0 },
    position: { x: 0, y: 0 }
  })

  const startDrag = useCallback((
    piece: Piece,
    clientX: number,
    clientY: number,
    elementRect: DOMRect
  ) => {
    setDragState({
      isDragging: true,
      piece,
      offset: {
        x: clientX - elementRect.left,
        y: clientY - elementRect.top
      },
      position: { x: clientX, y: clientY }
    })
  }, [])

  const updateDrag = useCallback((clientX: number, clientY: number) => {
    setDragState(prev => ({
      ...prev,
      position: { x: clientX, y: clientY }
    }))
  }, [])

  const endDrag = useCallback(() => {
    setDragState(prev => ({
      ...prev,
      isDragging: false
    }))
  }, [])

  // マウスとタッチの両方に対応
  useEffect(() => {
    if (!dragState.isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      updateDrag(e.clientX, e.clientY)
    }

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0]
      updateDrag(touch.clientX, touch.clientY)
    }

    const handleEnd = () => endDrag()

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleEnd)
    window.addEventListener('touchmove', handleTouchMove)
    window.addEventListener('touchend', handleEnd)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleEnd)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleEnd)
    }
  }, [dragState.isDragging, updateDrag, endDrag])

  return { dragState, startDrag, endDrag }
}
```

## Error Boundary パターン

```typescript
interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error boundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-fallback">
          <h2>問題が発生しました</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false })}>
            再試行
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

// 使用例
<ErrorBoundary>
  <Game />
</ErrorBoundary>
```

## サウンド管理パターン

```typescript
class SoundManager {
  private sounds: Map<string, HTMLAudioElement> = new Map()
  private isMuted: boolean = false

  load(name: string, src: string): void {
    const audio = new Audio(src)
    audio.preload = 'auto'
    this.sounds.set(name, audio)
  }

  play(name: string): void {
    if (this.isMuted) return

    const sound = this.sounds.get(name)
    if (sound) {
      sound.currentTime = 0
      sound.play().catch(() => {
        // ユーザー操作前の自動再生はブロックされる
      })
    }
  }

  setMuted(muted: boolean): void {
    this.isMuted = muted
  }
}

// シングルトンとして使用
export const soundManager = new SoundManager()

// 初期化
soundManager.load('place', '/sounds/place.mp3')
soundManager.load('clear', '/sounds/clear.mp3')
soundManager.load('gameover', '/sounds/gameover.mp3')

// React Hook として使用
export function useSound() {
  const [isMuted, setIsMuted] = useLocalStorage('sound-muted', false)

  useEffect(() => {
    soundManager.setMuted(isMuted)
  }, [isMuted])

  const play = useCallback((name: string) => {
    soundManager.play(name)
  }, [])

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev)
  }, [setIsMuted])

  return { play, isMuted, toggleMute }
}
```

## アクセシビリティパターン

### キーボードナビゲーション

```typescript
export function GameMenu({ options, onSelect }: GameMenuProps) {
  const [activeIndex, setActiveIndex] = useState(0)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex(i => Math.min(i + 1, options.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex(i => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        onSelect(options[activeIndex])
        break
    }
  }

  return (
    <div
      role="menu"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {options.map((option, index) => (
        <button
          key={option.id}
          role="menuitem"
          className={index === activeIndex ? 'active' : ''}
          onClick={() => onSelect(option)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
```

### フォーカス管理

```typescript
export function Modal({ isOpen, onClose, children }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (isOpen) {
      // 現在フォーカスされている要素を保存
      previousFocusRef.current = document.activeElement as HTMLElement

      // モーダルにフォーカス
      modalRef.current?.focus()
    } else {
      // 閉じる時にフォーカスを復元
      previousFocusRef.current?.focus()
    }
  }, [isOpen])

  return isOpen ? (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      onKeyDown={e => e.key === 'Escape' && onClose()}
    >
      {children}
    </div>
  ) : null
}
```

**重要**: モダンなフロントエンドパターンは、メンテナンス性が高く高パフォーマンスなゲームを可能にします。プロジェクトの複雑さに合ったパターンを選択してください。
