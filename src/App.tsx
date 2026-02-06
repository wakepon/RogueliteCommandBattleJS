import { GameProvider, useGame } from './Hooks/UseGame'
import { TitleScreen, ResultScreen, StoreScreen, EventScreen } from './Components/Screens'
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
      return <EventScreen />
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
