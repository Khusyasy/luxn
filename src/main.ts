import { StateHandler } from "./core/reactive";

function parseJslike(string: string): unknown {
  // TODO: find safer way to do this
  return new Function(`return ${string}`)()
}

class VNode {
  element
  state
  children: VNode[]

  constructor(element: HTMLElement, state: StateHandler) {
    this.element = element
    this.state = state
    this.children = []
  }
}

function recursiveinitApp(element: HTMLElement, state: StateHandler) {
  const vnode = new VNode(element, state)

  // TODO: handle jsLike so it can use variable directly while keeping reactivity instead of using 'this.'
  const dataset = element.dataset
  for (const [name, jsLike] of Object.entries(dataset)) {
    if (jsLike === undefined) continue
    if (name === 'text') {
      element.innerHTML = `${state.proxy[jsLike]}`
      state.addCallbacks(() => {
        element.innerHTML = `${state.proxy[jsLike]}`
      })
    } else if (name.startsWith('on:')) {
      const eventName = name.slice(3) as keyof HTMLElementEventMap
      const fn = new Function("$event", `${jsLike}`).bind(state.proxy)
      element.addEventListener(eventName, (e) => fn(e))
    } else if (name.startsWith('bind:')) {
      const attrName = name.slice(5)
      const fn = new Function(`return ${jsLike}`).bind(state.proxy)
      element.setAttribute(attrName, fn())
      state.addCallbacks(() => {
        element.setAttribute(attrName, fn())
      })
    } else {
      console.log(`'${name}' is not a valid features, ignored`)
    }
    delete dataset[name]
  }

  for (const child of Array.from(element.children)) {
    const childVNode = recursiveinitApp(child as HTMLElement, state)
    vnode.children.push(childVNode)
  }

  return vnode
}

function recursiveSearch(element: HTMLElement) {
  const dataset = element.dataset
  if (dataset['app']) {
    const initialState = parseJslike(dataset['app'])
    if (initialState !== null && typeof initialState == 'object') {
      const state = new StateHandler(initialState)
      const vroot = new VNode(element, state)
      for (const child of Array.from(element.children)) {
        const vnode = recursiveinitApp(child as HTMLElement, vroot.state)
        vroot.children.push(vnode)
      }
      console.log('initalized app', vroot)
    }
  } else {
    for (const child of Array.from(element.children)) {
      recursiveSearch(child as HTMLElement)
    }
  }
  delete dataset['app']
}

recursiveSearch(document.body)
