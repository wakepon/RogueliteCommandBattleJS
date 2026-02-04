---
name: coding-standards
description: TypeScript、JavaScript、React開発における汎用的なコーディング規約、ベストプラクティス、パターン。
---

# コーディング規約 & ベストプラクティス

すべてのプロジェクトに適用される汎用的なコーディング規約。

## コード品質の原則

### 1. 可読性優先
- コードは書くより読む回数の方が多い
- 明確な変数名・関数名を使用する
- コメントよりも自己文書化されたコードを優先する
- 一貫したフォーマットを維持する

### 2. KISS（シンプルに保つ）
- 動作する最もシンプルな解決策を選ぶ
- 過剰な設計を避ける
- 早すぎる最適化をしない
- 賢いコードより理解しやすいコードを選ぶ

### 3. DRY（同じことを繰り返さない）
- 共通ロジックを関数として抽出する
- 再利用可能なコンポーネントを作成する
- モジュール間でユーティリティを共有する
- コピー＆ペーストプログラミングを避ける

### 4. YAGNI（必要になるまで作らない）
- 必要になる前に機能を作らない
- 投機的な汎用化を避ける
- 必要な場合のみ複雑さを追加する
- シンプルに始めて、必要に応じてリファクタリングする

## TypeScript/JavaScript 規約

### 変数の命名

```typescript
// ✅ 良い例: 説明的な名前
const currentScore = 100
const isGameOver = false
const remainingPieces = 5

// ❌ 悪い例: 不明確な名前
const s = 100
const flag = false
const x = 5
```

### 関数の命名

```typescript
// ✅ 良い例: 動詞-名詞パターン
function calculateScore(moves: number): number { }
function isValidPlacement(piece: Piece, position: Position): boolean { }
function rotatePiece(piece: Piece, degrees: number): Piece { }

// ❌ 悪い例: 不明確または名詞のみ
function score(m) { }
function valid(p, pos) { }
function piece(p, d) { }
```

### Immutability パターン（重要）

```typescript
// ✅ 常にスプレッド演算子を使用する
const updatedGameState = {
  ...gameState,
  score: newScore
}

const updatedPieces = [...pieces, newPiece]

// ❌ 直接の変更は絶対にしない
gameState.score = newScore  // ダメ
pieces.push(newPiece)       // ダメ
```

### エラーハンドリング

```typescript
// ✅ 良い例: 包括的なエラーハンドリング
function loadGameData(saveSlot: number): GameState {
  try {
    const data = localStorage.getItem(`save_${saveSlot}`)
    if (!data) {
      throw new Error('セーブデータが見つかりません')
    }
    return JSON.parse(data)
  } catch (error) {
    console.error('ゲームデータの読み込みに失敗:', error)
    throw new Error('セーブデータの読み込みに失敗しました')
  }
}

// ❌ 悪い例: エラーハンドリングなし
function loadGameData(saveSlot) {
  return JSON.parse(localStorage.getItem(`save_${saveSlot}`))
}
```

### Async/Await のベストプラクティス

```typescript
// ✅ 良い例: 可能な場合は並列実行
const [textures, sounds, config] = await Promise.all([
  loadTextures(),
  loadSounds(),
  loadConfig()
])

// ❌ 悪い例: 不必要な逐次実行
const textures = await loadTextures()
const sounds = await loadSounds()
const config = await loadConfig()
```

### 型安全性

```typescript
// ✅ 良い例: 適切な型定義
interface GamePiece {
  id: string
  shape: number[][]
  position: { x: number; y: number }
  rotation: 0 | 90 | 180 | 270
}

function placePiece(piece: GamePiece, board: Board): Board {
  // 実装
}

// ❌ 悪い例: 'any' の使用
function placePiece(piece: any, board: any): any {
  // 実装
}
```

## React ベストプラクティス

### コンポーネント構造

```typescript
// ✅ 良い例: 型付きの関数コンポーネント
interface GameBoardProps {
  board: Board
  onCellClick: (x: number, y: number) => void
  isInteractive?: boolean
}

export function GameBoard({
  board,
  onCellClick,
  isInteractive = true
}: GameBoardProps) {
  return (
    <div className="game-board">
      {board.cells.map((row, y) => (
        <div key={y} className="board-row">
          {row.map((cell, x) => (
            <Cell
              key={x}
              value={cell}
              onClick={() => isInteractive && onCellClick(x, y)}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// ❌ 悪い例: 型なし、不明確な構造
export function GameBoard(props) {
  return <div onClick={props.onClick}>{props.children}</div>
}
```

### カスタム Hooks

```typescript
// ✅ 良い例: ゲーム用カスタム hook
export function useGameLoop(callback: () => void, fps: number = 60) {
  const requestRef = useRef<number>()
  const previousTimeRef = useRef<number>()
  const interval = 1000 / fps

  useEffect(() => {
    const animate = (time: number) => {
      if (previousTimeRef.current !== undefined) {
        const deltaTime = time - previousTimeRef.current
        if (deltaTime >= interval) {
          callback()
          previousTimeRef.current = time
        }
      } else {
        previousTimeRef.current = time
      }
      requestRef.current = requestAnimationFrame(animate)
    }

    requestRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(requestRef.current!)
  }, [callback, interval])
}

// 使用例
useGameLoop(() => updateGame(), 60)
```

### State 管理

```typescript
// ✅ 良い例: 適切な state 更新
const [score, setScore] = useState(0)

// 前の state に基づく更新には関数形式を使う
setScore(prev => prev + points)

// ❌ 悪い例: 直接の state 参照
setScore(score + points)  // 非同期シナリオで古い値を参照する可能性あり
```

### 条件付きレンダリング

```typescript
// ✅ 良い例: 明確な条件付きレンダリング
{isLoading && <LoadingSpinner />}
{isGameOver && <GameOverScreen score={score} />}
{isPaused && <PauseMenu onResume={handleResume} />}

// ❌ 悪い例: 三項演算子の連鎖
{isLoading ? <LoadingSpinner /> : isGameOver ? <GameOverScreen /> : isPaused ? <PauseMenu /> : null}
```

## ファイル構成

### プロジェクト構造

```
src/
├── components/            # React コンポーネント
│   ├── ui/               # 汎用 UI コンポーネント
│   ├── game/             # ゲーム固有コンポーネント
│   └── layouts/          # レイアウトコンポーネント
├── hooks/                # カスタム React hooks
├── lib/                  # ユーティリティと設定
│   ├── game/            # ゲームロジック
│   ├── utils/           # ヘルパー関数
│   └── constants/       # 定数
├── types/                # TypeScript 型定義
├── assets/              # 画像、音声などのアセット
└── styles/              # グローバルスタイル
```

### ファイル命名

```
components/GameBoard.tsx       # コンポーネントは PascalCase
hooks/useGameLoop.ts          # hooks は 'use' プレフィックス付き camelCase
lib/calculateScore.ts         # ユーティリティは camelCase
types/game.types.ts           # 型定義は .types サフィックス付き camelCase
```

## コメント & ドキュメント

### コメントを書くべき場面

```typescript
// ✅ 良い例: 「何を」ではなく「なぜ」を説明
// 60FPSでの描画を安定させるため、requestAnimationFrameを使用
const animate = (timestamp: number) => { ... }

// ピースの回転は時計回りのみ（ユーザーテストで直感的と判明）
function rotatePiece(piece: Piece): Piece { ... }

// ❌ 悪い例: 自明なことの説明
// スコアを1増やす
score++

// ゲームを開始する
startGame()
```

## パフォーマンスのベストプラクティス

### メモ化

```typescript
import { useMemo, useCallback } from 'react'

// ✅ 良い例: 重い計算をメモ化
const validMoves = useMemo(() => {
  return calculateValidMoves(board, currentPiece)
}, [board, currentPiece])

// ✅ 良い例: コールバックをメモ化
const handlePieceDrop = useCallback((x: number, y: number) => {
  placePiece(currentPiece, x, y)
}, [currentPiece])
```

### 遅延読み込み

```typescript
import { lazy, Suspense } from 'react'

// ✅ 良い例: 重いコンポーネントを遅延読み込み
const SettingsPanel = lazy(() => import('./SettingsPanel'))

export function Game() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      {showSettings && <SettingsPanel />}
    </Suspense>
  )
}
```

## テスト規約

### テスト構造（AAA パターン）

```typescript
test('ピースを正しく回転させる', () => {
  // Arrange（準備）
  const piece: GamePiece = createPiece('L')

  // Act（実行）
  const rotated = rotatePiece(piece, 90)

  // Assert（検証）
  expect(rotated.rotation).toBe(90)
})
```

### テストの命名

```typescript
// ✅ 良い例: 説明的なテスト名
test('無効な位置にピースを配置しようとするとfalseを返す', () => { })
test('ゲームオーバー時にスコアが保存される', () => { })
test('一列揃うとその行が消える', () => { })

// ❌ 悪い例: 曖昧なテスト名
test('works', () => { })
test('test piece', () => { })
```

## コードの臭い検出

以下のアンチパターンに注意：

### 1. 長い関数
```typescript
// ❌ 悪い例: 50行を超える関数
function updateGame() {
  // 100行のコード
}

// ✅ 良い例: 小さな関数に分割
function updateGame() {
  handleInput()
  updatePhysics()
  checkCollisions()
  render()
}
```

### 2. 深いネスト
```typescript
// ❌ 悪い例: 5レベル以上のネスト
if (isPlaying) {
  if (currentPiece) {
    if (isValidPosition) {
      if (canPlace) {
        if (hasSpace) {
          // 配置処理
        }
      }
    }
  }
}

// ✅ 良い例: 早期リターン
if (!isPlaying) return
if (!currentPiece) return
if (!isValidPosition) return
if (!canPlace) return
if (!hasSpace) return

// 配置処理
```

### 3. マジックナンバー
```typescript
// ❌ 悪い例: 説明のない数値
if (score > 1000) { }
setTimeout(callback, 16)

// ✅ 良い例: 名前付き定数
const BONUS_THRESHOLD = 1000
const FRAME_DURATION_MS = 16  // 約60FPS

if (score > BONUS_THRESHOLD) { }
setTimeout(callback, FRAME_DURATION_MS)
```

**重要**: コード品質は妥協できません。明確でメンテナンスしやすいコードは、迅速な開発と自信を持ったリファクタリングを可能にします。
