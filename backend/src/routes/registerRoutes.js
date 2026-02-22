const registerHealthRoute = require("./health");
const registerSignupRoute = require("./auth/signup");
const registerSigninRoute = require("./auth/signin");
const registerGoogleStartRoute = require("./auth/googleStart");
const registerAuthMeRoute = require("./auth/me");
const registerSendOtpRoute = require("./auth/sendOtp");
const registerVerifyOtpRoute = require("./auth/verifyOtp");
const registerUpdateMeProfileRoute = require("./auth/updateMeProfile");
const registerGetProfileByPhoneRoute = require("./profile/getProfileByPhone");
const registerUpsertProfileRoute = require("./profile/upsertProfile");
const registerSearchProfilesRoute = require("./profile/searchProfiles");
const registerGetContactsRoute = require("./contacts/getContacts");
const registerAddContactRoute = require("./contacts/addContact");
const registerGetConversationsRoute = require("./conversations/getConversations");
const registerGetMessagesRoute = require("./messages/getMessages");
const registerPostMessageRoute = require("./messages/postMessage");
const registerMarkReadRoute = require("./messages/markRead");

const registerRoutes = (app, ctx) => {
  registerHealthRoute(app, ctx);

  registerSignupRoute(app, ctx);
  registerSigninRoute(app, ctx);
  registerGoogleStartRoute(app, ctx);
  registerAuthMeRoute(app, ctx);
  registerSendOtpRoute(app, ctx);
  registerVerifyOtpRoute(app, ctx);
  registerUpdateMeProfileRoute(app, ctx);

  registerGetProfileByPhoneRoute(app, ctx);
  registerUpsertProfileRoute(app, ctx);
  registerSearchProfilesRoute(app, ctx);

  registerGetContactsRoute(app, ctx);
  registerAddContactRoute(app, ctx);

  registerGetConversationsRoute(app, ctx);

  registerGetMessagesRoute(app, ctx);
  registerPostMessageRoute(app, ctx);
  registerMarkReadRoute(app, ctx);
};

module.exports = registerRoutes;
