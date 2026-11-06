// A fictional "Acme" workspace used for every screenshot. Nothing here is real data.
const L = (title, url) => ({ title, url })

export const TILES = [
  // ---- row A: the daily-driver tiles
  {
    key: 'services', x: 0, y: 0, w: 5, h: 12,
    tile: {
      type: 'dev', title: 'Acme Platform', icon: 'iconify:fa6-solid:cubes',
      config: {
        services: [
          { name: 'Checkout API', dev: 'https://checkout.dev.acme.dev', stage: 'https://checkout.stage.acme.dev', prod: 'https://checkout.acme.dev' },
          { name: 'Auth service', dev: 'https://auth.dev.acme.dev', stage: 'https://auth.stage.acme.dev', prod: 'https://auth.acme.dev' },
          { name: 'Billing', dev: 'https://billing.dev.acme.dev', stage: 'https://billing.stage.acme.dev', prod: 'https://billing.acme.dev' },
          { name: 'Web app', dev: 'https://app.dev.acme.dev', stage: 'https://app.stage.acme.dev', prod: 'https://app.acme.dev' },
        ],
      },
    },
  },
  {
    key: 'github', x: 5, y: 0, w: 4, h: 12,
    tile: {
      type: 'github', title: 'GitHub · acme-corp', icon: 'iconify:fa6-brands:github',
      config: { owner: 'acme-corp', repos: ['checkout-api', 'auth-service', 'billing', 'web-app', 'infra', 'design-system', 'mobile-app', 'docs'].map((url) => ({ url })) },
    },
  },
  {
    key: 'aws', x: 9, y: 0, w: 3, h: 12,
    tile: {
      type: 'bookmarks', title: 'AWS', icon: 'iconify:fa6-brands:aws',
      config: {
        links: [
          L('Console home', 'https://aws.amazon.com/console/'),
          L('EC2 · running instances', 'https://aws.amazon.com/ec2/'),
          L('CloudWatch · log groups', 'https://aws.amazon.com/cloudwatch/'),
          L('S3 · buckets', 'https://aws.amazon.com/s3/'),
          L('RDS · databases', 'https://aws.amazon.com/rds/'),
          L('ECR · repositories', 'https://aws.amazon.com/ecr/'),
          L('IAM · roles', 'https://aws.amazon.com/iam/'),
        ],
      },
    },
  },
  // ---- row B: queries, trackers, pipelines, internal tools
  {
    key: 'datadog', x: 0, y: 12, w: 3, h: 12,
    tile: {
      type: 'bookmarks', title: 'Datadog', icon: 'iconify:simple-icons:datadog',
      config: {
        links: [
          L('Checkout latency p99', 'https://www.datadoghq.com/dashboards/'),
          L('APM · service map', 'https://www.datadoghq.com/product/apm/'),
          L('Logs · env:prod status:error', 'https://www.datadoghq.com/product/log-management/'),
          L('Monitors · alerting now', 'https://www.datadoghq.com/product/monitors/'),
          L('Infra · hosts', 'https://www.datadoghq.com/product/infrastructure-monitoring/'),
          L('RUM · web vitals', 'https://www.datadoghq.com/product/real-user-monitoring/'),
          L('SLOs', 'https://www.datadoghq.com/product/service-level-objectives/'),
        ],
      },
    },
  },
  {
    key: 'jira', x: 3, y: 12, w: 3, h: 12,
    tile: {
      type: 'bookmarks', title: 'Jira', icon: 'iconify:simple-icons:jira',
      config: {
        links: [
          L('My open issues', 'https://www.atlassian.com/software/jira'),
          L('Sprint board', 'https://www.atlassian.com/software/jira/guides/boards'),
          L('Backlog', 'https://www.atlassian.com/software/jira/guides/backlogs'),
          L('Bugs this week', 'https://www.atlassian.com/software/jira/guides/issues'),
          L('Release 4.2 scope', 'https://www.atlassian.com/software/jira/guides/releases'),
          L('Support escalations', 'https://www.atlassian.com/software/jira/service-management'),
        ],
      },
    },
  },
  {
    key: 'devops', x: 6, y: 12, w: 3, h: 12,
    tile: {
      type: 'bookmarks', title: 'Azure DevOps', icon: 'iconify:simple-icons:azuredevops',
      config: {
        links: [
          L('Pipelines · all', 'https://dev.azure.com/acme/platform/_build'),
          L('Release pipelines', 'https://dev.azure.com/acme/platform/_release'),
          L('Repos · checkout-api', 'https://dev.azure.com/acme/platform/_git/checkout-api'),
          L('Package feed · npm', 'https://dev.azure.com/acme/platform/_artifacts/feed/npm-internal'),
          L('Work items · assigned to me', 'https://dev.azure.com/acme/platform/_workitems/assignedtome'),
          L('Test plans', 'https://dev.azure.com/acme/platform/_testManagement'),
        ],
      },
    },
  },
  {
    key: 'internal', x: 9, y: 12, w: 3, h: 12,
    tile: {
      type: 'bookmarks', title: 'Internal tools', icon: 'iconify:fa6-solid:toolbox',
      config: {
        links: [
          L('Engineering wiki', 'https://wiki.acme.dev'),
          L('Status page', 'https://status.acme.dev'),
          L('On-call rota', 'https://oncall.acme.dev'),
          L('Feature flags', 'https://flags.acme.dev'),
          L('Secrets vault', 'https://vault.acme.dev'),
          L('Staff directory', 'https://people.acme.dev'),
        ],
      },
    },
  },
  // ---- row C: widgets
  {
    key: 'clock', x: 0, y: 24, w: 5, h: 8,
    tile: {
      type: 'widget', title: 'Team time zones', icon: 'iconify:fa6-solid:clock',
      config: { kind: 'clock', zones: [{ tz: '', label: 'Home' }, { tz: 'America/New_York', label: 'New York' }, { tz: 'Asia/Kolkata', label: 'Bengaluru' }, { tz: 'Australia/Sydney', label: 'Sydney' }], hour12: false, seconds: false, layout: 'tiles' },
    },
  },
  {
    key: 'weather', x: 5, y: 24, w: 4, h: 8,
    tile: {
      type: 'widget', title: 'Weather', icon: 'iconify:fa6-solid:cloud-sun',
      config: { kind: 'weather', locations: [{ city: 'London' }, { city: 'New York' }, { city: 'Tokyo' }], fahrenheit: false, layout: 'tiles' },
    },
  },
  {
    key: 'countdown', x: 9, y: 24, w: 3, h: 8,
    tile: { type: 'widget', title: 'Release 4.2', icon: 'iconify:fa6-solid:hourglass-half', config: { kind: 'countdown', label: 'Release 4.2 ships', date: '2026-12-01' } },
  },
  {
    key: 'todo', x: 0, y: 32, w: 3, h: 13,
    tile: {
      type: 'widget', title: 'Todo list', icon: 'iconify:fa6-solid:list-check',
      config: {
        kind: 'todo',
        items: [
          { id: 1, text: 'Review checkout-api PR #482', done: true },
          { id: 2, text: 'Rotate staging API keys', done: false },
          { id: 3, text: 'Update the runbook for failover', done: false },
          { id: 4, text: 'Reply to the Datadog billing email', done: false },
          { id: 5, text: 'Book travel for the offsite', done: true },
        ],
      },
    },
  },
  {
    key: 'notes', x: 3, y: 32, w: 3, h: 13,
    tile: {
      type: 'widget', title: 'Notes', icon: 'iconify:fa6-solid:note-sticky',
      config: { kind: 'notes', text: 'Standup\n- checkout latency regression is fixed in 4.1.3\n- billing migration freezes Thursday\n\nIdeas\n- bookmark the failing pipeline queries\n- ask platform about the new feed URL' },
    },
  },
  {
    key: 'carousel', x: 6, y: 32, w: 3, h: 13,
    tile: { type: 'widget', title: 'Inspiration', icon: 'iconify:fa6-solid:images', config: { kind: 'carousel', images: [], seconds: 6, fit: 'cover' } },
  },
  {
    key: 'tabata', x: 9, y: 32, w: 3, h: 13,
    tile: { type: 'widget', title: 'Tabata timer', icon: 'iconify:fa6-solid:stopwatch', config: { kind: 'tabata', prepare: 10, work: 20, rest: 10, rounds: 8, sound: true } },
  },
  // ---- row D: extra widgets used for their own screenshots
  { key: 'colour', x: 0, y: 45, w: 3, h: 19, tile: { type: 'widget', title: 'Colour picker', icon: 'iconify:fa6-solid:palette', config: { kind: 'colorpicker', color: '#4f9d69', alpha: 1, history: ['#4f9d69', '#e8b64a', '#d1495b', '#3b82f6'] } } },
  { key: 'hash', x: 3, y: 45, w: 3, h: 12, tile: { type: 'widget', title: 'Hash generator', icon: 'iconify:fa6-solid:hashtag', config: { kind: 'tool-hash' } } },
  { key: 'json', x: 6, y: 45, w: 6, h: 16, tile: { type: 'widget', title: 'JSON formatter', icon: 'iconify:fa6-solid:code', config: { kind: 'tool-json' } } },
  { key: 'clockList', x: 3, y: 57, w: 3, h: 8, tile: { type: 'widget', title: 'Local and UTC', icon: 'iconify:fa6-solid:clock', config: { kind: 'clock', zones: [{ tz: '', label: 'Local' }, { tz: 'UTC', label: 'UTC' }], hour12: false, seconds: true, layout: 'list' } } },
  { key: 'weatherList', x: 0, y: 65, w: 4, h: 10, tile: { type: 'widget', title: 'Weather (list)', icon: 'iconify:fa6-solid:cloud-sun', config: { kind: 'weather', locations: [{ city: 'London' }, { city: 'Sydney' }, { city: 'Reykjavik' }], fahrenheit: false, layout: 'list' } } },
]

/** A small Chrome-style bookmarks export for the import screenshot. */
export const BOOKMARKS_HTML = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
<DT><H3>Work</H3><DL><p>
<DT><A HREF="https://github.com/acme-corp/checkout-api">checkout-api</A>
<DT><A HREF="https://github.com/acme-corp/billing/pulls">billing pull requests</A>
<DT><A HREF="https://docs.github.com/en/actions">GitHub Actions docs</A>
<DT><A HREF="https://console.aws.amazon.com/ec2/home">EC2</A>
<DT><A HREF="https://s3.console.aws.amazon.com/s3/buckets">S3</A>
<DT><A HREF="https://us-east-1.console.aws.amazon.com/cloudwatch/home">CloudWatch</A>
<DT><A HREF="https://www.atlassian.com/software/jira/guides/boards">Sprint board</A>
<DT><A HREF="https://www.atlassian.com/software/confluence">Engineering space</A>
<DT><A HREF="https://app.datadoghq.com/monitors/manage">Monitors</A>
<DT><A HREF="https://docs.datadoghq.com/logs/">Datadog log docs</A>
<DT><A HREF="https://www.bbc.co.uk/news">BBC News</A>
<DT><A HREF="https://news.bbc.co.uk/sport">BBC Sport</A>
<DT><A HREF="https://www.youtube.com/watch?v=abc">Rust in 100 seconds</A>
<DT><A HREF="https://www.youtube.com/watch?v=def">Postgres internals</A>
<DT><A HREF="https://stackoverflow.com/questions/1">How to rebase</A>
<DT><A HREF="https://stackoverflow.com/questions/2">Cron syntax</A>
</DL><p>
</DL><p>
`

/** Colours for a few tiles on the main page (palette names from web/src/colors.js). */
export const COLORS = { services: 'blue', aws: 'amber', datadog: 'violet', github: 'slate' }

/** A second page in three-column mode: coloured groups holding tiles, for the groups and layout screenshots. */
export const TEAM_BOARD = {
  page: { name: 'Team board', mode: 'columns', cols: 3 },
  groups: [
    {
      title: 'Platform', color: 'blue', icon: 'iconify:fa6-solid:layer-group',
      children: [
        { type: 'dev', title: 'Checkout API', h: 8, icon: 'iconify:fa6-solid:cart-shopping', config: { services: [{ name: 'Checkout API', dev: 'https://checkout.dev.acme.dev', stage: 'https://checkout.stage.acme.dev', prod: 'https://checkout.acme.dev' }] } },
        { type: 'bookmarks', title: 'Runbooks', h: 9, config: { links: [L('Incident response', 'https://sre.google/sre-book/managing-incidents/'), L('Rollback checklist', 'https://docs.github.com/en/actions'), L('Capacity planning', 'https://aws.amazon.com/ec2/'), L('Postmortem template', 'https://www.atlassian.com/software/confluence')] } },
      ],
    },
    {
      title: 'Delivery', color: 'green', icon: 'iconify:fa6-solid:truck-fast',
      children: [
        { type: 'github', title: 'Repositories', h: 9, config: { owner: 'acme-corp', repos: ['checkout-api', 'billing', 'infra'].map((url) => ({ url })) } },
        { type: 'bookmarks', title: 'Pipelines', h: 8, config: { links: [L('checkout-api · main', 'https://dev.azure.com/'), L('billing · release', 'https://dev.azure.com/'), L('infra · plan', 'https://dev.azure.com/')] } },
      ],
    },
    {
      title: 'On call', color: 'amber', icon: 'iconify:fa6-solid:bell',
      children: [
        { type: 'bookmarks', title: 'Dashboards', h: 8, config: { links: [L('Checkout latency', 'https://www.datadoghq.com/dashboards/'), L('Error budget', 'https://www.datadoghq.com/product/service-level-objectives/'), L('Pager schedule', 'https://www.atlassian.com/software/jira')] } },
        { type: 'widget', title: 'Handover notes', h: 9, icon: 'iconify:fa6-solid:note-sticky', config: { kind: 'notes', text: 'Handover\n- billing migration freezes Thursday\n- watch checkout p99 after the 4.1.3 deploy' } },
      ],
    },
  ],
}
