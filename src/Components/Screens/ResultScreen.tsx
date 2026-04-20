import { Button } from '../Common/Button'
import { useGame } from '../../Hooks/UseGame'
import { ResultMemberPanel } from '../Result'

export function ResultScreen() {
  const { state, openStore } = useGame()
  const { resultState } = state

  // 敗北時は BattleScreen のオーバーレイで処理するため、ここには勝利時のみ到達する
  if (!resultState || resultState.result !== 'victory') {
    return null
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-green-900">
      <h1 className="text-5xl font-bold text-white mb-6">VICTORY</h1>

      {/* 報酬情報 */}
      <div className="bg-black/30 rounded-lg p-6 mb-6 min-w-64">
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
            <span className="text-white font-semibold">獲得計:</span>
            <span className="text-yellow-400 font-semibold">{resultState.goldEarned} G</span>
          </div>
          {resultState.goldDiff !== resultState.goldEarned && (
            <div className="flex justify-between items-center">
              <span className="text-gray-300">純増:</span>
              <span className="flex items-center gap-1">
                <span className={resultState.goldDiff >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {resultState.goldDiff >= 0 ? '+' : ''}
                  {resultState.goldDiff} G
                </span>
              </span>
            </div>
          )}
        </div>
        <div className="mt-4 pt-4 border-t border-gray-600 flex justify-between text-white">
          <span className="text-gray-300">討伐数:</span>
          <span>{resultState.killCount} 体</span>
        </div>
      </div>

      {/* メンバー別変化量 */}
      {resultState.memberDiffs.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 w-full max-w-4xl">
          {resultState.memberDiffs.map(diff => (
            <ResultMemberPanel key={diff.explorerId} diff={diff} />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-4">
        <Button variant="primary" size="lg" onClick={openStore}>
          ストアへ
        </Button>
      </div>
    </div>
  )
}
