var express = require("express");
var router = express.Router();
const MySql = require("../routes/utils/MySql");
const DButils = require("../routes/utils/DButils");
const bcrypt = require("bcrypt");
// Username: 3-8 letters, letters only
function isValidUsername(username) {
  return /^[A-Za-z]{3,8}$/.test(username);
}

// Password: 5-10, at least one number and one special character
function isValidPassword(password) {
  return /^(?=.*[0-9])(?=.*[!@#$%^&*])[A-Za-z0-9!@#$%^&*]{5,10}$/.test(password);
}

router.post("/Register", async (req, res, next) => {
  try {
    console.log("Received /Register request");
    let user_details = {
      username: req.body.username,
      firstname: req.body.firstname,
      lastname: req.body.lastname,
      country: req.body.country,
      password: req.body.password,
      email: req.body.email
    }

    console.log("About to query all users");
    let users = await DButils.execQuery("SELECT username from users");
    console.log("Loaded users:", users);

    if (users.find((x) => x.username === user_details.username)) {
      console.log("Username taken!");
      throw { status: 409, message: "Username taken" };
    }
    if (!isValidUsername(user_details.username)) {
      console.log("Invalid username");
      throw { status: 400, message: "Invalid username" };
    }
    if (!isValidPassword(user_details.password)){
      console.log("Invalid password");
      throw { status: 400, message: "Invalid password" };
    }

    let hash_password = bcrypt.hashSync(
      user_details.password,
      parseInt(process.env.bcrypt_saltRounds)
    );

    console.log("About to insert new user...");
    await DButils.execQuery(
      `INSERT INTO users (username, first_name, last_name, country, password, email) VALUES (?, ?, ?, ?, ?, ?)`,
      [ 
        user_details.username,
        user_details.firstname,
        user_details.lastname,
        user_details.country,
        hash_password,
        user_details.email
      ]
    );
    console.log("Insert successful!");
    res.status(201).send({ message: "user created", success: true });
  } catch (error) {
    console.log("Error in /Register:", error);
    next(error);
  }
});


router.post("/Login", async (req, res, next) => {
  try {
    // check that username exists
    const users = await DButils.execQuery("SELECT username FROM users");
    if (!users.find((x) => x.username === req.body.username))
      throw { status: 401, message: "Username or Password incorrect" };

    // check that the password is correct
    const user = (
      await DButils.execQuery(
        `SELECT * FROM users WHERE username = '${req.body.username}'`
      )
    )[0];

    if (!bcrypt.compareSync(req.body.password, user.password)) {
      throw { status: 401, message: "Username or Password incorrect" };
    }

    // Set cookie
    req.session.user_id = user.id;
    console.log("session user_id login: " + req.session.user_id);

    // return cookie
    res.status(200).send({ message: "login succeeded " , success: true });
  } catch (error) {
    next(error);
  }
});

router.post("/Logout", function (req, res) {
  console.log("session user_id Logout: " + req.session.user_id);
  req.session.reset(); // reset the session info --> send cookie when  req.session == undefined!!
  res.send({ success: true, message: "logout succeeded" });
});

module.exports = router;