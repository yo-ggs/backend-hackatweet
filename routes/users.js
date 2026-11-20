var express = require("express");
var router = express.Router();

require("../models/connection");
const User = require("../models/users");
const { checkBody } = require("../modules/checkBody");
const { checkAvatar } = require("../modules/checkAvatar");
const uid2 = require("uid2");
const bcrypt = require("bcrypt");

router.post("/signup", (req, res) => {
  if (!checkBody(req.body, ["firstname", "username", "password", "avatar"])) {
    res.json({ result: false, error: "Missing or empty fields" });
    return;
  }

  if (!checkAvatar(req.body.avatar)) {
    res.json({ result: false, error: "Invalid avatar" });
    return;
  }

  // Check if the user has not already been registered
  User.findOne({ username: req.body.username }).then((data) => {
    if (data === null) {
      const hash = bcrypt.hashSync(req.body.password, 10);

      const newUser = new User({
        firstname: req.body.firstname,
        username: req.body.username,
        password: hash,
        token: uid2(32),
        avatar: req.body.avatar,
        canBookmark: true,
      });

      newUser.save().then((newDoc) => {
        res.json({
          result: true,
          token: newDoc.token,
          firstname: newDoc.firstname,
          username: newDoc.username,
          avatar: newDoc.avatar,
          userId: newDoc._id.toString(),
        });
      });
    } else {
      // User already exists in database
      res.json({ result: false, error: "User already exists" });
    }
  });
});

router.post("/signin", (req, res) => {
  if (!checkBody(req.body, ["username", "password"])) {
    res.json({ result: false, error: "Missing or empty fields" });
    return;
  }

  User.findOne({ username: req.body.username }).then((data) => {
    if (data && bcrypt.compareSync(req.body.password, data.password)) {
      res.json({
        result: true,
        token: data.token,
        userId: data._id.toString(),
        firstname: data.firstname,
        username: data.username,
        avatar: data.avatar,
      });
    } else {
      res.json({ result: false, error: "User not found or wrong password" });
    }
  });
});

// =====================================
// PUT : CHANGER SON AVATAR

router.put("/avatar", async (req, res) => {
  const avatar = req.body.avatar;

  if (!checkAvatar(avatar)) {
    return res.status(400).json({ result: false, error: "Invalid avatar" });
  }

  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({ result: false, error: "Token manquant ou invalide" });
  }

  const token = authorization.split(" ")[1];

  try {
    const user = await User.findOne({ token });

    if (!user) {
      return res.status(401).json({ result: false, error: "Utilisateur non authentifié" });
    }

    user.avatar = avatar;
    await user.save();

    res.json({ result: true, avatar: user.avatar });
  } catch (error) {
    console.error(error);
    res.status(500).json({ result: false, error: "Erreur serveur" });
  }
});

module.exports = router;
