import { GameProvider, useGame } from './Hooks/UseGame'
import { TitleScreen } from './Components/Screens/TitleScreen'
import { Button } from './Components/Common/Button'

function GameScreen() {
  const { state, returnToTitle } = useGame()

  switch (state.phase) {
    case 'title':
      return <TitleScreen />
    case 'battle':
      return (
        <div className="min-h-screen bg-gray-800 flex flex-col items-center justify-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Battle Screen
          </h2>
          <p className="text-gray-400 mb-8">
            Stage: {state.run?.currentStage} | Gold: {state.run?.gold}G
          </p>
          <Button variant="secondary" onClick={returnToTitle}>
            Return to Title
          </Button>
        </div>
      )
    case 'store':
    case 'event':
    case 'result':
      // TODO: 各画面コンポーネントを実装後に追加
      return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
          <p className="text-white">Phase: {state.phase} (Coming Soon)</p>
        </div>
      )
  }
}

function App() {
  return (
    <GameProvider>
      <GameScreen />
    </GameProvider>
  )
}

export default App
