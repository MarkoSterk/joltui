import DevApp from "./app/app.js";

const app = new DevApp({
    appName: "JoltUI development",
    dataStructure: {
        user: null,
        appCount: 0
    },
    serverComponentsUrl: "http://localhost:8080/ecris/server-components/si/sl/"
});

await app.init("#app");