const h = require('mutant/html-element')
const computed = require('mutant/computed')
const Value = require('mutant/value')
const humanTime = require('human-time')
const WatchMerged = require('tre-prototypes')
const deepEqual = require('deep-equal')

module.exports = function(ssb, opts) {
  opts = opts || {}
  const watchMerged = WatchMerged(ssb)
  const canAutoUpdate = opts.canAutoUpdate || Value(false)

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

      const blobRef = kvm.value.content.codeBlob
      const codeChanged = content.codeBlob !== blobRef

      const blobAvailable = Value(true)
      if (codeChanged) {
        blobAvailable.set(false)
        console.log('webapp: wanting blob', blobRef)
        ssb.blobs.want(blobRef, (err, has) => {
          if (err) return console.error(err.message)
          blobAvailable.set(has)
        })
      }

      const buttonLabel = codeChanged ? `Update to ${kvm.key.substr(0,6)}` : (configChanged ? 'Reload Config' : '')

      const seconds = Value()


      function reload() {
        document.location.pathname='/boot/' + encodeURIComponent(kvm.key)
      }

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
        !codeChanged ? [] : computed([blobAvailable, canAutoUpdate], (has, auto) => {
          if (has) {
            if (auto) return reload()
            return h('button', {
              style: { opacity: buttonLabel ? 1 : 0 },
              'ev-click': e => {
                reload()
              },
            }, buttonLabel)
          } else {
            return h('span', 'loading')
          }
        }),
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
