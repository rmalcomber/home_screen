import { historyItems } from '../../core/extensions/host.js'
import { parseCronCommand } from './engine.js'
import { CronPanel } from './Panel.jsx'

// Cron explainer: "cron */5 * * * *", "@daily", or just paste an expression like "0 9 * * 1-5". Plain-English description,
// per-field breakdown and the next run times (local or UTC). Standard 5-field, Spring/Quartz/AWS flavours, L/W/# specials.
export default {
  items(q) {
    if (!q.trim()) return historyItems('cron', 'Cron', 'iconify:fa6-solid:clock-rotate-left')
    const data = parseCronCommand(q)
    if (!data) return []
    return [{ key: 'cron:' + q, title: 'Cron explainer', kind: 'cron', icon: 'iconify:fa6-solid:clock-rotate-left', panel: CronPanel, hint: 'Enter: copy description', data }]
  },
}
