
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const Tweet = require('../models/tweets');
const User = require('../models/users');

// =====================================
// GET : RÉCUPÉRER TOUS LES TWEETS

router.get('/', async (req, res) => {
  try {
    const tweets = await Tweet.find()
  .populate('author', 'firstname username')
  .sort({ createdAt: -1 });

    res.json({
      result: true,
      tweets: tweets
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      result: false,
      error: 'Erreur lors de la récupération des tweets'
    });
  }
});

// =====================================
// GET : RECHERCHER DES TWEETS


router.get('/search', async (req, res) => {
  if (typeof req.query.query !== 'string') {
    return res.status(400).json({
      result: false,
      error: 'Recherche invalide'
    });
  }

  const searchText = req.query.query.trim();

  if (!searchText) {
    return res.status(400).json({
      result: false,
      error: 'Recherche vide'
    });
  }

  if (searchText.length > 100) {
    return res.status(400).json({
      result: false,
      error: 'Recherche trop longue'
    });
  }

  // Échapper les caractères spéciaux des regex
  const safeSearch = searchText.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );

  try {
    const tweets = await Tweet.find({
      content: {
        $regex: safeSearch,
        $options: 'i'
      }
    });

    res.json({
      result: true,
      tweets: tweets
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      result: false,
      error: 'Erreur lors de la recherche'
    });
  }
});

// =====================================
// GET : TWEETS D'UN UTILISATEUR


router.get('/user/:userId', async (req, res) => {
  const userId = req.params.userId;

  if (!mongoose.isValidObjectId(userId)) {
    return res.status(400).json({
      result: false,
      error: 'Identifiant invalide'
    });
  }

  try {
    const tweets = await Tweet.find({
      author: userId
    });

    res.json({
      result: true,
      tweets: tweets
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      result: false,
      error: 'Erreur lors de la récupération des tweets'
    });
  }
});

// =====================================
// POST : PUBLIER UN TWEET


router.post('/', async (req, res) => {
  const content = req.body.content;

  if (typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({
      result: false,
      error: 'Le tweet est vide ou invalide'
    });
  }

  if (content.trim().length > 280) {
    return res.status(400).json({
      result: false,
      error: 'Le tweet ne doit pas dépasser 280 caractères'
    });
  }

  const authorization = req.headers.authorization;

  if (!authorization?.startsWith('Bearer ')) {
    return res.status(401).json({
      result: false,
      error: 'Token manquant ou invalide'
    });
  }

  const token = authorization.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      result: false,
      error: 'Token vide'
    });
  }

  try {
    const user = await User.findOne({ token });

    if (!user) {
      return res.status(401).json({
        result: false,
        error: 'Utilisateur non authentifié'
      });
    }

    const newTweet = await Tweet.create({
      content: content.trim(),
      author: user._id,
      likes: []
    });

    res.status(201).json({
      result: true,
      tweet: newTweet
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      result: false,
      error: 'Erreur lors de la création du tweet'
    });
  }
});

// =====================================
// POST : LIKER OU UNLIKER UN TWEET


router.post('/:id/like', async (req, res) => {
  const id = req.params.id;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({
      result: false,
      error: 'Identifiant du tweet invalide'
    });
  }

  const authorization = req.headers.authorization;

  if (!authorization?.startsWith('Bearer ')) {
    return res.status(401).json({
      result: false,
      error: 'Token manquant ou invalide'
    });
  }

  const token = authorization.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      result: false,
      error: 'Token vide'
    });
  }

  try {
    const user = await User.findOne({ token });

    if (!user) {
      return res.status(401).json({
        result: false,
        error: 'Utilisateur non authentifié'
      });
    }

    const tweet = await Tweet.findById(id);

    if (!tweet) {
      return res.status(404).json({
        result: false,
        error: 'Tweet introuvable'
      });
    }

    const alreadyLiked = tweet.likes.some(
      like => like.toString() === user._id.toString()
    );

    if (!alreadyLiked) {
      tweet.likes.push(user._id);
    } else {
      tweet.likes = tweet.likes.filter(
        like => like.toString() !== user._id.toString()
      );
    }

    await tweet.save();

    res.json({
      result: true,
      liked: !alreadyLiked,
      likesCount: tweet.likes.length
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      result: false,
      error: 'Erreur serveur'
    });
  }
});

// =====================================
// DELETE : SUPPRIMER UN TWEET


router.delete('/:id', async (req, res) => {
  const id = req.params.id;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({
      result: false,
      error: 'Identifiant invalide'
    });
  }

  const authorization = req.headers.authorization;

  if (!authorization?.startsWith('Bearer ')) {
    return res.status(401).json({
      result: false,
      error: 'Token manquant ou invalide'
    });
  }

  const token = authorization.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      result: false,
      error: 'Token vide'
    });
  }

  try {
    const user = await User.findOne({ token });

    if (!user) {
      return res.status(401).json({
        result: false,
        error: 'Utilisateur non authentifié'
      });
    }

    const tweet = await Tweet.findById(id);

    if (!tweet) {
      return res.status(404).json({
        result: false,
        error: 'Tweet introuvable'
      });
    }

    if (
      !tweet.author ||
      tweet.author.toString() !== user._id.toString()
    ) {
      return res.status(403).json({
        result: false,
        error: 'Vous ne pouvez pas supprimer ce tweet'
      });
    }

    const deletedTweet = await Tweet.findOneAndDelete({
      _id: id,
      author: user._id
    });

    if (!deletedTweet) {
      return res.status(404).json({
        result: false,
        error: 'Tweet introuvable'
      });
    }

    res.json({
      result: true,
      message: 'Tweet supprimé'
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      result: false,
      error: 'Erreur serveur'
    });
  }
});

module.exports = router;
