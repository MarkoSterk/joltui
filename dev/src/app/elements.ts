import AppLayout from "./layouts/appLayout.js";
import AuthLayout from "./layouts/authLayout.js";
import NotFoundPage from "./errorPages/notFoundPage.js";
import AboutPage from "./pages/aboutPage.js";
import DraftsPage from "./pages/draftsPage.js";
import HomePage from "./pages/homePage.js";
import LoginPage from "./pages/loginPage.js";
import PostPage from "./pages/postPage.js";
import ProfilePage from "./pages/profilePage.js";

export default [
    AppLayout,
    AuthLayout,
    HomePage,
    PostPage,
    AboutPage,
    LoginPage,
    ProfilePage,
    DraftsPage,
    NotFoundPage,
] as const;
