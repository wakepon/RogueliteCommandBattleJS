---
name: tdd-workflow
description: 明示的に指示されたときに使用するスキル。ゲームロジックのコア部分（配置判定、スコア計算など）のみを対象とし、カバレッジ目標なしでTDD開発を行います。
---

# テスト駆動開発ワークフロー

このスキルは、**明示的に指示された場合にのみ**、ゲームロジックのコア部分に対してTDD原則に従うことを保証します。

## アクティベートするタイミング

このスキルは以下の場合に**ユーザーが明示的に指示した時のみ**使用:
- ゲームのコアロジック（配置判定、スコア計算、盤面操作など）の実装時
- クリティカルなバグの修正時
- 純粋関数のリファクタリング時

## テスト対象

### テストすべきもの（コアロジックのみ）
- ピースの配置判定ロジック
- ライン消去判定
- スコア計算
- 盤面状態の変換
- ゲームオーバー判定
- その他の純粋関数

### テストしないもの
- UI コンポーネント
- イベントハンドラー
- 状態管理（hooks）
- スタイリング
- アニメーション

## コア原則

### 1. 最小限のテスト
- カバレッジ目標は設定しない
- 重要なロジックのみをテスト
- エッジケースは必要な場合のみ

### 2. コード前にテスト（TDD）
指示された場合のみ、最初にテストを書き、その後テストを通すためのコードを実装する。

### 3. シンプルさ優先
- テストは理解しやすく保つ
- 複雑なモックは避ける
- 過度なセットアップは避ける

## TDD ワークフロー手順

### ステップ 1: テストケースを定義
```typescript
describe('placePiece', () => {
  it('有効な位置にピースを配置できる', () => {
    // テスト実装
  })

  it('盤面外への配置は失敗する', () => {
    // エッジケースのテスト
  })
})
```

### ステップ 2: テストを実行（失敗するはず）
```bash
npm test
# テストは失敗するはず - まだ実装していないから
```

### ステップ 3: コードを実装
テストを通すための最小限のコードを書く:

```typescript
export function placePiece(board: Board, piece: Piece, pos: Position): Board | null {
  // テストを通す最小限の実装
}
```

### ステップ 4: 再度テストを実行
```bash
npm test
# テストは通るはず
```

### ステップ 5: リファクタリング
テストが緑のままコード品質を改善

## ゲームロジックのテストパターン

### 盤面操作のテスト
```typescript
import { placePiece, canPlace } from './boardUtils'

describe('canPlace', () => {
  it('空きマスにはピースを配置できる', () => {
    const board = createEmptyBoard(8, 8)
    const piece = createPiece('L')

    expect(canPlace(board, piece, { x: 0, y: 0 })).toBe(true)
  })

  it('既存のピースと重なる場合は配置できない', () => {
    const board = createBoardWithPiece(/* ... */)
    const piece = createPiece('L')

    expect(canPlace(board, piece, { x: 0, y: 0 })).toBe(false)
  })
})
```

### ライン消去のテスト
```typescript
import { checkLines, clearLines } from './lineUtils'

describe('checkLines', () => {
  it('完成した行を検出する', () => {
    const board = createBoardWithFullRow(3)

    expect(checkLines(board)).toEqual({ rows: [3], cols: [] })
  })

  it('完成した行がない場合は空を返す', () => {
    const board = createEmptyBoard(8, 8)

    expect(checkLines(board)).toEqual({ rows: [], cols: [] })
  })
})
```

### スコア計算のテスト
```typescript
import { calculateScore } from './scoreUtils'

describe('calculateScore', () => {
  it('1ライン消去で100点', () => {
    expect(calculateScore(1, 0)).toBe(100)
  })

  it('複数ライン同時消去でボーナス', () => {
    expect(calculateScore(2, 0)).toBe(300) // 100 + 200 bonus
  })

  it('コンボでスコア倍増', () => {
    expect(calculateScore(1, 2)).toBe(200) // combo x2
  })
})
```

## テストファイルの構成

```
src/
├── lib/game/
│   ├── boardUtils.ts
│   ├── boardUtils.test.ts    # 盤面ロジックのテスト
│   ├── lineUtils.ts
│   ├── lineUtils.test.ts     # ライン消去のテスト
│   ├── scoreUtils.ts
│   └── scoreUtils.test.ts    # スコア計算のテスト
└── components/               # テスト対象外
    └── ...
```

## テストヘルパー

テストを簡潔にするためのヘルパー関数を作成:

```typescript
// src/lib/game/testHelpers.ts
export function createEmptyBoard(width: number, height: number): Board {
  return Array(height).fill(null).map(() => Array(width).fill(null))
}

export function createBoardFromString(pattern: string): Board {
  // 'X' = 埋まっている, '.' = 空
  return pattern.split('\n').map(row =>
    row.split('').map(cell => cell === 'X' ? { filled: true } : null)
  )
}

// 使用例
const board = createBoardFromString(`
  ........
  ........
  XXXXXXXX
  ........
`)
```

## 避けるべきこと

### テストを書きすぎない
```typescript
// 不要: 単純なgetterのテスト
it('returns the score', () => {
  expect(getScore(state)).toBe(state.score)
})
```

### UIをテストしない
```typescript
// 不要: コンポーネントのレンダリングテスト
it('renders the board', () => {
  render(<GameBoard />)
  expect(screen.getByTestId('board')).toBeInTheDocument()
})
```

### 過度なモックを避ける
```typescript
// 避ける: 複雑なモック設定
jest.mock('./everything')
```

## ベストプラクティス

1. **純粋関数に集中** - 入力と出力が明確な関数のみテスト
2. **シンプルに保つ** - テストコードも読みやすく
3. **テストヘルパーを活用** - ボイラープレートを減らす
4. **失敗するテストから始める** - TDDの基本
5. **最小限の実装** - テストを通す最小限のコードを書く

---

**重要**: テストは必要な時にのみ書く。ゲームロジックのコア部分に集中し、UIやその他の部分はテストしない。
