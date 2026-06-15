import { GameProvider, useGame } from './Hooks/UseGame'
import { TitleScreen, ResultScreen, RecoveryScreen, StoreScreen, EventScreen, MapScreen } from './Components/Screens'
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
    case 'recovery':
      return <RecoveryScreen />
    case 'store':
      return <StoreScreen />
    case 'event':
      return <EventScreen />
    case 'map':
      return <MapScreen />
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
