import { StateHandler } from "./core/reactive";

function parseStrAsJsObject(string: string): any {
  // TODO: find safer way to do this
  return new Function(`return ${string}`)()
}

function parseStrAsJsLike(string: string, state: StateHandler) {
  return new Function(`return ${string}`).bind(state.proxy)
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
      state.startTracking()
      element.innerText = `${state.proxy[jsLike]}`
      const depends = state.stopTracking()
      state.addCallbacks(depends, () => {
        element.innerText = `${state.proxy[jsLike]}`
      })
    } else if (name === 'html') {
      // data-html
      // TODO: fix this i forgor
      state.startTracking()
      element.innerHTML = `${jsLike}`
      const depends = state.stopTracking()
      state.addCallbacks(depends, () => {
        element.innerHTML = `${jsLike}`
      })
    } else if (name === 'model') {
      // data-model
      if (!(element instanceof HTMLInputElement)) {
        throw new Error(`'data-model' can only be used in input element`)
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

      state.startTracking()
      formElementSet()
      const depends = state.stopTracking()
      state.addCallbacks(depends, () => {
        formElementSet()
      })
      element.addEventListener('input', () => {
        formElementGet()
      })
    } else if (name === 'effect') {
      // data-effect
      const effectFn = parseStrAsJsLike(jsLike, state)
      state.startTracking()
      effectFn()
      const depends = state.stopTracking()
      state.addCallbacks(depends, () => {
        effectFn()
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
        for (const [index, value] of iterable.entries()) {
          // setup local scope
          // TODO: handle data-for index
          const stateFor = new StateHandler(Object.assign({}, {
            [lhs]: value, $i: index
          }), state)
          const clonedTemplate = element.content.cloneNode(true) as DocumentFragment
          // DocumentFragment cannot be used as HTMLElement, we have to get the child manually
          for (const child of Array.from(clonedTemplate.children)) {
            const vForNode = recursiveinitApp(stateFor, child as HTMLElement)
            vNode.children.push(vForNode)
            element.insertAdjacentElement('beforebegin', child)
          }
        }
      }

      state.startTracking()
      updateFor()
      const depends = state.stopTracking()
      state.addCallbacks(depends, () => {
        vNode.children.forEach(child => child.element.remove())
        vNode.children = []
        updateFor()
      })
    } else if (name === 'if') {
      // data-if
      if (!(element instanceof HTMLTemplateElement)) {
        throw new Error(`'data-if' can only be used in template element`)
      }
      const ifGetterFn = parseStrAsJsLike(jsLike, state)
      const clonedTemplate = element.content.cloneNode(true) as DocumentFragment
      for (const child of Array.from(clonedTemplate.children)) {
        const vIfNode = recursiveinitApp(state, child as HTMLElement)
        vNode.children.push(vIfNode)
        element.insertAdjacentElement('beforebegin', child)
      }
      const updateIf = () => {
        const value = ifGetterFn()
        if (value) {
          vNode.children.forEach(child => element.insertAdjacentElement('beforebegin', child.element))
        } else {
          vNode.children.forEach(child => child.element.remove())
        }
      }

      state.startTracking()
      updateIf()
      const depends = state.stopTracking()
      state.addCallbacks(depends, () => {
        updateIf()
      })
    } else if (name === 'else') {
      // data-else
      throw new Error(`'data-else' is not implemented yet`)
    } else if (name.startsWith('on:')) {
      // data-on:
      const eventName = name.slice(3) as keyof HTMLElementEventMap
      const eventFn = new Function("$event", `${jsLike}`).bind(state.proxy)
      element.addEventListener(eventName, (e) => eventFn(e))
    } else if (name.startsWith('bind:')) {
      // data-bind:
      const attrName = name.slice(5)
      const attrGetterFn = parseStrAsJsLike(jsLike, state)
      const nonReactiveAttr = element.getAttribute(attrName)
      const updateAttr = () => {
        let resultClass: string[] = []
        const value = attrGetterFn()

        // using normal attr while using attr binding
        if (nonReactiveAttr) resultClass.push(nonReactiveAttr)

        if (typeof value === 'object') {   // attr binding using objects
          for (const [text, v] of Object.entries(value)) {
            if (v) {
              resultClass.push(text)
            }
          }
        } else {
          resultClass.push(value)
        }

        const resultString = resultClass.join(' ')

        if (value === false || value === null || value === undefined) {
          // special case for falsy, just delete the html attribute
          // assumed if we used reactive condition stuff we shouldnt set the nonreactive one
          element.removeAttribute(attrName)
        } else {
          element.setAttribute(attrName, resultString)
        }
      }

      state.startTracking()
      updateAttr()
      const depends = state.stopTracking()
      state.addCallbacks(depends, () => {
        updateAttr()
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
    const initialState = parseStrAsJsObject(dataset['app'])
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
