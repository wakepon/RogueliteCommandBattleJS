# Tuning Editor 仕様書

## 概要

Vite + TypeScript プロジェクト向けのゲームバランス調整エディタ。
開発サーバー上で別タブとして動作し、ゲームのバランスパラメータをGUIで調整できる。

変更した値はリアルタイムにゲームに反映され、「保存」ボタンを押すとJSONファイルに書き出される。
このJSONファイルはgitで管理され、本番ビルドにも含まれる。

UnityのInspector / ScriptableObject に相当する機能をブラウザ上で実現する。

## 技術スタック前提

- Vite（ビルドツール + 開発サーバー）
- TypeScript
- ブラウザベースのゲーム（Canvas / DOM）

## アーキテクチャ

### ファイル構成

```
project/
├── src/
│   └── lib/game/
│       ├── Data/
│       │   └── TuningData.json        # バランスデータ（git管理、本番に含まれる）
│       └── Tuning/
│           ├── TuningSchema.ts         # 調整項目のメタデータ定義
│           ├── TuningConfig.ts         # 型定義 + チャネルメッセージ型
│           ├── TuningStore.ts          # 値取得関数（getTuningValue）
│           ├── TuningReceiver.ts       # BroadcastChannel受信（DEV専用）
│           ├── TuningSerializer.ts     # バリデーション
│           └── index.ts               # エクスポートバレル
├── editor/
│   ├── index.html                      # エディタページ
│   ├── main.ts                         # エディタロジック
│   ├── EditorUI.ts                     # UI自動生成
│   └── style.css                       # エディタスタイル
├── vite-plugins/
│   └── tuning-save-plugin.ts           # Viteプラグイン（JSON書き出し）
└── vite.config.ts                      # マルチページ設定
```

### データフロー

#### 開発中

```
エディタで値変更
  ├→ BroadcastChannel → ゲームタブにリアルタイム反映（お試し）
  │
「保存」ボタン押下
  └→ fetch POST → Viteプラグイン → TuningData.json に書き出し
                                      ↓
                                 git commit → 本番ビルドに反映
```

#### 本番ビルド

```
TuningData.json (git管理)
  ↓ import (ビルド時にバンドル)
getTuningValue(key, defaultValue)
  → JSONの値を返す
```

## 主要コンポーネントの仕様

### 1. TuningData.json

バランスデータの実体。全ての調整パラメータの現在値を持つ。

```json
{
  "parameterName": 50,
  "anotherParam": 3,
  "arrayParam": [10, 20, 50]
}
```

- gitで管理する
- `npm run build` でバンドルに含まれる
- エディタの「保存」ボタンで更新される
- 手動編集も可能

### 2. TuningSchema.ts

各調整項目のメタデータを宣言的に定義する。エディタUIはこのスキーマから自動生成される。

```typescript
export interface TuningFieldMeta {
  readonly key: string; // TuningData.jsonのキー名
  readonly label: string; // エディタ上の表示名
  readonly category: string; // カテゴリ（サイドバーのグループ）
  readonly defaultValue: unknown; // スキーマ上の初期値
  readonly control: TuningControl; // UIコントロール型
}

type TuningControl =
  | { type: "number"; min: number; max: number; step: number }
  | { type: "number_unlimited"; min: number; step: number } // 上限なし選択可
  | { type: "slider"; min: number; max: number; step: number }
  | { type: "toggle" }
  | { type: "array"; itemControl: TuningControl };

export const TUNING_SCHEMA: readonly TuningFieldMeta[] = [
  {
    key: "parameterName",
    label: "パラメータ名",
    category: "general",
    defaultValue: 50,
    control: { type: "slider", min: 0, max: 100, step: 1 },
  },
  // ... 調整項目を追加
];
```

**新しい調整項目の追加手順:**

1. `TuningSchema.ts` に1エントリ追加
2. `TuningConfig.ts` の型にフィールド追加
3. `TuningData.json` にデフォルト値を追加
4. ゲームコードで `getTuningValue("key", defaultValue)` で参照

エディタUIはスキーマから自動生成されるため、UIコードの修正は不要。

### 3. TuningConfig.ts

バランスデータの型定義とチャネルメッセージ型。

```typescript
export const TUNING_SCHEMA_VERSION = 1;

export interface TuningConfig {
  readonly parameterName: number;
  readonly anotherParam: number;
  // ... 全パラメータの型
}

export type TuningChannelMessage =
  | { type: "request-sync" }
  | {
      type: "full-sync";
      version: number;
      revision: number;
      senderId: string;
      state: Record<string, unknown>;
    }
  | {
      type: "batch-update";
      version: number;
      revision: number;
      senderId: string;
      state: Record<string, unknown>;
    };
```

### 4. TuningStore.ts

ゲームコードが値を取得するための関数。

```typescript
import tuningData from "../Data/TuningData.json";

let _devOverrides: Record<string, unknown> = {};

export function getTuningValue<K extends keyof TuningConfig>(
  key: K,
  defaultValue: TuningConfig[K],
): TuningConfig[K] {
  // 開発中はエディタからのオーバーライドを優先
  if (import.meta.env.DEV) {
    const k = key as string;
    if (k in _devOverrides) {
      return _devOverrides[k] as TuningConfig[K];
    }
  }
  // JSONの値を返す（本番でもDEVでも）
  const k = key as string;
  if (k in tuningData) {
    return (tuningData as Record<string, unknown>)[k] as TuningConfig[K];
  }
  return defaultValue;
}
```

**ポイント:**

- 本番ビルドでは `_devOverrides` のif文がtree-shakingで除去される
- ゲームコードは `getTuningValue("key", default)` を呼ぶだけ
- DEVガードは `getTuningValue` 内部にのみ存在し、呼び出し側は意識しない

### 5. TuningReceiver.ts（DEV専用）

ゲームタブ側でBroadcastChannelを受信し、`_devOverrides` に反映する。

```typescript
export function initTuningReceiver(): void {
  if (!import.meta.env.DEV) return;

  const channel = new BroadcastChannel("game-tuning");
  channel.postMessage({ type: "request-sync" });

  channel.onmessage = (e) => {
    if (e.data.type === "full-sync" || e.data.type === "batch-update") {
      setDevOverrides(validateChannelState(e.data.state));
    }
  };
}
```

ゲームの初期化時に1回呼び出す（React useEffect等）。

### 6. Viteプラグイン（tuning-save-plugin.ts）

エディタからのPOSTリクエストを受け付け、TuningData.jsonに書き出す。

```typescript
export function tuningSavePlugin(): Plugin {
  return {
    name: "tuning-save",
    configureServer(server) {
      // TuningData.jsonの変更でHMRが発火しないようにwatchを除外
      server.watcher.unwatch(jsonPath);

      server.middlewares.use("/api/tuning/save", (req, res) => {
        // POSTされたJSONをTuningData.jsonに書き出す
      });
    },
  };
}
```

**重要:** `server.watcher.unwatch(jsonPath)` でTuningData.jsonの変更によるHMR発火を防止する。リアルタイム反映はBroadcastChannel経由で行うため、ファイル変更によるリロードは不要。

### 7. vite.config.ts

マルチページ設定。エディタページは開発時のみ含め、本番ビルドからは除外。

```typescript
export default defineConfig(({ command }) => ({
  plugins: [
    react(), // or 使用しているフレームワークのプラグイン
    ...(command === "serve" ? [tuningSavePlugin()] : []),
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        ...(command === "serve"
          ? { editor: resolve(__dirname, "editor/index.html") }
          : {}),
      },
    },
  },
}));
```

### 8. エディタUI（EditorUI.ts）

`TUNING_SCHEMA` を走査してUIを自動生成する。

対応するコントロール型:

- `slider`: `<input type="range">` + 値表示（デバウンス付き）
- `number`: `<input type="number">`
- `number_unlimited`: `<input type="number">` + 「上限なし」チェックボックス
- `toggle`: `<input type="checkbox">`
- `array`: 配列要素ごとの `<input type="number">`

### 9. エディタメイン（editor/main.ts）

エディタのメインロジック。

**起動時:**

1. `TuningData.json` をfetchで読み込み → `_currentState` と `_savedState` に設定
2. BroadcastChannelでゲームタブへfull-sync送信

**操作:**

| ボタン              | 動作                                                                      |
| ------------------- | ------------------------------------------------------------------------- |
| スライダー/数値変更 | `_currentState` を更新 + BroadcastChannelでゲームにリアルタイム反映       |
| **保存**            | `_currentState` を `/api/tuning/save` にPOST → TuningData.json に書き出し |
| **全リセット**      | `_currentState` を `_savedState`（最後に保存した値）に戻す + ゲームに反映 |
| **Export**          | `_currentState` をJSONファイルとしてダウンロード（プリセット保存）        |
| **Import**          | JSONファイルを読み込み → `_currentState` に反映 + ゲームに反映            |

**保存時の安全策:**

- `_dataLoaded` フラグで、TuningData.json読み込み完了前の保存を拒否
- 保存成功時に `_savedState` を更新（全リセットのリセット先を最新に）

## エディタ画面構成

```
+------------------+----------------------------------------+
| カテゴリ         | [接続中] [全リセット] [保存]           |
|                  | [Export] [Import]                      |
| [カテゴリA]      |----------------------------------------|
| [カテゴリB]      | パラメータ1   [====----] 50            |
| [カテゴリC]      | パラメータ2   [--------] 3             |
| ...              | パラメータ3   [input ] 10              |
+------------------+----------------------------------------+
```

- **左サイドバー**: カテゴリナビゲーション（スキーマのcategoryから自動生成）
- **上部バー**: 接続状態、全リセット、保存、Export、Import
- **メインエリア**: 選択カテゴリの調整項目

## バリデーション（TuningSerializer.ts）

全データ入力経路（TuningData.json読み込み、BroadcastChannel受信、Import）で同一のバリデーションを適用:

- 型チェック（number, boolean, array）
- 範囲クランプ（min/max）
- 不明キーの除去
- 空配列のデフォルト値フォールバック

## 導入手順

### Step 1: ファイル作成

1. `src/lib/game/Tuning/` 配下の6ファイルを作成
2. `editor/` 配下の4ファイルを作成
3. `vite-plugins/tuning-save-plugin.ts` を作成
4. `src/lib/game/Data/TuningData.json` を作成（初期値）

### Step 2: Vite設定

`vite.config.ts` にマルチページ設定とプラグインを追加。

### Step 3: ゲームコードの接続

1. ゲーム初期化時に `initTuningReceiver()` を呼び出す
2. 調整したい定数を `getTuningValue("key", currentValue)` に置き換える

### Step 4: スキーマ定義

`TuningSchema.ts` に調整したいパラメータを定義する。

### Step 5: 動作確認

```bash
npm run dev
# ゲーム: localhost:5173/
# エディタ: localhost:5173/editor/
```

## 設計上の注意点

### バランスデータとデバッグ機能の分離

| 場所                | 対象                                          | 保存先                                     |
| ------------------- | --------------------------------------------- | ------------------------------------------ |
| **Tuning Editor**   | ゲームバランスに影響する値                    | TuningData.json（git管理、本番に含まれる） |
| **ゲーム内DebugUI** | デバッグ専用機能（強制出現、Effect On/Off等） | メモリ内（DEVのみ）                        |

Tuning Editorにデバッグ専用機能を混ぜないこと。

### リアルタイム反映と保存の分離

- スライダー操作 → ゲームにリアルタイム反映（TuningData.jsonは変更しない）
- 「保存」ボタン → TuningData.jsonに書き出し（本番に反映される確定操作）

これにより「ちょっと試す」と「本番に反映する」が明確に分離され、意図しない値のコミットを防止できる。

### HMR発火の防止

Viteプラグインで `server.watcher.unwatch(jsonPath)` を行い、TuningData.jsonの変更によるHMRリロードを防ぐ。リアルタイム反映はBroadcastChannel経由で行うため、ファイル変更によるリロードは不要。

### 全体倍率（category: `global`「全体倍率」）

全フロア一括で効く倍率。デフォルトはすべて `1.0`（既存挙動を変えない）。

| key | 対象 |
| --- | --- |
| `global_enemy_hp_multiplier` | 敵HP |
| `global_enemy_damage_multiplier` | 敵攻撃力 |
| `global_mp_cost_multiplier` | 魔法の固定MP消費（`mpCost`） |
| `global_mp_cost_rate_multiplier` | 割合MP消費（`mpCostRate`、0<rate<1.0） |

**敵HP・敵攻撃力**は `階層倍率（floor）` と積算される（実効倍率 = 全体倍率 × 階層倍率）。
フロア1は階層倍率が実質1.0のため、全体倍率がそのまま効く。
適用は `BattleStateFactory.ts` の `getEnemyHpMultiplier` / `getEnemyDamageMultiplier` に集約。

**MP消費**は階層倍率を持たず全体倍率のみ効く。計算は `MpCostCalculator.ts`（`getEffectiveMpCost` / `isFullMpCost`）に集約し、消費（`BattleActionProcessor`）と使用可否判定（`CommandValidator`）で共有する。
- 固定消費: `round(mpCost × global_mp_cost_multiplier)`（四捨五入）
- 割合消費: `floor(maxMp × mpCostRate × global_mp_cost_rate_multiplier)`
- 全MP消費型（`mpCostRate >= 1.0`）は倍率対象外で常に全消費。

UI上のMP表示（コマンド一覧・ツールチップ・ショップ・アイテム説明）も倍率を反映する。表示用ヘルパ `getDisplayMpCost`（固定）と `getDisplayMpCostRate`（割合。表示は100%上限にクランプ）を `MpCostCalculator.ts` に用意し、`CommandList` / `TooltipCard` / `DraggableCommand` / `StoreScreen` / `ItemDescription` で使用する。`getDisplayMpCost` は固定消費の実消費計算と同一のため、表示と実消費が一致する。
