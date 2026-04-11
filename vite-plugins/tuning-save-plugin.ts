/// <reference types="node" />
import { Plugin } from 'vite'
import { resolve } from 'path'
import { readFile, writeFile } from 'fs/promises'
import { validateTuningData } from '../src/Lib/Tuning/TuningSerializer'

const TUNING_DATA_PATH = resolve(__dirname, '../src/Lib/Data/TuningData.json')
const MAX_BODY_SIZE = 65536

export function tuningSavePlugin(): Plugin {
  return {
    name: 'tuning-save',
    configureServer(server) {
      // TuningData.jsonの変更でHMRが発火しないようにwatchを除外
      server.watcher.unwatch(TUNING_DATA_PATH)

      server.middlewares.use('/api/tuning/save', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        let body = ''
        let aborted = false

        req.on('data', (chunk: Buffer) => {
          if (aborted) return
          body += chunk.toString()
          if (body.length > MAX_BODY_SIZE) {
            aborted = true
            res.statusCode = 413
            res.end(JSON.stringify({ error: 'Payload too large' }))
            req.destroy()
          }
        })

        req.on('end', () => {
          if (aborted) return
          try {
            const raw = JSON.parse(body)

            if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'Invalid data format' }))
              return
            }

            // スキーマに基づいてバリデーション・クランプ
            const validated = validateTuningData(raw)

            writeFile(TUNING_DATA_PATH, JSON.stringify(validated, null, 2) + '\n', 'utf-8')
              .then(() => {
                res.statusCode = 200
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ success: true }))
              })
              .catch((err) => {
                res.statusCode = 500
                res.end(JSON.stringify({ error: String(err) }))
              })
          } catch (e) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: String(e) }))
          }
        })
      })

      // TuningData.jsonの読み込みエンドポイント
      server.middlewares.use('/api/tuning/load', (_req, res) => {
        readFile(TUNING_DATA_PATH, 'utf-8')
          .then((data) => {
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(data)
          })
          .catch((err) => {
            res.statusCode = 500
            res.end(JSON.stringify({ error: String(err) }))
          })
      })
    },
  }
}
