export function createReactive<T extends object>(
  object: T,
  callback: Function
) {
  const handler: ProxyHandler<T> = {
    get: (target, prop, receiver) => {
      const value = Reflect.get(target, prop, receiver)
      if (value !== null && typeof value === 'object') {
        return new Proxy(value, handler as ProxyHandler<object>)
      }
      return value
    },
    set: (target, prop, value, receiver) => {
      const result = Reflect.set(target, prop, value, receiver)
      callback()
      return result
    },
  }

  return new Proxy<T>(object, handler)
}
