import { useEffect, useRef } from 'react'
import { LevelUpInfo } from '../../Lib/Core/LevelUpCalculator'

interface LevelUpModalProps {
  levelUpInfo: LevelUpInfo
  onComplete: () => void
}

export function LevelUpModal({ levelUpInfo, onComplete }: LevelUpModalProps) {
  // onCompleteの参照を保持してタイマーの安定性を確保
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    // 1.5秒後に自動で閉じる
    const timer = setTimeout(() => onCompleteRef.current(), 1500)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gradient-to-b from-yellow-600 to-yellow-800
                      border-4 border-yellow-400 rounded-lg p-6
                      text-center animate-pulse shadow-2xl">
        <h2 className="text-3xl font-bold text-white mb-4 drop-shadow-lg">
          LEVEL UP!
        </h2>
        <div className="text-2xl text-yellow-200 mb-4 font-bold">
          Lv.{levelUpInfo.previousLevel} → Lv.{levelUpInfo.newLevel}
        </div>
        <div className="text-white space-y-1 text-sm">
          <p>
            <span className="text-red-300">HP</span> +{levelUpInfo.statsGained.maxHp}
            <span className="text-green-300 ml-2">(回復: {levelUpInfo.hpRecovered})</span>
          </p>
          <p>
            <span className="text-blue-300">MP</span> +{levelUpInfo.statsGained.maxMp}
            <span className="text-green-300 ml-2">(回復: {levelUpInfo.mpRecovered})</span>
          </p>
          <p className="text-orange-200">
            STR/INT/AGI +{levelUpInfo.statsGained.str}
          </p>
        </div>
      </div>
    </div>
  )
}
