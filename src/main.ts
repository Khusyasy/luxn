import { StateHandler } from "./core/reactive";

function parseJslike(string: string): unknown {
  // TODO: find safer way to do this
  return new Function(`return ${string}`)()
}

class VNode {
  element
  state

  constructor(element: HTMLElement, state: StateHandler) {
    this.element = element
    this.state = state
  }
}

function recursiveinitApp(element: HTMLElement, state: StateHandler) {
  const vnode = new VNode(element, state)

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
      const fn = new Function("$event", jsLike).bind(state.proxy)
      element.addEventListener(eventName, (e) => fn(e))
    }
    delete dataset[name]
  }

  for (const child of Array.from(element.children)) {
    recursiveinitApp(child as HTMLElement, state)
  }
}

function recursiveSearch(element: HTMLElement) {
  const dataset = element.dataset
  if (dataset['app']) {
    const initialState = parseJslike(dataset['app'])
    if (initialState !== null && typeof initialState == 'object') {
      const state = new StateHandler(initialState)
      const vroot = new VNode(element, state)
      console.log(state, vroot)
      for (const child of Array.from(element.children)) {
        recursiveinitApp(child as HTMLElement, vroot.state)
      }
    }
  } else {
    for (const child of Array.from(element.children)) {
      recursiveSearch(child as HTMLElement)
    }
  }
  delete dataset['app']
}

recursiveSearch(document.body)
