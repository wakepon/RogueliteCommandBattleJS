import { Button } from '../Common/Button'
import { useGame } from '../../Hooks/UseGame'

export function ResultScreen() {
  const { state, returnToTitle, openStore } = useGame()
  const { resultState } = state

  if (!resultState) {
    return null
  }

  const isVictory = resultState.result === 'victory'

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center ${
      isVictory ? 'bg-green-900' : 'bg-red-900'
    }`}>
      {/* 結果テキスト */}
      <h1 className="text-5xl font-bold text-white mb-8">
        {isVictory ? 'VICTORY' : 'DEFEAT'}
      </h1>

      {/* 報酬情報（勝利時のみ） */}
      {isVictory && (
        <div className="bg-black/30 rounded-lg p-6 mb-8 min-w-64">
          <h2 className="text-xl text-white mb-4 font-semibold">獲得報酬</h2>
          <div className="space-y-2 text-white">
            <div className="flex justify-between">
              <span className="text-gray-300">報酬:</span>
              <span className="text-yellow-400">{resultState.baseGold} G</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">利子:</span>
              <span className="text-yellow-400">{resultState.interestGold} G</span>
            </div>
            {resultState.stolenGold > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-300">盗取:</span>
                <span className="text-yellow-400">{resultState.stolenGold} G</span>
              </div>
            )}
            <div className="border-t border-gray-600 pt-2 mt-2 flex justify-between">
              <span className="text-white font-semibold">合計:</span>
              <span className="text-yellow-400 font-semibold">{resultState.goldEarned} G</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-600 flex justify-between text-white">
            <span className="text-gray-300">討伐数:</span>
            <span>{resultState.killCount} 体</span>
          </div>
        </div>
      )}

      {/* レベルアップ情報（勝利時かつレベルアップした場合） */}
      {isVictory && resultState.levelUps.length > 0 && (
        <div className="bg-black/30 rounded-lg p-6 mb-8 min-w-64">
          <h2 className="text-xl text-yellow-400 mb-4 font-semibold">レベルアップ!</h2>
          {resultState.levelUps.map((levelUp, index) => (
            <div key={index} className="text-white mb-3 last:mb-0">
              <div className="text-lg text-yellow-300 font-bold mb-1">
                {levelUp.characterName} Lv.{levelUp.previousLevel} → Lv.{levelUp.newLevel}
              </div>
              <div className="text-sm text-gray-300 space-y-0.5">
                <p>HP +{levelUp.statsGained.maxHp}、MP +{levelUp.statsGained.maxMp}</p>
                <p>
                  {levelUp.statsGained.str > 0 && `STR +${levelUp.statsGained.str}`}
                  {levelUp.statsGained.str > 0 && levelUp.statsGained.int > 0 && '、'}
                  {levelUp.statsGained.int > 0 && `INT +${levelUp.statsGained.int}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 敗北時のメッセージ */}
      {!isVictory && (
        <p className="text-gray-300 mb-8">
          探索者は力尽きた...
        </p>
      )}

      {/* ボタン */}
      <div className="flex flex-col gap-4">
        {isVictory ? (
          <Button variant="primary" size="lg" onClick={openStore}>
            ストアへ
          </Button>
        ) : (
          <Button variant="secondary" size="lg" onClick={returnToTitle}>
            タイトルへ戻る
          </Button>
        )}
      </div>
    </div>
  )
}
