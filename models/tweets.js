const mongoose = require('mongoose');

const tweetSchema = mongoose.Schema({
  content: {
    type: String,
    required: true,
    maxlength: 280
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'users',
    required: true
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'users'
  }]
}, { timestamps: true });

const Tweet = mongoose.model('tweets', tweetSchema);

module.exports = Tweet;