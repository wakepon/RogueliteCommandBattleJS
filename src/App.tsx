import { GameProvider, useGame } from './Hooks/UseGame'
import { TitleScreen, ResultScreen, StoreScreen } from './Components/Screens'
import { BattleScreen } from './Components/Battle'

function GameScreen() {
  const { state } = useGame()

  switch (state.phase) {
    case 'title':
      return <TitleScreen />
    case 'battle':
      return <BattleScreen />
    case 'result':
      return <ResultScreen />
    case 'store':
      return <StoreScreen />
    case 'event':
      // TODO: イベント画面コンポーネントを実装後に追加
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
