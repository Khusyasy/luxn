type StateProxy = Record<PropertyKey, any> & { __brand: 'StateProxy' }
type AssertNever<T extends never> = T

export function isStateProxy(x: any): x is StateProxy {
  return x && x.__brand === 'StateProxy'
}

type From = 'cb-for' | 'cb-if' | 'cb-model' | 'cb-bind' | 'cb-text' | 'cb-html'
type Handler = () => void
type Callbacks = Record<From, Handler[]>

// 'cb-for' can init app inside loop so it need to be first
// 'cb-if' kinda same as for
// 'cb-model' can write to proxy so it need to update before the other read
// 'cb-bind', 'cb-text', 'cb-html' only read so should update last
const UPDATE_ORDER = ['cb-for', 'cb-if', 'cb-model', 'cb-bind', 'cb-text', 'cb-html'] as const
type Missing = AssertNever<Exclude<From, typeof UPDATE_ORDER[number]>>

export class StateHandler {
  callbacks: Callbacks
  data
  parent
  proxy: StateProxy

  constructor(data: object, parent: StateHandler | null = null) {
    this.callbacks = {
      'cb-for': [],
      'cb-if': [],
      'cb-model': [],
      'cb-bind': [],
      'cb-text': [],
      'cb-html': [],
    }
    this.data = data
    this.parent = parent

    const handler: ProxyHandler<Record<PropertyKey, any>> = {
      get: (target, prop, receiver) => {
        if (prop === '__brand') return 'StateProxy'
        // TODO: i think nested prop doesnt work for parents for now
        if (typeof prop === 'string' && prop.includes('.')) return this.getNestedProp(prop)
        // console.log('get', target, prop, receiver)

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
        for (const from of UPDATE_ORDER) {
          for (const callback of this.callbacks[from]) {
            // console.log(from, callback.toString(), target)
            callback.call(target)
          }
        }
        return result
      },
    }

    this.proxy = new Proxy(data, handler) as StateProxy
  }

  addCallbacks(from: From, handler: Handler) {
    // console.log(from, handler.toString(), this.data)
    this.callbacks[from].push(handler)
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
}
