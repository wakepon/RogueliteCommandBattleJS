import { RunState, SAVE_VERSION } from '../Types/Run'
import { RelicInstance } from '../Types/Relic'
import RelicsData from '../Data/Relics.json'

const relicsData = RelicsData as Record<string, RelicInstance>

/**
 * 保存されたレリックをマスターデータで再構築する。
 * レリックは状態を持たないため、id からマスターデータを引き直すことで
 * バランス調整や効果形式の変更（例: powerBonus → statBonus）を古いセーブにも反映する。
 */
function rehydrateRelics(relics: RelicInstance[]): RelicInstance[] {
  return relics.map(r => relicsData[r.id] ?? r)
}

/** セーブデータの構造 */
interface SaveData {
  version: number      // 互換性チェック用
  run: RunState        // Run情報のみ保存
  savedAt: number      // timestamp
}

const STORAGE_KEY = 'roguelite-save'

/** セーブデータの基本的な構造を検証 */
function isValidSaveData(data: unknown): data is SaveData {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  return (
    typeof obj.version === 'number' &&
    typeof obj.run === 'object' &&
    obj.run !== null &&
    typeof obj.savedAt === 'number'
  )
}

/** RunStateの基本的な構造を検証 */
function isValidRunState(run: unknown): run is RunState {
  if (typeof run !== 'object' || run === null) return false
  const obj = run as Record<string, unknown>
  return (
    typeof obj.seed === 'number' &&
    typeof obj.currentStage === 'number' &&
    Array.isArray(obj.party) &&
    Array.isArray(obj.relics)
  )
}

export const SaveManager = {
  /** セーブデータを保存する。プライベートブラウジング等で失敗した場合はfalseを返す */
  save(run: RunState): boolean {
    try {
      // battleStartSnapshot は非永続（バトル中のみ有効）
      const data: SaveData = {
        version: SAVE_VERSION,
        run: { ...run, battleStartSnapshot: null },
        savedAt: Date.now(),
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      return true
    } catch {
      // プライベートブラウジングモードやlocalStorageが無効な環境
      return false
    }
  },

  /** セーブデータを読み込む。存在しない、無効、またはバージョン不一致の場合はnullを返す */
  load(): RunState | null {
    try {
      const json = localStorage.getItem(STORAGE_KEY)
      if (!json) return null

      const data = JSON.parse(json)

      // 構造検証
      if (!isValidSaveData(data)) {
        return null
      }

      // バージョンチェック
      if (data.version !== SAVE_VERSION) {
        return null
      }

      // RunStateの検証
      if (!isValidRunState(data.run)) {
        return null
      }

      // 古いセーブデータに battleStartSnapshot / totalBrokenWeaponCount が無い場合の正規化
      return {
        ...data.run,
        battleStartSnapshot: data.run.battleStartSnapshot ?? null,
        totalBrokenWeaponCount: data.run.totalBrokenWeaponCount ?? 0,
        relics: rehydrateRelics(data.run.relics),
      }
    } catch {
      return null
    }
  },

  /** セーブデータを削除する */
  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // エラーを無視（削除できなくても影響は軽微）
    }
  },

  /** セーブデータが存在するかチェックする */
  hasSave(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) !== null
    } catch {
      return false
    }
  },
}
