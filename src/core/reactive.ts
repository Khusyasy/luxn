type StateProxy = Record<PropertyKey, any> & { __brand: 'StateProxy' }
type AssertNever<T extends never> = T

export function isStateProxy(x: any): x is StateProxy {
  return x && x.__brand === 'StateProxy'
}

type Handler = () => void
type Callbacks = Record<string, Handler[]>

export class StateHandler {
  callbacks: Callbacks
  data
  parent
  tracking: boolean
  trackedProps: Set<string>
  proxy: StateProxy

  constructor(data: object, parent: StateHandler | null = null) {
    this.callbacks = {}
    this.data = data
    this.parent = parent
    this.tracking = false
    this.trackedProps = new Set()

    const handler: ProxyHandler<Record<PropertyKey, any>> = {
      get: (target, prop, receiver) => {
        if (prop === '__brand') return 'StateProxy'
        // TODO: i think nested prop doesnt work for parents for now
        if (typeof prop === 'string' && prop.includes('.')) return this.getNestedProp(prop)
        // console.log('get', target, prop, receiver)

        if (typeof prop === 'string' && this.tracking) {
          this.trackedProps.add(prop)
        }

        if (prop in target) {
          const value = Reflect.get(target, prop, receiver)
          if (value !== null && typeof value === 'object') {
            return new Proxy(value, handler) as StateProxy
          }
          return value
        }

        if (this.parent) {
          return this.parent.proxy[prop]
        }

        return undefined
      },
      set: (target, prop, value, receiver) => {
        // console.log('set', target, prop, value, receiver)
        let result: boolean;
        if (typeof prop === 'string' && prop.includes('.')) {
          const path = prop.split('.').pop() || ''
          const proxy = this.getNestedProxy(prop)
          result = Reflect.set(proxy, path, value)
        } else {
          result = Reflect.set(target, prop, value, receiver)
        }
        if (typeof prop === 'string' && this.callbacks[prop]) {
          for (const callback of this.callbacks[prop]) {
            // console.log('callback', prop, callback.toString())
            // console.log('callback')
            callback.call(target)
          }
        }
        return result
      },
    }

    this.proxy = new Proxy(data, handler) as StateProxy
  }

  addCallbacks(depends: string[], handler: Handler) {
    for (const depend of depends) {
      if (depend === 'constructor') continue  // special case, mungkin ada lagi yang lain?
      if (!this.callbacks[depend]) {
        this.callbacks[depend] = []
      }
      this.callbacks[depend].push(handler)
    }
  }

  getNestedProp(prop: string) {
    const paths = prop.split('.')

    let curr: any = this.proxy
    for (const path of paths) {
      if (isStateProxy(curr)) {
        const next = curr[path]
        curr = next
      }
    }

    return curr
  }

  getNestedProxy(prop: string) {
    const paths = prop.split('.')

    let curr = this.proxy
    for (const path of paths) {
      const next = curr[path]
      if (isStateProxy(next)) {
        curr = next
      }
    }

    return curr
  }

  startTracking() {
    this.trackedProps.clear()
    this.tracking = true
  }

  stopTracking(): string[] {
    this.tracking = true
    return Array.from(this.trackedProps)
  }
}
