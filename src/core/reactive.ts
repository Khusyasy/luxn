type StateProxy = Record<PropertyKey, any> & { __brand: 'StateProxy' }

export function isStateProxy(x: any): x is StateProxy {
  return x && x.__brand === 'StateProxy'
}

type Handler = () => void
type Callbacks = Handler[]

export class StateHandler {
  callbacks: Callbacks
  data
  parent
  tracking: boolean
  trackedProps: Set<string>
  proxy: StateProxy

  constructor(data: object, parent: StateHandler | null = null) {
    this.callbacks = []
    this.data = data
    this.parent = parent
    this.tracking = false
    this.trackedProps = new Set()

    const handler: ProxyHandler<Record<PropertyKey, any>> = {
      get: (target, prop, receiver) => {
        if (prop === '__brand') return 'StateProxy'
        // console.log('set', prop, receiver)

        if (prop in target) {
          const value = Reflect.get(target, prop, receiver)
          if (value !== null && typeof value === 'object') {
            return new Proxy(value, handler) as StateProxy
          }
          return value
        }

        if (this.parent) {
          if (prop in this.parent.data) {
            return this.parent.proxy[prop]
          }
        }

        return undefined
      },
      set: (target, prop, value, receiver) => {
        // console.log('set', prop, value, receiver)

        if (prop in target) {
          const result = Reflect.set(target, prop, value, receiver)

          for (const callback of this.callbacks) {
            // console.log('callback', prop, callback.toString())
            console.log('callback')
            callback.call(target)
          }

          return result
        }

        if (this.parent) {
          if (prop in this.parent.data) {
            const result = Reflect.set(this.parent.proxy, prop, value)
            return result
          }
        }


        return false
      },
    }

    this.proxy = new Proxy(data, handler) as StateProxy
  }

  getDot(s: string): any {
    const props = s.split('.')
    let current: any = this.proxy
    for (const prop of props) {
      const next = current[prop]
      current = next
    }
    return current
  }

  setDot(s: string, value: any): boolean {
    const props = s.split('.')
    const key = props.pop()
    if (!key) return false

    let current: any = this.proxy
    for (const prop of props) {
      const next = current[prop]
      current = next
    }
    return current[key] = value
  }

  addCallbacks(handler: Handler) {
    this.callbacks.push(handler)
  }
}
