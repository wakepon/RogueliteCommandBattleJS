# コーディングスタイル

## Immutability（重要）

常に新しいオブジェクトを作成し、絶対にmutateしない:

```javascript
// 悪い例: Mutation
function updateUser(user, name) {
  user.name = name  // MUTATION!
  return user
}

// 良い例: Immutability
function updateUser(user, name) {
  return {
    ...user,
    name
  }
}
```

## ファイル構成

大きなファイルより小さなファイルを複数に分ける:
- 高凝集、低結合を意識する
- 通常200〜400行、最大800行まで
- 大きなコンポーネントからutilityを抽出する
- 種類別ではなく、機能/ドメイン別に整理する

## エラーハンドリング

常にエラーを適切に処理する:

```typescript
try {
  const result = await riskyOperation()
  return result
} catch (error) {
  console.error('Operation failed:', error)
  throw new Error('詳細でユーザーにわかりやすいメッセージ')
}
```

## 入力バリデーション

常にユーザー入力を検証する:

```typescript
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  age: z.number().int().min(0).max(150)
})

const validated = schema.parse(input)
```

## アーキテクチャ原則

### 単一責任の原則（SRP）

各モジュール/関数は1つの責任のみを持つ:

```typescript
// ❌ 悪い例: 複数の責任を持つコンポーネント
function GameBoard({ pieces }) {
  // ゲームロジック + レンダリング + 入力処理が混在
  const handleClick = (x, y) => {
    if (isValidMove(x, y)) {
      pieces[y][x] = currentPiece  // mutation + ロジック
      checkForLines()               // 別の責任
      updateScore()                 // また別の責任
    }
  }
  return <div>...</div>
}

// ✅ 良い例: 責任を分離
// lib/game/gameLogic.ts - ゲームロジックのみ
function placePiece(board: Board, piece: Piece, pos: Position): Board { }
function checkLines(board: Board): number[] { }

// hooks/useGame.ts - 状態管理のみ
function useGame() {
  const [state, dispatch] = useReducer(gameReducer, initialState)
  return { state, actions: bindActions(dispatch) }
}

// components/GameBoard.tsx - 表示のみ
function GameBoard({ board, onCellClick }: Props) {
  return <div>...</div>
}
```

### 依存性逆転の原則（DIP）

具象ではなく抽象（interface）に依存する:

```typescript
// ✅ 良い例: interfaceに依存
interface GameStorage {
  save(state: GameState): void
  load(): GameState | null
}

// 本番用
class LocalStorageGameStorage implements GameStorage {
  save(state: GameState) { localStorage.setItem('game', JSON.stringify(state)) }
  load() { return JSON.parse(localStorage.getItem('game') || 'null') }
}

// テスト用
class MockGameStorage implements GameStorage {
  private data: GameState | null = null
  save(state: GameState) { this.data = state }
  load() { return this.data }
}

// 使用側はinterfaceのみに依存
function useGamePersistence(storage: GameStorage) {
  // storageの具体的な実装を知らない
}
```

### ゲームロジックとUIの分離

```
src/
├── lib/game/           # Pure なゲームロジック（Reactに依存しない）
│   ├── types.ts        # 型定義
│   ├── gameReducer.ts  # 状態遷移ロジック
│   └── pieceUtils.ts   # ピース操作
├── hooks/              # ロジックとUIの橋渡し
│   ├── useGame.ts      # ゲーム状態管理
│   └── useGameInput.ts # 入力ハンドリング
└── components/         # 純粋な表示コンポーネント
    ├── GameBoard.tsx   # ボード表示
    └── PiecePreview.tsx
```

**メリット:**
- ゲームロジックを単体テストしやすい
- UIフレームワークを変更しても、ロジックは再利用可能
- 各層の責任が明確で理解しやすい

## コード品質チェックリスト

作業完了前に確認:
- [ ] コードが読みやすく、適切な命名がされている
- [ ] 関数が小さい（50行未満）
- [ ] ファイルが適切なサイズ（800行未満）
- [ ] 深いネストがない（4階層以上は避ける）
- [ ] 適切なエラーハンドリングがされている
- [ ] console.logが残っていない
- [ ] ハードコードされた値がない
- [ ] mutationがない（immutableパターンを使用）
