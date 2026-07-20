import DevApp from "./app.js";

const app = new DevApp({
    appName: "JoltUI development",
});

await app.init("#app");