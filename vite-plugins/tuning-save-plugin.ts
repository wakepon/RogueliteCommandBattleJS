/// <reference types="node" />
import { Plugin } from 'vite'
import { resolve } from 'path'
import { readFileSync, writeFileSync } from 'fs'

const TUNING_DATA_PATH = resolve(__dirname, '../src/Lib/Data/TuningData.json')

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
        req.on('data', (chunk: Buffer) => {
          body += chunk.toString()
        })

        req.on('end', () => {
          try {
            // JSONとしてパース（バリデーション）
            const data = JSON.parse(body)

            if (typeof data !== 'object' || data === null || Array.isArray(data)) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'Invalid data format' }))
              return
            }

            // TuningData.jsonに書き出し
            writeFileSync(TUNING_DATA_PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8')

            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: true }))
          } catch (e) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: String(e) }))
          }
        })
      })

      // TuningData.jsonの読み込みエンドポイント
      server.middlewares.use('/api/tuning/load', (_req, res) => {
        try {
          const data = readFileSync(TUNING_DATA_PATH, 'utf-8')
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(data)
        } catch (e) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: String(e) }))
        }
      })
    },
  }
}
