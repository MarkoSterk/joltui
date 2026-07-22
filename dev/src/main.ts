import FieldnotesApp from "./app/app.js";
import { posts } from "./app/data/posts.js";

const app = new FieldnotesApp({
    appName: "Fieldnotes",
    dataStructure: {
        posts,
        user: null,
    },
    templatesCacheDuration: 180,
    templatesCacheCleanupInterval: 60,
    serverComponentsUrl: "http://localhost:8080/ecris/server-components/si/sl"
});

await app.init("#app");
