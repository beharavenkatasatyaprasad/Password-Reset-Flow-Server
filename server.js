const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const saltRounds = 10;
const uid = require('rand-token').uid;
const nodemailer = require("nodemailer");
const mongodb = require('mongodb');
const mongoClient = mongodb.MongoClient;
const url = "mongodb+srv://satyabehara:ftjrbtc9S1@cluster0.u3j3r.mongodb.net/rightclick?retryWrites=true&w=majority";
const cors = require('cors');
const {
    reset
} = require('nodemon');
app.options('*', cors())

mongoClient.connect(url, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}, function (err, db) {
    if (err) throw err;
    console.log("Database Connected!");
    db.close();
});




app.use(bodyParser.json());

app.get("/", cors(), (req, res) => {
    res.send("Hello From Server");
});

app.post('/findPossibleDuplications', cors(), async (req, res) => {
    let {
        email
    } = req.body
    let client = await mongoClient.connect(url, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });
    let db = client.db("rightclick");
    let user = db.collection("users");
    user.findOne({
        email: email
    }, (err, result) => {
        if (result == null) {
            res.sendStatus(202)
        } else {
            res.sendStatus(400)
        }

    })

})

app.post('/register', cors(), async (req, res) => {
    let {
        email,
        password
    } = req.body
    let client = await mongoClient.connect(url, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });
    let db = client.db("rightclick");
    let user = db.collection("users");
    try {
        bcrypt.hash(password, saltRounds, function (err, hash) {
            user.insertOne({
                email: email,
                password: hash
            });
        });
    } catch (e) {
        res.sendStatus(400)
    }
    res.end()
})


app.post("/login", cors(), async (req, res) => {
    const {
        email,
        password
    } = req.body
    let client = await mongoClient.connect(url, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });
    let db = client.db("rightclick");
    let user = db.collection("users");
    user.findOne({
        email: email
    }, (err, users) => {
        if (users == null) {
            res.sendStatus(400)
        } else {
            bcrypt.compare(password, users.password, function (err, result) {
                if (result == true) {
                    let token = uid(16)
                    res.status(202).json({
                        token: token
                    })
                } else {
                    res.sendStatus(401)
                }
            });
        }
        if (err) {
            res.sendStatus(500)
        }
    })
});

app.post("/resetpassword", cors(), async (req, res) => {
    const {
        email
    } = req.body
    let client = await mongoClient.connect(url, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });
    let db = client.db("rightclick");
    let user = db.collection("users");
    user.findOne({
        email: email
    }, (err, users) => {
        if (users == null) {
            res.sendStatus(400)
        } else {
            let token = uid(5)
            user.findOneAndUpdate({
                email: email
            }, {
                $set: {
                    password: token
                }
            });
            var transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: 'ftjrbtc9s1@gmail.com',
                    pass: 'Prasad@444456'
                }
            });

            var mailOptions = {
                from: '"Hello buddy 👻" <noreply@satyaprasadbehara.com>',
                to: `${email}`,
                subject: 'Password Reset Link',
                html: '<p>Hello ' + `${email.split('@')[0]}` + '</p><p>Your password reset OTP is : <br> <p style="color:green;font-size:150%;">' + `${token}` + '</p></p>'
            };

            transporter.sendMail(mailOptions, function (error, info) {
                if (error) {
                    console.log(error);
                } else {
                    res.sendStatus(202)
                    console.log('Email sent: ' + info.response);
                   
                }
            });
        }
        if (err) {
            res.sendStatus(500)
        }
    })
});


app.post('/verification', cors(), async (req, res) => {
    const {
        token,
        password
    } = req.body
    let client = await mongoClient.connect(url, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });
    let db = client.db("rightclick");
    let user = db.collection("users");
    user.findOne({
        password: token
    }, (err, User) => {
        if (User == null) {
            res.sendStatus(500);
        } else {
            let email = User.email
            try {
                bcrypt.hash(password, saltRounds, function (err, hash) {
                    user.findOneAndUpdate({
                        email: email
                    }, {
                        $set: {
                            password: hash
                        }
                    });
                });
                res.sendStatus(202)
            } catch (e) {
                res.sendStatus(400)
            }

        }
    })

})


app.listen(process.env.PORT || 3000, () => {
    console.log('Server is live...')
});