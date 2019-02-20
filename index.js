const h = require('mutant/html-element')
const computed = require('mutant/computed')
const Value = require('mutant/value')
const humanTime = require('human-time')
const WatchMerged = require('tre-prototypes')
const deepEqual = require('deep-equal')

module.exports = function(ssb, opts) {
  opts = opts || {}
  const watchMerged = WatchMerged(ssb)

  return function renderWebapp(kv, ctx) {
    ctx = ctx || {}
    const content = kv.value && kv.value.content
    if (content.type !== 'webapp') return
    const revRoot = revisionRoot(unmergeKv(kv))
    if (!revRoot) return

    const mergedObs = watchMerged(revRoot)

    return computed(mergedObs, kvm => {
      if (!kvm) return []

      const configChanged = !deepEqual(
        content.config || {},
        kvm.value.content.config || {}
      )

      const codeChanged = content.codeBlob !== kvm.value.content.codeBlob

      const buttonLabel = codeChanged ? `Update to ${kvm.key.substr(0,6)}` : (configChanged ? 'Reload Config' : '')

      const seconds = Value()

      return h('.tre-webapp', {
        hooks: [el => {
          const id = setInterval( ()=> seconds.set(Date.now()), 1000)
          return el => clearInterval(id)
        }]
      }, [
        h('.title', [
          h('.name', content.name),
          h('.branch', content.repositoryBranch),
        ]),
        h('.version', kv.key.substr(0,6)),
        h('button', {
          style: { opacity: buttonLabel ? 1 : 0 },
          'ev-click': e => {
            document.location.pathname='/boot/' + encodeURIComponent(kvm.key)
          },
        }, buttonLabel),
        h('.deployed', computed(seconds, s => humanTime(new Date(kv.value.timestamp))))
      ])
    })

  }
}

// ---

function revisionRoot(kv) {
  return kv && kv.value.content && kv.value.content.revisionRoot || kv.key
}

function unmergeKv(kv) {
  // if the message has prototypes and they were merged into this message value,
  // return the unmerged/original value
  return kv && kv.meta && kv.meta['prototype-chain'] && kv.meta['prototype-chain'][0] || kv
}
