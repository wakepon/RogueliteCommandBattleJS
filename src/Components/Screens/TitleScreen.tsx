import { Button } from '../Common/Button'
import { useGame } from '../../Hooks/UseGame'

export function TitleScreen() {
  const { startGame, continueGame, hasSaveData } = useGame()

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center">
      <h1 className="text-5xl font-bold text-white mb-4">
        Roguelite Command Battle
      </h1>
      <p className="text-gray-400 mb-12">
        Survive the dungeon. Manage your resources.
      </p>
      <div className="flex flex-col gap-4">
        {hasSaveData && (
          <Button variant="primary" size="lg" onClick={continueGame}>
            Continue
          </Button>
        )}
        <Button
          variant={hasSaveData ? 'secondary' : 'primary'}
          size="lg"
          onClick={startGame}
        >
          {hasSaveData ? 'New Game' : 'Start'}
        </Button>
      </div>
      <p className="absolute bottom-4 text-gray-600 text-sm">
        MVP v0.1.0
      </p>
    </div>
  )
}
