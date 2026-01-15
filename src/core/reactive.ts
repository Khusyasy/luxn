type StateProxy = Record<PropertyKey, any> & { __brand: 'StateProxy' }

export function isStateProxy(x: any): x is StateProxy {
  return x && x.__brand === 'StateProxy'
}

export class StateHandler {
  callbacks: Function[]
  data: object
  proxy: StateProxy

  constructor(data: object) {
    this.callbacks = []
    this.data = data

    const handler: ProxyHandler<Record<PropertyKey, any>> = {
      get: (target, prop, receiver) => {
        if (prop === '__brand') return 'StateProxy'
        if (typeof prop === 'string' && prop.includes('.')) return this.getNestedProp(prop)
        // console.log('get', target, prop, receiver)

        const value = Reflect.get(target, prop, receiver)
        if (value !== null && typeof value === 'object') {
          return new Proxy(value, handler) as StateProxy
        }
        return value
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
        for (const callback of this.callbacks) {
          callback.call(target, prop, value)
        }
        return result
      },
    }

    this.proxy = new Proxy(data, handler) as StateProxy
  }

  addCallbacks(callback: Function) {
    // console.log('addCallbacks', callback)
    this.callbacks.push(callback)
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
