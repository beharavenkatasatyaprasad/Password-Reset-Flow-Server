const express = require('express');
const app = express(); //initialize express
const bodyParser = require('body-parser'); //body parsing middleware
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
const bcrypt = require('bcryptjs'); //library to hash passwords
const saltRounds = 10; //cost factor (controls how much time is needed to calculate a single BCrypt hash)
// const uid = require('rand-token').uid; // random token generator
const nodemailer = require("nodemailer"); //end e-mails
const mongodb = require('mongodb'); //MongoDB driver 
const cors = require('cors'); //middleware that can be used to enable CORS with various options
app.use(cookieParser())
app.options('*', cors()) //(Enable All CORS Requests)

const {
    reset
} = require('nodemon');
app.use(bodyParser.json());

//credentials for mail transport
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'mockmail4me@gmail.com',
        pass: 'ekkreipwgzxtnizy'
    }
});

//connect to the server and the database 
const mongoClient = mongodb.MongoClient;
const url = "mongodb+srv://satyabehara:ftjrbtc9S1@cluster0.u3j3r.mongodb.net/rightclick?retryWrites=true&w=majority";

mongoClient.connect(url, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}, function(err, db) {
    if (err) throw err;
    console.log("Database Connected!");
    db.close();
});


//index Endpoint for server
app.get("/", cors(), (req, res) => {
    res.send("Hello From Server");
});


//Endpoint to register the user
app.post('/register', cors(), async(req, res) => {
    let {
        email,
        password
    } = req.body //email & password from client
    let client = await mongoClient.connect(url, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }); //connect to db

    let db = client.db("rightclick"); //db name
    let user = db.collection("users"); //collection name
    user.findOne({ email: email }, (err, result) => {
        if (err) console.log(err)
        if (result == null) {
            bcrypt.hash(password, saltRounds, function(err, hash) { //hash the client password
                user.insertOne({
                    email: email,
                    password: hash
                }); //* insert  credentials in db
                return res.json({ type_: "success", message: 'Registration successful...' });
            });
        } else {
            return res.json({ type_: "warning", message: "User already exists with " + email });
        }
    })
})


//End point for checking the credentials for loginging in
app.post("/login", cors(), async(req, res) => {
    const {
        email,
        password
    } = req.body //email & password from client
    let client = await mongoClient.connect(url, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }); //connect to db
    let db = client.db("rightclick"); //db name
    let user = db.collection("users"); //collection name
    user.findOne({
        email: email
    }, (err, users) => {
        if (users == null) { //find if the user with entered email exists or not
            return res.json({ type_: "warning", message: 'No user found with ' + email + ' !!!' }); //! if not found send this status
        } else {
            bcrypt.compare(password, users.password, function(err, result) { //* if found compare the & check passworded match or not
                if (result == true) { //if matched 
                    let token = jwt.sign({
                        expiresIn: '5m',
                        email: email,
                        iat: Date.now()
                    }, 'secret'); //*assign token
                    res.cookie('user', token, { maxAge: 900000, httpOnly: false }).send();
                } else { // if not matched
                    return res.json({ type_: "warning", message: 'Invalid Credentials !!!' });
                }
                if (err) {
                    return res.json({ type_: "warning", message: 'Some Thing Went Wrong !!!' }); // if any error send this status
                }
            });
        }
    })
});


//Endpoint for resetting password
app.post("/resetpassword", cors(), async(req, res) => {
    const {
        email
    } = req.body //email from client
    let client = await mongoClient.connect(url, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }); //connect to db
    let db = client.db("rightclick"); //db name
    let user = db.collection("users"); //collection name
    user.findOne({ //find if the email exist in the collection
        email: email
    }, (err, users) => {
        if (users == null) {
            return res.json({ type_: "warning", message: 'No User found with ' + email + ' !!!' }); //! if not found send this message
        } else { //if found 
            let emailToken = jwt.sign({
                exp: Math.floor(Date.now() / 1000) + (60 * 60),
                email: email
            }, 'secret');
            user.findOneAndUpdate({
                email: email
            }, {
                $set: {
                    password: emailToken
                }
            }); //update the password with a token

            let url = `https://password-reset-flow-server.herokuapp.com/auth/${emailToken}`
            let name = `${email.split('@')[0]}`
                //email template for sending token
            var mailOptions = {
                from: '"Hello buddy 👻" <noreply@satyaprasadbehara.com>',
                to: `${email}`,
                subject: 'Password Reset Link',
                html: `Hello ${name} ,<br> Here's your password reset link:  <a style="color:green" href="${url}">Click Here To Reset</a> <br> Link expires in 10 Minutes...`
            };

            //Send the mail
            transporter.sendMail(mailOptions, function(error, info) {
                if (error) {
                    console.log(error)
                } else {
                    return res.json({ type_: "success", message: 'Reset Link sent to ' + email + ' !!!' }); //* if mail sent send this `status`
                }
            });
        }
        if (err) {
            return res.json({ type_: "danger", message: err }); //! if found any error send this status
        }
    })
});


//End point to verify the token
app.get('/auth/:token', cors(), async(req, res) => {
    const token = req.params.token
    jwt.verify(token, 'secret', async function(err, decoded) {
        if (decoded) {
            let client = await mongoClient.connect(url, {
                useNewUrlParser: true,
                useUnifiedTopology: true
            });
            let db = client.db("rightclick"); //db name
            let user = db.collection("users"); //collection name
            user.findOneAndUpdate({
                email: decoded.email
            }, {
                $set: {
                    confirmed: true //and set the new hashed password in the db
                }
            }, (err, result) => {
                if (result) {
                    res.redirect('https://password-reset-flow-ui.netlify.app/newpassword.html');
                }
            });
        }
        if (err) {
            return res.json({ type_: "danger", message: err }); //if the token expired send this status
        }
    });


})



//Endpoint to verify the token and senting new password
app.post('/passwordreset', cors(), async(req, res) => {
    const {
        password,
        email
    } = req.body; //email & newpassword from client
    let client = await mongoClient.connect(url, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }); //connect to db
    let db = client.db("rightclick"); //db name
    let user = db.collection("users"); //collection name
    user.findOne({
        email: email
    }, (err, User) => {
        if (User == null) {
            return res.json({ type_: "warning", message: 'No User found with ' + email + ' !!!' }); //! if not found send this status
        } else {
            let token = User.confirmed //find if the token exists in the collection
            if (token == true) {
                try {
                    bcrypt.hash(password, saltRounds, function(err, hash) { //hash the new password
                        user.findOneAndUpdate({
                            email: email
                        }, {
                            $set: {
                                password: hash //and set the new hashed password in the db
                            }
                        });

                    });
                    user.findOneAndUpdate({
                        email: email
                    }, {
                        $set: {
                            confirmed: false
                        }
                    });
                    return res.json({ type_: "successful", message: 'Password reset Successful' }); //*if done send this status
                } catch (e) {
                    return res.json({ type_: "danger", message: err }); //! if any error send this status
                }
            }
        }
    })

})
app.get('/cookie', function(req, res) {
    const { cookies } = req.cookies
    if (!cookies) {
        return res.json({ type_: "danger", message: 'UnAuthorized Login !!!' });
    }
});

app.get('/logout', function(req, res) {
    cookie = req.cookies;
    for (let prop in cookie) {
        if (!cookie.hasOwnProperty(prop)) {
            continue;
        }
        res.cookie(prop, '', { expires: new Date(0) });
    }
    return res.json({ type_: "successful", message: 'Logging out...' });
});

// listen the connections on the specified host
app.listen(process.env.PORT || 3000, () => {
    console.log('Server is live...')
});