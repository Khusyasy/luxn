import { StateHandler } from "./core/reactive";

function parseJslike(string: string): any {
  // TODO: find safer way to do this
  // console.log(parseJslike, string)
  return new Function(`return ${string}`)()
}

class VNode {
  state
  element
  children: VNode[]

  constructor(state: StateHandler, element: HTMLElement) {
    this.state = state
    this.element = element
    this.children = []
  }
}

function recursiveinitApp(state: StateHandler, element: HTMLElement) {
  const vNode = new VNode(state, element)

  // TODO: handle jsLike so it can use variable directly while keeping reactivity instead of using 'this.'
  const dataset = element.dataset
  // console.log(element, dataset)
  for (const [name, jsLike] of Object.entries(dataset)) {
    if (jsLike === undefined) continue
    if (name === 'text') {
      // data-text
      element.innerText = `${state.proxy[jsLike]}`
      state.addCallbacks(() => {
        element.innerText = `${state.proxy[jsLike]}`
      })
    } else if (name === 'html') {
      // data-html
      element.innerHTML = `${jsLike}`
      state.addCallbacks(() => {
        element.innerHTML = `${jsLike}`
      })
    } else if (name === 'model') {
      // data-model
      if (!(element instanceof HTMLInputElement)) {
        throw new Error(`'data-model' can only be used in input elements`)
      }
      const formElementSet = () => {
        if (element.type === 'checkbox') {
          element.checked = state.proxy[jsLike]
        } else { // default for all input type
          element.value = state.proxy[jsLike]
        }
      }
      const formElementGet = () => {
        if (element.type === 'checkbox') {
          state.proxy[jsLike] = element.checked
        } else { // default for all input type
          state.proxy[jsLike] = element.value
        }
      }

      formElementSet()
      state.addCallbacks(() => {
        formElementSet()
      })
      element.addEventListener('input', () => {
        formElementGet()
      })
    } else if (name === 'for') {
      // data-for
      if (!(element instanceof HTMLTemplateElement)) {
        throw new Error(`'data-for' can only be used in template elements`)
      }
      const [lhs, rhs] = jsLike.split(' in ')
      if (!lhs || !rhs) throw new Error(`expression must be 'x in y'`)
      const updateFor = () => {
        const iterable = state.proxy[rhs]
        if (!(iterable instanceof Array)) throw new Error('must be array')
        for (const value of iterable) {
          // setup the x = values from y
          // TODO: check like is this good idea? is there a way to not make a new state everytime
          // this doesnt break reactivity lol? check again later
          const stateFor = new StateHandler(Object.assign({}, state.data))
          // console.log(state, stateFor, Object.assign({}, state.data))
          stateFor.proxy[lhs] = value
          const clonedTemplate = element.content.cloneNode(true) as DocumentFragment
          // DocumentFragment cannot be used as HTMLElement, we have to get the child manually
          for (const child of Array.from(clonedTemplate.children)) {
            const vForNode = recursiveinitApp(stateFor, child as HTMLElement)
            vNode.children.push(vForNode)
            element.insertAdjacentElement('beforebegin', child)
          }
        }
      }
      updateFor()
      state.addCallbacks(() => {
        vNode.children.forEach(child => child.element.remove())
        vNode.children = []
        updateFor()
      })
    } else if (name.startsWith('on:')) {
      // data-on:
      const eventName = name.slice(3) as keyof HTMLElementEventMap
      const fn = new Function("$event", `${jsLike}`).bind(state.proxy)
      element.addEventListener(eventName, (e) => fn(e))
    } else if (name.startsWith('bind:')) {
      // data-bind:
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
    const vChildNode = recursiveinitApp(state, child as HTMLElement)
    vNode.children.push(vChildNode)
  }

  return vNode
}

function initApp(element: HTMLElement) {
  const dataset = element.dataset
  if (dataset['app']) {
    const initialState = parseJslike(dataset['app'])
    if (initialState !== null && typeof initialState == 'object') {
      const state = new StateHandler(initialState)
      const vRoot = new VNode(state, element)
      for (const child of Array.from(element.children)) {
        const vNode = recursiveinitApp(vRoot.state, child as HTMLElement)
        vRoot.children.push(vNode)
      }
      console.log('initalized app', vRoot)
    }
  }
  delete dataset['app']
}

function main() {
  const dataAppEl = document.querySelectorAll('[data-app]')
  dataAppEl.forEach(element => initApp(element as HTMLElement))
}

main()
