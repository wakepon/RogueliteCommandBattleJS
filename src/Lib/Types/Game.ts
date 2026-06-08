import { RunState } from './Run'
import { BattleState } from './Battle'
import { WeaponData } from './Weapon'
import { SpellData } from './Spell'
import { RelicData } from './Relic'
import { PotionData } from './Potion'
import { EnemyType } from './Enemy'
import { CharacterClass } from './Explorer'

// ゲームフェーズ
export type GamePhase = 'title' | 'battle' | 'store' | 'event' | 'result' | 'map'

/** マップノードのタイプ */
export type MapNodeType = 'battle' | 'event' | 'boss'

/** マップ上の敵プレビュー情報 */
export interface EnemyPreview {
  enemyId: string
  type: EnemyType
}

/** マップノード */
export interface MapNode {
  stage: number
  nodeType: MapNodeType
  enemies: EnemyPreview[]
}

/** マップ状態 */
export interface MapState {
  nodes: MapNode[]
  currentStage: number
}

/** イベント画面のサブフェーズ */
export type EventSubPhase =
  | 'selecting'           // 3つの選択肢から選ぶ
  | 'repairSelection'     // 武器修理: 武器を選択中
  | 'treasureReveal'      // 宝箱: 新レリック表示
  | 'treasureReplace'     // 宝箱: 入れ替え選択中

/** イベント状態 */
export interface EventState {
  subPhase: EventSubPhase
  revealedRelic: RelicData | null
  selectedWeaponIds: string[]
}

// BattleStateをBattle.tsから再エクスポート
export type { BattleState } from './Battle'

/** メンバー単位の武器耐久差分 */
export interface WeaponUsesDiff {
  weaponId: string
  weaponName: string
  currentUses: number | null   // null=無制限
  maxUses: number | null
  usesBefore: number | null    // 戦闘開始時のcurrentUses
  usesDiff: number              // 現値 - 開始値（負が消費）
  broken: boolean               // currentUses === 0 && maxUses !== null
}

/** メンバー単位のバトル前後差分 */
export interface MemberBattleDiff {
  explorerId: string
  name: string
  characterClass: CharacterClass
  // 現在値（戦闘終了時）
  hp: number
  maxHp: number
  mp: number
  maxMp: number
  level: number
  exp: number
  expRequired: number
  weapons: WeaponUsesDiff[]
  // 差分（負=減った、正=増えた、0=変化なし）
  hpDiff: number
  maxHpDiff: number
  mpDiff: number
  maxMpDiff: number
  levelDiff: number
  // 戦闘開始時の値（リザルトアニメで before→after を描画するため）
  hpBefore: number
  maxHpBefore: number
  mpBefore: number
  maxMpBefore: number
  levelBefore: number
  expBefore: number
  expRequiredBefore: number
}

/** リザルト画面のメンバーアニメーションフェーズ */
export type MemberAnimationPhase =
  | 'pending'           // まだ表示されていない
  | 'enter'             // 大カードのフェードイン中（数値はbefore）
  | 'resourcesAnimate'  // HP/MP/EXP/武器耐久をafterへ伸縮中
  | 'shaking'           // レベルアップ振動中
  | 'levelUpdated'      // レベル数値を新値に更新済み
  | 'maxStatsRevealed'  // maxHP/maxMPの差分を表示済み
  | 'done'              // 完了

/** 戦闘結果の状態 */
export interface ResultState {
  result: 'victory' | 'defeat'
  killCount: number       // 討伐数
  memberDiffs: MemberBattleDiff[]  // メンバー別変化量（勝利時のみ有効、敗北時は空配列）
}

/** ショップカテゴリ */
export type StoreCategory = 'weapon' | 'spell' | 'relic' | 'potion'

/** ショップの1枠 */
export type ShopSlot =
  | { category: 'weapon'; item: WeaponData | null }
  | { category: 'spell'; item: SpellData | null }
  | { category: 'relic'; item: RelicData | null }
  | { category: 'potion'; item: PotionData | null }

/** 報酬候補（2カテゴリ×2枠 = 4枠） */
export interface ShopOption {
  categories: [StoreCategory, StoreCategory]
  slots: ShopSlot[]  // 4枠（上段2 + 下段2）
}

/** ストア状態 */
export interface StoreState {
  shopOptions: [ShopOption, ShopOption]  // 2択
  selectedShopIndex: number | null       // 未選択=null, 選択後=0or1
  rerollCount: number                     // リロール回数（将来の回数制限用）
  rareRate: number                       // 第二階層以降のRare出現率
  floor: number                          // 階層（レアリティフィルタに使用）
}

// ゲーム全体の状態
export interface GameState {
  phase: GamePhase
  run: RunState | null
  battleState: BattleState | null
  storeState: StoreState | null
  resultState: ResultState | null
  eventState: EventState | null
  mapState: MapState | null
}

// 初期GameState
export function createInitialGameState(): GameState {
  return {
    phase: 'title',
    run: null,
    battleState: null,
    storeState: null,
    resultState: null,
    eventState: null,
    mapState: null,
  }
}
