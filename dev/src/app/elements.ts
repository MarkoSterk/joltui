import AppLayout from "./layouts/appLayout.js";
import AuthLayout from "./layouts/authLayout.js";
import ProfileSublayout from "./layouts/profileSublayout.js";
import NotFoundPage from "./errorPages/notFoundPage.js";
import AboutPage from "./pages/aboutPage.js";
import DraftsPage from "./pages/draftsPage.js";
import HomePage from "./pages/homePage.js";
import LoginPage from "./pages/loginPage.js";
import PostPage from "./pages/postPage.js";
import ProfilePage from "./pages/profilePage.js";
import ProfileBilling from "./pages/profileBilling.js";
import MoreSpecificPage from "./pages/moreSpecificPage.js";
import LessSpecificPage from "./pages/lessSpecificPage.js";

export default [
    AppLayout,
    AuthLayout,
    ProfileSublayout,
    HomePage,
    PostPage,
    AboutPage,
    LoginPage,
    ProfilePage,
    ProfileBilling,
    DraftsPage,
    NotFoundPage,
    MoreSpecificPage,
    LessSpecificPage
] as const;
