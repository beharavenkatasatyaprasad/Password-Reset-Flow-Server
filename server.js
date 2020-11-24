const express = require('express');
const app = express(); //initialize express
const bodyParser = require('body-parser'); //body parsing middleware
const bcrypt = require('bcryptjs'); //library to hash passwords
const saltRounds = 10; //cost factor (controls how much time is needed to calculate a single BCrypt hash)
const uid = require('rand-token').uid; // random token generator
const nodemailer = require("nodemailer"); //end e-mails
const mongodb = require('mongodb'); //MongoDB driver 
const cors = require('cors'); //middleware that can be used to enable CORS with various options
app.options('*', cors()) //(Enable All CORS Requests)

const {
    reset
} = require('nodemon');
app.use(bodyParser.json());


//connect to the server and the database 
const mongoClient = mongodb.MongoClient;
const url = "mongodb+srv://satyabehara:ftjrbtc9S1@cluster0.u3j3r.mongodb.net/rightclick?retryWrites=true&w=majority";

mongoClient.connect(url, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}, function (err, db) {
    if (err) throw err;
    console.log("Database Connected!");
    db.close();
});


//index Endpoint for server
app.get("/", cors(), (req, res) => {
    res.send("Hello From Server");
});

//End point find if the email is already taken.. 
app.post('/findPossibleDuplications', cors(), async (req, res) => {
    let {
        email
    } = req.body //email from client
    let client = await mongoClient.connect(url, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }); //connect to db
    let db = client.db("rightclick"); //db name
    let user = db.collection("users"); //collection name
    user.findOne({
        email: email
    }, (err, result) => { //find if the email is already exist in the collection
        if (result == null) {
            res.sendStatus(202) //*if same email not found send this status
        } else {
            res.sendStatus(400) // ! if found send this status
        }

    })

})

//Endpoint to register the user
app.post('/register', cors(), async (req, res) => {
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
    try {
        bcrypt.hash(password, saltRounds, function (err, hash) { //hash the client password
            user.insertOne({
                email: email,
                password: hash
            }); //* insert  credentials in db
        });
    } catch (e) {
        res.sendStatus(400) // ! if error send this status
    }
    res.end()
})


//End point for checking the credentials for loginging in
app.post("/login", cors(), async (req, res) => {
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
            res.sendStatus(400); //! if not found send this status
        } else {
            bcrypt.compare(password, users.password, function (err, result) { //* if found compare the & check passworded match or not
                if (result == true) { //if matched 
                    let token = uid(16) //*assign a random token
                    res.status(202).json({
                        token: token
                    })
                } else { // if not matched
                    res.sendStatus(401) //! if not found send this status
                }
                if (err) {
                    res.sendStatus(500) // if any error send this status
                }
            });
        }
    })
});


//Endpoint for resetting password
app.post("/resetpassword", cors(), async (req, res) => {
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
            res.sendStatus(400) //! if not found send this status
        } else { //if found 
            let token = uid(5);
            user.findOneAndUpdate({
                email: email
            }, {
                $set: {
                    password: token
                }
            }); //update the password with a token

            //credentials of the mail sender
            var transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: 'ftjrbtc9s1@gmail.com',
                    pass: 'Prasad@444456'
                }
            });

            //email template for sending otp
            var mailOptions = {
                from: '"Hello buddy 👻" <noreply@satyaprasadbehara.com>',
                to: `${email}`,
                subject: 'Password Reset Link',
                html: '<p>Hello ' + `${email.split('@')[0]}` + '</p><p>Your password reset OTP is : <br> <p style="color:green;font-size:150%;">' + `${token}` + '</p></p>'
            };

            //Send the mail
            transporter.sendMail(mailOptions, function (error, info) {
                if (error) {
                    console.log(error)
                } else {
                    res.sendStatus(202); //* if mail sent send this status
                }
            });
        }
        if (err) {
            res.sendStatus(500) //! if found any error send this status
        }
    })
});

//Endpoint to verify the otp and senting new password
app.post('/verification', cors(), async (req, res) => {
    const {
        token,
        password
    } = req.body; //token(otp) & newpassword from client
    let client = await mongoClient.connect(url, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }); //connect to db
    let db = client.db("rightclick"); //db name
    let user = db.collection("users"); //collection name
    user.findOne({ //find if the token(otp) exists in the collection
        password: token
    }, (err, User) => {
        if (User == null) {
            res.sendStatus(500); //! if not found send this status
        } else {
            let email = User.email //if found get the email id 
            try {
                bcrypt.hash(password, saltRounds, function (err, hash) { //hash the new password
                    user.findOneAndUpdate({
                        email: email
                    }, {
                        $set: {
                            password: hash //and set the new hashed password in the db
                        }
                    });
                });
                res.sendStatus(202); //*if done send this status
            } catch (e) {
                res.sendStatus(400); //! if any error send this status
            }

        }
    })

})


// listen the connections on the specified host
app.listen(process.env.PORT || 3000, () => {
    console.log('Server is live...')
});