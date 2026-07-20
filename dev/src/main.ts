import DevApp from "./app/app.js";

const app = new DevApp({
    appName: "JoltUI development",
    dataStructure: {
        user: null,
        appCount: 0
    }
});

await app.init("#app");