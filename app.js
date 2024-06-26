require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
// const encrypt = require("mongoose-encryption");
// const md5 = require("md5");
// const bcrypt = require("bcrypt");
// const saltRounds = 10;
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");

const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(session({
    secret: "Our little secret.",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

main().catch(err => console.log(err));

async function main() {

    await mongoose.set('strictQuery', true);

    await mongoose.connect("mongodb+srv://demo:demo@democluster.emllug6.mongodb.net/userDB?retryWrites=true&w=majority");
    
    const userSchema = new mongoose.Schema({
        email: String,
        password: String,
        googleId: String,
        secret: String
    });

    
    // userSchema.plugin(encrypt, { secret: process.env.SECRET, encryptedFields: ["password"] });
    
    userSchema.plugin(passportLocalMongoose);
    userSchema.plugin(findOrCreate);

    const User = new mongoose.model("User", userSchema);

    passport.use(User.createStrategy());

    passport.serializeUser(function(user, cb) {
        process.nextTick(function() {
          cb(null, { id: user.id, username: user.username, name: user.name });
        });
      });
      
      passport.deserializeUser(function(user, cb) {
        process.nextTick(function() {
          return cb(null, user);
        });
      });

    passport.use(new GoogleStrategy({
        clientID: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        callbackURL: "https://secrets-soumyajit4464.onrender.com/auth/google/secrets",
        userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
      },
      function(accessToken, refreshToken, profile, cb) {
        User.findOrCreate({ googleId: profile.id }, function (err, user) {
          return cb(err, user);
        });
      }
    ));


    app.get("/", function(req, res) {
        res.render("home");
    });

    app.get("/auth/google",
        passport.authenticate('google', { scope: ['profile'] })
    );

    app.get("/auth/google/secrets", 
        passport.authenticate('google', { failureRedirect: '/login' }),
        function(req, res) {
            // Successful authentication, redirect to secrets.
            res.redirect("/secrets");
    });

    app.get("/login", function(req, res) {
        res.render("login");
    });

    app.get("/register", function(req, res) {
        res.render("register");
    });

    app.get("/secrets", function(req, res) {
        User.find({"secret": {$ne: null}}, function(err, foundUsers) {
            if (err) {
                console.log(err);
            } else {
                if (foundUsers) {
                    res.render("secrets", {usersWithSecrets: foundUsers});
                }
            }
        });
    });

    app.get("/submit", function(req, res) {
        if (req.isAuthenticated()) {
            res.render("submit");
        } else {
            res.render("/login");
        }
    });

    app.post("/submit", function(req, res) {
        const submittedSecret = req.body.secret;
        
        console.log(req.user.id);

        User.findById(req.user.id, function(err, foundUser) {
            if (err) {
                console.log(err);
            } else {
                if (foundUser) {
                    foundUser.secret = submittedSecret;
                    foundUser.save(function() {
                        res.redirect("/secrets");
                    });
                }
            }
        });
    });

    app.get("/logout", function(req, res, next) {
        req.logout(function(err) {
            if (err) { return next(err); }
            res.redirect('/');
          });
    });

    app.post("/register", function(req, res) {

        // bcrypt.hash(req.body.password, saltRounds, function(err, hash) {
        //     const newUser = new User({
        //         email: req.body.username,
        //         // password: md5(req.body.password)
        //         password: hash
        //     });
    
        //     newUser.save(function(err) {
        //         if (err) {
        //             console.log(err);
        //         } else {
        //             res.render("secrets");
        //         }
        //     });
        // });

        User.register({username: req.body.username}, req.body.password, function(err, user) {
            if (err) {
                console.log(err);
                res.redirect("/register");
            } else {
                passport.authenticate("local")(req, res, function() {
                    res.redirect("/secrets");
                });
            }
        });
        
    });

    app.post("/login", function(req, res) {
        // const username = req.body.username;
        // // const password = md5(req.body.password);
        // const password = req.body.password;

        // User.findOne({email: username}, function(err, foundUser) {
        //     if (err) {
        //         console.log(err);
        //     } else {
        //         if (foundUser) {
        //             bcrypt.compare(password, foundUser.password, function(err, result) {
        //                 if (result === true) {
        //                     res.render("secrets");
        //                 }
        //             });   
        //         }
        //     }
        // });

        const user = new User({
            username: req.body.username,
            password: req.body.password
        });

        req.login(user, function(err) {
            if (err) {
                console.log(err);
            } else {
                passport.authenticate("local")(req, res, function() {
                    res.redirect("/secrets");
                });
            }
        })
    });





    app.listen(process.env.PORT || 3000, function(){
    console.log("Server started on port 3000.");
    });
  
}

