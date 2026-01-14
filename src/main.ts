import { createReactive } from "./core/reactive";

const app = document.getElementById("app")

const state = createReactive({
  count: 0
}, () => {
  console.log('reactive', state.count)
  if (app) app.innerHTML = "" + state.count
});

console.log("hello world", state);

setInterval(() => {
  console.log("test")
  state.count = state.count + 1
}, 100)

export default "yes";
