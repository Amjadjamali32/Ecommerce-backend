import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/user.models.js';
import { ApiError } from '../utils/ApiError.js';
import dotenv from "dotenv";

dotenv.config({
  path: '.env'
});

const setupPassport = () => {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
    passReqToCallback: true,
    scope: ['profile', 'email']
  }, 
  async (req, accessToken, refreshToken, profile, done) => {
    try {
      let user = await User.findOne({ 
        $or: [
          { email: profile.emails[0].value },
          { googleId: profile.id }
        ]
      });

      console.log(user);
      
      if (user) {
        // Update googleId if not present
        if (!user.googleId) {
          user.googleId = profile.id;
          await user.save();
        }
        return done(null, user);
      }

      // Create new user
      user = await User.create({
        googleId: profile.id,
        name: profile.displayName,
        email: profile.emails[0].value,
        profileImage: profile.photos[0]?.value || '',
        isVerified: true,
        password: undefined, // No password needed
        role: 'user'
      });

      return done(null, user);
    } catch (error) {
      return done(new ApiError(500, 'Google authentication failed', error.message), null);
    }
  }));

  // Serialization (needed even for JWT)
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });
};

export default setupPassport;