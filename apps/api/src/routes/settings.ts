import express from 'express'
import { getDatabase } from '../database'

const router = express.Router()

const SECTIONS = new Set(['general','security','notifications','cameras','ai','storage'])

router.get('/', async (_req, res) => {
  try {
    const db = getDatabase()
    const rows = await db.all<{ key: string; value: string }>('SELECT key, value FROM system_settings')
    const settings: Record<string, any> = {}
    for (const row of rows) {
      if (SECTIONS.has(row.key)) {
        try {
          settings[row.key] = JSON.parse(row.value)
        } catch {
          settings[row.key] = row.value
        }
      }
    }
    res.json(settings)
  } catch (error) {
    console.error('Get settings error:', error)
    res.status(500).json({ error: 'Internal server error.' })
  }
})

router.put('/:section', async (req, res) => {
  try {
    const section = String(req.params.section)
    if (!SECTIONS.has(section)) {
      return res.status(400).json({ error: 'Invalid settings section.' })
    }
    const db = getDatabase()
    const json = JSON.stringify(req.body ?? {})
    await db.run(
      'INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP',
      [section, json]
    )
    res.json({ saved: true })
  } catch (error) {
    console.error('Save settings error:', error)
    res.status(500).json({ error: 'Internal server error.' })
  }
})

export default router
