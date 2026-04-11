import { EditorUI } from './EditorUI'
import { TUNING_SCHEMA_VERSION, TuningChannelMessage } from '../src/Lib/Tuning/TuningConfig'
import { validateTuningData } from '../src/Lib/Tuning/TuningSerializer'

// 状態管理
let _currentState: Record<string, unknown> = {}
let _savedState: Record<string, unknown> = {}
let _dataLoaded = false
let _revision = 0
let _editorUI: EditorUI | null = null

// BroadcastChannel
const _senderId = `editor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const _channel = new BroadcastChannel('game-tuning')

// 接続状態
let _connected = false
// _connectionTimerは接続タイムアウトの管理に使用

/** ゲームタブに状態を送信 */
function sendToGame(type: 'full-sync' | 'batch-update'): void {
  _revision++
  const msg: TuningChannelMessage = {
    type,
    version: TUNING_SCHEMA_VERSION,
    revision: _revision,
    senderId: _senderId,
    state: { ..._currentState },
  }
  _channel.postMessage(msg)
}

/** 接続状態を更新 */
function setConnected(connected: boolean): void {
  _connected = connected
  const el = document.getElementById('connection-status')
  if (el) {
    el.textContent = connected ? '接続中' : '未接続'
    el.className = `status ${connected ? 'connected' : 'disconnected'}`
  }
}

/** BroadcastChannel受信 */
_channel.onmessage = (e: MessageEvent<TuningChannelMessage>) => {
  const msg = e.data
  if (msg.type === 'request-sync') {
    // ゲームタブが同期をリクエスト
    setConnected(true)
    if (_dataLoaded) {
      sendToGame('full-sync')
    }
  }
}

/** ツールバーを描画 */
function renderToolbar(): void {
  const toolbar = document.getElementById('toolbar')!

  // 接続状態
  const status = document.createElement('span')
  status.id = 'connection-status'
  status.className = 'status disconnected'
  status.textContent = '未接続'
  toolbar.appendChild(status)

  toolbar.appendChild(createSpacer())

  // 全リセットボタン
  const resetBtn = createButton('全リセット', 'btn btn-danger', handleReset)
  toolbar.appendChild(resetBtn)

  // 保存ボタン
  const saveBtn = createButton('保存', 'btn btn-primary', handleSave)
  toolbar.appendChild(saveBtn)

  // Exportボタン
  const exportBtn = createButton('Export', 'btn', handleExport)
  toolbar.appendChild(exportBtn)

  // Importボタン
  const importBtn = createButton('Import', 'btn', handleImportClick)
  toolbar.appendChild(importBtn)

  // 隠しファイル入力
  const fileInput = document.createElement('input')
  fileInput.type = 'file'
  fileInput.id = 'import-input'
  fileInput.accept = '.json'
  fileInput.addEventListener('change', handleImport)
  toolbar.appendChild(fileInput)
}

function createSpacer(): HTMLElement {
  const spacer = document.createElement('div')
  spacer.className = 'toolbar-spacer'
  return spacer
}

function createButton(text: string, className: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.textContent = text
  btn.className = className
  btn.addEventListener('click', onClick)
  return btn
}

/** 保存処理 */
async function handleSave(): Promise<void> {
  if (!_dataLoaded) return

  try {
    const res = await fetch('/api/tuning/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(_currentState, null, 2),
    })

    if (res.ok) {
      _savedState = { ..._currentState }
      _editorUI?.updateState(_currentState, _savedState)
      showNotification('保存しました')
    } else {
      const err = await res.json()
      showNotification(`保存失敗: ${err.error}`, true)
    }
  } catch (e) {
    showNotification(`保存失敗: ${e}`, true)
  }
}

/** 全リセット処理 */
function handleReset(): void {
  _currentState = { ..._savedState }
  _editorUI?.updateState(_currentState, _savedState)
  sendToGame('full-sync')
  showNotification('リセットしました')
}

/** Export処理 */
function handleExport(): void {
  const blob = new Blob([JSON.stringify(_currentState, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `tuning-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/** Importクリック処理 */
function handleImportClick(): void {
  const input = document.getElementById('import-input') as HTMLInputElement
  input.value = ''
  input.click()
}

/** Import処理 */
function handleImport(e: Event): void {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    try {
      const raw = JSON.parse(reader.result as string)
      const validated = validateTuningData(raw)
      _currentState = validated
      _editorUI?.updateState(_currentState, _savedState)
      sendToGame('full-sync')
      showNotification('インポートしました')
    } catch (err) {
      showNotification(`インポート失敗: ${err}`, true)
    }
  }
  reader.readAsText(file)
}

/** 通知表示 */
function showNotification(message: string, isError = false): void {
  const existing = document.querySelector('.notification')
  if (existing) existing.remove()

  const notification = document.createElement('div')
  notification.className = 'notification'
  notification.style.cssText = `
    position: fixed; bottom: 20px; right: 20px;
    padding: 10px 20px; border-radius: 6px;
    background: ${isError ? '#5c0a0a' : '#1b4332'};
    color: ${isError ? '#f8a0a0' : '#95d5b2'};
    font-size: 14px; z-index: 1000;
    animation: fadeIn 0.2s ease;
  `
  notification.textContent = message
  document.body.appendChild(notification)

  setTimeout(() => notification.remove(), 2000)
}

/** エディタ初期化 */
async function init(): Promise<void> {
  try {
    // TuningData.jsonを読み込み
    const res = await fetch('/api/tuning/load')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const raw = await res.json()
    const validated = validateTuningData(raw)
    _currentState = validated
    _savedState = { ...validated }
    _dataLoaded = true

    // ツールバー描画
    renderToolbar()

    // エディタUI描画
    const sidebar = document.getElementById('sidebar')!
    const content = document.getElementById('content')!

    _editorUI = new EditorUI(
      sidebar,
      content,
      (key, value) => {
        _currentState[key] = value
        sendToGame('batch-update')
      },
      _currentState,
      _savedState,
    )

    // ゲームタブへ初期同期を送信
    sendToGame('full-sync')

    // 接続確認: 2秒以内にゲームタブからの応答がなければ未接続
    setTimeout(() => {
      if (!_connected) setConnected(false)
    }, 2000)

  } catch (e) {
    console.error('Tuning Editor init failed:', e)
    const content = document.getElementById('content')!
    content.innerHTML = `<p style="color: #f88; padding: 20px;">初期化に失敗しました: ${e}</p>`
  }
}

init()
