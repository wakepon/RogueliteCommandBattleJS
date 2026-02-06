import { GameProvider, useGame } from './Hooks/UseGame'
import { TitleScreen } from './Components/Screens/TitleScreen'
import { BattleScreen } from './Components/Battle'

function GameScreen() {
  const { state } = useGame()

  switch (state.phase) {
    case 'title':
      return <TitleScreen />
    case 'battle':
      return <BattleScreen />
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
